import { GoogleGenAI } from "@google/genai";
import { ScheduleItem, Teacher, ClassGroup, Subject, Room, SchoolConfig, RoomType } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Липсва API ключ за Gemini. Моля, конфигурирайте го.");
  }
  return new GoogleGenAI({ apiKey: apiKey });
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

      Данни:
      ${JSON.stringify(dataSummary, null, 2)}

      Върни отговора в кратък, структуриран формат на Български език:
      - Обща оценка (0-10)
      - Открити проблеми (Bullet points)
      - Препоръки за оптимизация (Bullet points)
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Няма генериран отговор.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Възникна грешка при комуникацията с AI асистента.";
  }
};

export const generateScheduleWithGemini = async (
  teachers: Teacher[],
  classes: ClassGroup[],
  rooms: Room[],
  subjects: Subject[],
  config: SchoolConfig
): Promise<ScheduleItem[]> => {
  try {
    const ai = getClient();

    // 1. Prepare simplified data structures to minimize token usage
    const simplifiedClasses = classes.map(c => ({
      id: c.id,
      name: c.name,
      curriculum: c.curriculum.map(curr => ({
        subjectId: curr.subjectId,
        teacherId: curr.teacherId,
        hours: curr.hoursPerWeek,
        roomType: subjects.find(s => s.id === curr.subjectId)?.requiresRoomType || 'Classroom'
      }))
    }));

    const simplifiedRooms = rooms.map(r => ({
      id: r.id,
      type: r.type,
      capacity: r.capacity
    }));

    const simplifiedTeachers = teachers.map(t => ({
      id: t.id,
      maxHours: t.maxHoursPerDay,
      unwantedDays: t.unwantedDays // 0=Mon, 4=Fri
    }));

    // 2. Construct the prompt
    const prompt = `
      Ти си алгоритъм за планиране на училищна програма. Твоята задача е да генерираш JSON масив от часове.
      
      Входни данни:
      - Конфигурация: 5 дни (индекси 0-4), ${config.totalPeriods} учебни часа на ден (индекси 0-${config.totalPeriods - 1}).
      - Класове и учебен план: ${JSON.stringify(simplifiedClasses)}
      - Кабинети: ${JSON.stringify(simplifiedRooms)}
      - Учители: ${JSON.stringify(simplifiedTeachers)}

      Правила (Hard Constraints):
      1. Един клас може да има само един час в даден период.
      2. Един учител може да преподава само на едно място в даден период.
      3. Един кабинет може да се ползва само от един клас в даден период.
      4. Типът на кабинета трябва да отговаря на изискването на предмета (roomType).
      5. Учителят не трябва да има час в дните от "unwantedDays".
      
      Задача:
      Генерирай възможно най-пълното разписание, спазвайки горните правила.
      Опитай се да разпределиш всички часове от учебния план (curriculum).
      
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
      Върни САМО JSON масива, без допълнителен текст.
    `;

    // 3. Call Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Using flash for speed/cost effectiveness on large JSON generation
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");

    const rawSchedule = JSON.parse(jsonText);

    // 4. Validate and map to internal types
    // Add unique IDs and locked status
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

  } catch (error) {
    console.error("Generative Schedule Error:", error);
    throw error;
  }
};
