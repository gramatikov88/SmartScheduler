
import { GoogleGenAI } from "@google/genai";
import { ScheduleItem, Teacher, ClassGroup, Subject, Room, SchoolConfig, RoomType } from '../types';

const getClient = () => {
  // 1. Check Local Storage (User configured via UI)
  const localKey = localStorage.getItem('GEMINI_API_KEY');
  if (localKey) return new GoogleGenAI({ apiKey: localKey });

  // 2. Check Environment Variables (Dev/Build configured)
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey) return new GoogleGenAI({ apiKey: envKey });

  // 3. Fallback / Error
  throw new Error("Липсва API ключ за Gemini. Моля, добавете го в Настройки -> API.");
};

export const analyzeScheduleWithGemini = async (
  schedule: ScheduleItem[],
  teachers: Teacher[],
  classes: ClassGroup[],
  subjects: Subject[]
): Promise<string> => {
  try {
    const ai = getClient();

    // Prepare a summarized view of the data for the prompt to save tokens
    const dataSummary = {
      scheduleCount: schedule.length,
      teachers: teachers.map(t => ({ id: t.id, name: t.name, maxHours: t.maxHoursPerDay, unwanted: t.unwantedDays })),
      classes: classes.map(c => ({ id: c.id, name: c.name, shift: c.shift })),
      assignments: schedule.map(s => {
        const sub = subjects.find(sub => sub.id === s.subjectId);
        const cls = classes.find(c => c.id === s.classGroupId);
        const tch = teachers.find(t => t.id === s.teacherId);
        return {
          day: s.dayIndex,
          period: s.periodIndex,
          class: cls?.name,
          subject: sub?.name,
          difficulty: sub?.difficulty,
          teacher: tch?.name
        };
      })
    };

    const prompt = `
      Ти си експерт по училищна логистика и педагогика. Анализирай следното разписание (представено като JSON данни) и дай оценка и препоръки.
      
      Основни критерии (Soft Constraints):
      1. Психохигиена на ученика: Трудни предмети (Difficulty > 7) трябва да са в началото на деня (периоди 0-3).
      2. Комфорт на учителя: Избягване на "прозорци" (свободни часове между заети) и спазване на желани почивни дни.
      3. Равномерност: Учениците да нямат твърде натоварени и твърде леки дни.
      4. Логистика: Избягване на твърде много поредни часове (над 5).

      Данни:
      ${JSON.stringify(dataSummary, null, 2)}

      Върни отговора в кратък, структуриран формат на Български език:
      - Обща оценка (0-100)
      - ⚠️ Критични проблеми (ако има)
      - 💡 Предложения за оптимизация (конкретни смени)
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Няма генериран отговор.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return `Възникна грешка при комуникацията с AI асистента: ${error.message}`;
  }
};

export const generateScheduleWithGemini = async (
  teachers: Teacher[],
  classes: ClassGroup[],
  rooms: Room[],
  subjects: Subject[],
  config: SchoolConfig,
  currentSchedule: ScheduleItem[] = []
): Promise<ScheduleItem[]> => {
  try {
    const ai = getClient();

    // 1. Calculate Remaining Curriculum based on currentSchedule
    // We only want to ask the AI to schedule what is missing.
    const simplifiedClasses = classes.map(c => {
      // Filter the curriculum items
      const remainingCurriculum = c.curriculum.map(curr => {
        const alreadyScheduledCount = currentSchedule.filter(s =>
          s.classGroupId === c.id && s.subjectId === curr.subjectId
        ).length;

        const remainingHours = Math.max(0, curr.hoursPerWeek - alreadyScheduledCount);

        return {
          subjectId: curr.subjectId,
          teacherId: curr.teacherId,
          hours: remainingHours,
          roomType: subjects.find(s => s.id === curr.subjectId)?.requiresRoomType || 'Classroom'
        };
      }).filter(item => item.hours > 0); // Remove satisfied subjects

      return {
        id: c.id,
        name: c.name,
        curriculum: remainingCurriculum
      };
    }).filter(c => c.curriculum.length > 0); // Remove fully scheduled classes

    if (simplifiedClasses.length === 0) {
      return []; // Nothing to schedule
    }

    const simplifiedRooms = rooms.map(r => ({
      id: r.id,
      type: r.type,
      capacity: r.capacity
    }));

    const simplifiedTeachers = teachers.map(t => ({
      id: t.id,
      maxHours: t.maxHoursPerDay,
      unwantedDays: t.unwantedDays,
      travels: t.constraints?.travels,
      cannotTeachLast: t.constraints?.cannotTeachLast
    }));

    // Identify occupied slots to pass as constraints
    const occupiedSlots = currentSchedule.map(s => ({
      d: s.dayIndex,
      p: s.periodIndex,
      c: s.classGroupId, // Class is busy
      t: s.teacherId,    // Teacher is busy
      r: s.roomId        // Room is busy
    }));

    // 2. Construct the prompt
    const prompt = `
      Ти си алгоритъм за планиране на училищна програма.
      
      Задача: Генерирай JSON масив от НОВИ часове, за да ДОВЪРШИШ разписанието.
      
      Входни данни:
      - Конфигурация: 5 дни (индекси 0-4), ${config.totalPeriods} учебни часа на ден.
      - ЗАЕТИ СЛОТОВЕ (Existing Schedule): ${JSON.stringify(occupiedSlots)}
      - ОСТАВАЩ УЧЕБЕН ПЛАН (Tasks): ${JSON.stringify(simplifiedClasses)}
      - Кабинети: ${JSON.stringify(simplifiedRooms)}
      - Учители: ${JSON.stringify(simplifiedTeachers)}

      Правила (Hard Constraints):
      1. НЕ слагай час, ако Учителят (t), Класът (c) или Кабинетът (r) вече присъстват в "ЗАЕТИ СЛОТОВЕ" за същия ден (d) и период (p).
      2. Един клас/учител/кабинет може да бъде зает само веднъж в един период.
      3. Спазвай капацитета на стаите и типа (roomType).
      4. Учител с "travels: true" -> забрана за период 0.
      5. Учител с "cannotTeachLast: true" -> забрана за период ${config.totalPeriods - 1}.
      
      Генерирай само липсващите часове от "ОСТАВАЩ УЧЕБЕН ПЛАН".
      
      Формат на отговора (JSON Array):
      [
        {
          "classGroupId": "string",
          "subjectId": "string",
          "teacherId": "string",
          "roomId": "string",
          "dayIndex": number,
          "periodIndex": number
        }
      ]
      Върни САМО JSON масива.
    `;

    // 3. Call Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    let jsonText = response.text;
    if (!jsonText) throw new Error("Получен е празен отговор от AI модела.");

    // Sanitization
    jsonText = jsonText.replace(/```json\n?|\n?```/g, "").trim();

    let rawSchedule;
    try {
      rawSchedule = JSON.parse(jsonText);
    } catch (e) {
      console.error("Failed to parse JSON:", jsonText);
      throw new Error("AI генерира невалиден JSON формат.");
    }

    if (!Array.isArray(rawSchedule)) {
      throw new Error("AI върна некоректна структура (не е масив).");
    }

    // 4. Validate
    const validatedSchedule: ScheduleItem[] = rawSchedule.map((item: any) => ({
      id: `ai_gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      classGroupId: item.classGroupId,
      subjectId: item.subjectId,
      teacherId: item.teacherId,
      roomId: item.roomId,
      dayIndex: Number(item.dayIndex),
      periodIndex: Number(item.periodIndex),
      locked: false
    }));

    return validatedSchedule;

  } catch (error: any) {
    console.error("Generative Schedule Error:", error);
    throw new Error(error.message || "Неизвестна грешка при генериране.");
  }
};
