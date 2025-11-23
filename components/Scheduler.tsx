
import React, { useState, useRef, useMemo } from 'react';
import { ScheduleItem, ClassGroup, Teacher, Room, Subject, GridSlot, DragItem, RoomType, SchoolConfig } from '../types';
import { DAYS } from '../constants';
import { Lock, Unlock, AlertTriangle, Check, BrainCircuit, Sparkles, Loader2, Ban, Info, FileText, Sheet } from 'lucide-react';
import { analyzeScheduleWithGemini, generateScheduleWithGemini } from '../services/geminiService';
import { exportService } from '../services/exportService';

interface SchedulerProps {
  schedule: ScheduleItem[];
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleItem[]>>;
  classes: ClassGroup[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  periods: string[];
}

const Scheduler: React.FC<SchedulerProps> = ({
  schedule, setSchedule, classes, teachers, subjects, rooms, periods
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [conflictSlots, setConflictSlots] = useState<Record<string, string>>({});
  const [hoveredSlot, setHoveredSlot] = useState<{ d: number, p: number } | null>(null);

  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  // -- Helper: Get available unassigned lessons for the selected class --
  const unassignedLessons = useMemo(() => {
    if (!selectedClass) return [];
    const needed = selectedClass.curriculum.flatMap(c => {
      // Find how many are already scheduled
      const scheduledCount = schedule.filter(s =>
        s.classGroupId === selectedClass.id &&
        s.subjectId === c.subjectId
      ).length;

      const remaining = c.hoursPerWeek - scheduledCount;
      return Array(Math.max(0, remaining)).fill({
        subjectId: c.subjectId,
        teacherId: c.teacherId,
        classGroupId: selectedClass.id
      });
    });
    return needed;
  }, [schedule, selectedClass]);

  // -- Helper: Detect Conflict Reason --
  const getConflictReason = (day: number, period: number, teacherId: string, currentClassId: string, ignoreScheduleId?: string): string | null => {
    // 1. Teacher Constraints (Traveling / No First / No Last)
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher) {
      if (teacher.constraints?.travels && period === 0) {
        return "Пътуващ учител (без 1-ви час)";
      }
      if (teacher.constraints?.cannotTeachLast && period === periods.length - 1) {
        return "Ограничение (без последен час)";
      }
      // Specific Blackouts
      if (teacher.constraints?.specificBlackouts?.some(b => b.day === day && b.period === period)) {
        return "Личен ангажимент на учителя";
      }
    }

    // 2. Teacher is busy elsewhere
    const teacherBusy = schedule.find(s =>
      s.id !== ignoreScheduleId &&
      s.dayIndex === day &&
      s.periodIndex === period &&
      s.teacherId === teacherId
    );

    if (teacherBusy) {
      // Find which class the teacher is teaching
      const busyClass = classes.find(c => c.id === teacherBusy.classGroupId)?.name;
      return `Учителят е зает ${busyClass ? `(Клас ${busyClass})` : ''}`;
    }

    // 3. Class is busy
    const classBusy = schedule.some(s =>
      s.id !== ignoreScheduleId &&
      s.dayIndex === day &&
      s.periodIndex === period &&
      s.classGroupId === currentClassId
    );

    if (classBusy) {
      return "Класът вече има час";
    }

    return null;
  };

  const getConflictMap = (teacherId: string, currentClassId: string, subjectId: string, ignoreScheduleId?: string) => {
    const conflicts: Record<string, string> = {};
    const subject = subjects.find(s => s.id === subjectId);
    const requiredRoomType = subject?.requiresRoomType || RoomType.CLASSROOM;
    const currentClass = classes.find(c => c.id === currentClassId);

    for (let d = 0; d < DAYS.length; d++) {
      for (let p = 0; p < periods.length; p++) {
        // 1. Basic Constraints & Teacher/Class Availability
        const reason = getConflictReason(d, p, teacherId, currentClassId, ignoreScheduleId);
        if (reason) {
          conflicts[`${d}-${p}`] = reason;
          continue;
        }

        // 2. Room Availability Check
        // Find if there is AT LEAST ONE room of the required type available at this time
        // AND it has enough capacity
        const hasFreeRoom = rooms.some(r => {
          if (r.type !== requiredRoomType) return false;

          // Capacity check
          if (currentClass && r.capacity < currentClass.studentsCount) return false;

          // Check if this specific room is occupied
          const isRoomBusy = schedule.some(s =>
            s.roomId === r.id &&
            s.dayIndex === d &&
            s.periodIndex === p &&
            s.id !== ignoreScheduleId
          );
          return !isRoomBusy;
        });

        if (!hasFreeRoom) {
          conflicts[`${d}-${p}`] = `Няма свободен/подходящ кабинет (${requiredRoomType})`;
        }
      }
    }
    return conflicts;
  };

  // -- Drag Handlers --
  const handleDragStart = (e: React.DragEvent, item: DragItem) => {
    setDraggedItem(item);
    // Calculate conflicts for this specific item immediately to visualize them
    const conflicts = getConflictMap(item.teacherId, item.classGroupId, item.subjectId, item.scheduleId);
    setConflictSlots(conflicts);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setConflictSlots({});
    setHoveredSlot(null);
  };

  const handleDragOver = (e: React.DragEvent, isConflict: boolean, d: number, p: number) => {
    e.preventDefault();
    if (isConflict) {
      e.dataTransfer.dropEffect = 'none';
    } else {
      e.dataTransfer.dropEffect = 'move';
    }

    // Update hovered slot state for tooltip display
    if (hoveredSlot?.d !== d || hoveredSlot?.p !== p) {
      setHoveredSlot({ d, p });
    }
  };

  const handleDrop = (e: React.DragEvent, dayIndex: number, periodIndex: number) => {
    e.preventDefault();
    if (!draggedItem || !selectedClass) return;

    // Hard Constraint Check: Is the slot actually available?
    const conflictReason = getConflictReason(dayIndex, periodIndex, draggedItem.teacherId, draggedItem.classGroupId, draggedItem.scheduleId);

    if (conflictReason) {
      alert(`Конфликт! ${conflictReason}`);
      return;
    }

    // Find a room
    const subject = subjects.find(s => s.id === draggedItem.subjectId);
    const requiredRoomType = subject?.requiresRoomType || RoomType.CLASSROOM;

    // Filter rooms by type first
    const roomsOfType = rooms.filter(r => r.type === requiredRoomType);
    if (roomsOfType.length === 0) {
      alert(`Грешка: Няма дефинирани кабинети от тип "${requiredRoomType}" в системата!`);
      return;
    }

    // Find valid available room
    const availableRoom = roomsOfType.find(r => {
      // Check occupancy
      const isRoomBusy = schedule.some(s =>
        s.id !== draggedItem.scheduleId &&
        s.dayIndex === dayIndex &&
        s.periodIndex === periodIndex &&
        s.roomId === r.id
      );
      // Check capacity
      return !isRoomBusy && r.capacity >= selectedClass.studentsCount;
    });

    if (!availableRoom) {
      // Determine specific error for better UX
      const hasCapacity = roomsOfType.some(r => r.capacity >= selectedClass.studentsCount);

      if (!hasCapacity) {
        alert(`Няма кабинет от тип "${requiredRoomType}" с достатъчен капацитет за този клас (${selectedClass.studentsCount} ученици)! Моля увеличете местата в кабинета или разделете класа.`);
      } else {
        alert(`Всички подходящи кабинети ("${requiredRoomType}") са заети в този час!`);
      }
      return;
    }

    // Update Schedule
    if (draggedItem.type === 'SCHEDULED_LESSON' && draggedItem.scheduleId) {
      // Move existing
      setSchedule(prev => prev.map(item =>
        item.id === draggedItem.scheduleId
          ? { ...item, dayIndex, periodIndex, roomId: availableRoom.id }
          : item
      ));
    } else {
      // Create new
      const newItem: ScheduleItem = {
        id: `sched_${Date.now()}`,
        classGroupId: draggedItem.classGroupId,
        subjectId: draggedItem.subjectId,
        teacherId: draggedItem.teacherId,
        roomId: availableRoom.id,
        dayIndex,
        periodIndex,
        locked: false
      };
      setSchedule(prev => [...prev, newItem]);
    }

    handleDragEnd();
  };

  const removeScheduleItem = (id: string) => {
    setSchedule(prev => prev.filter(item => item.id !== id));
  };

  const toggleLock = (id: string) => {
    setSchedule(prev => prev.map(item => item.id === id ? { ...item, locked: !item.locked } : item));
  };

  const changeRoom = (scheduleId: string, newRoomId: string) => {
    setSchedule(prev => prev.map(item =>
      item.id === scheduleId
        ? { ...item, roomId: newRoomId }
        : item
    ));
  };

  const handleGeminiAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    const result = await analyzeScheduleWithGemini(schedule, teachers, classes, subjects);
    setAnalysisResult(result);
    setIsAnalyzing(false);
  };

  const handleAutoGenerate = async () => {
    let currentScheduleToKeep: ScheduleItem[] = [];

    if (schedule.length > 0) {
      // Ask user if they want to complete or restart
      const shouldComplete = window.confirm(
        "Разписанието вече съдържа часове.\n\n" +
        "Натиснете OK, за да ДОВЪРШИТЕ текущото разписание (запазвайки въведеното).\n" +
        "Натиснете Cancel, ако искате да изтриете всичко и да генерирате наново (или да се откажете)."
      );

      if (shouldComplete) {
        currentScheduleToKeep = schedule;
      } else {
        // Double check before deleting
        if (!window.confirm("Сигурни ли сте, че искате да ИЗТРИЕТЕ цялото разписание и да генерирате ново от нулата?")) {
          return; // Abort
        }
        currentScheduleToKeep = [];
      }
    }

    setIsGenerating(true);
    try {
      const config: SchoolConfig = {
        startTime: '08:00',
        lessonDuration: 40,
        breakDuration: 10,
        longBreakDuration: 20,
        longBreakAfterPeriod: 3,
        totalPeriods: periods.length,
        customBreaks: {}
      };

      const newItems = await generateScheduleWithGemini(
        teachers,
        classes,
        rooms,
        subjects,
        config,
        currentScheduleToKeep // Pass existing schedule context
      );

      if (newItems.length === 0) {
        alert("Всички часове от учебния план вече са разпределени! Няма какво да се генерира.");
      } else {
        // Merge existing with new
        setSchedule([...currentScheduleToKeep, ...newItems]);
        alert(`Успешно добавени ${newItems.length} нови часа!`);
      }
    } catch (error: any) {
      console.error(error);
      alert(`Грешка при генерирането: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-gray-50">
      {/* --- Sidebar: Unassigned Bank --- */}
      <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col p-4 shadow-sm z-10">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Избери Клас</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Неразпределени часове</h3>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {unassignedLessons.length === 0 && (
            <div className="text-center text-gray-400 py-8 text-sm italic">Всички часове за {selectedClass?.name} са разпределени! 🎉</div>
          )}
          {unassignedLessons.map((item, idx) => {
            const subject = subjects.find(s => s.id === item.subjectId);
            const teacher = teachers.find(t => t.id === item.teacherId);
            return (
              <div
                key={`unassigned_${idx}`}
                draggable
                onDragStart={(e) => handleDragStart(e, {
                  type: 'UNASSIGNED_LESSON',
                  subjectId: item.subjectId,
                  teacherId: item.teacherId,
                  classGroupId: item.classGroupId,
                  duration: 1
                })}
                onDragEnd={handleDragEnd}
                className="bg-white border border-l-4 border-l-indigo-500 border-gray-200 p-3 rounded shadow-sm cursor-move hover:shadow-md transition-all active:scale-95 select-none"
              >
                <div className="font-semibold text-gray-800 text-sm">{subject?.name}</div>
                <div className="text-xs text-gray-500 flex justify-between mt-1">
                  <span>{teacher?.name}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {/* Auto Generate Button */}
          <button
            onClick={handleAutoGenerate}
            disabled={isGenerating || isAnalyzing}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-3 rounded-lg shadow hover:opacity-90 transition disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Генериране...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>AI Генериране</span>
              </>
            )}
          </button>

          <button
            onClick={handleGeminiAnalysis}
            disabled={isAnalyzing || isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 p-3 rounded-lg shadow-sm hover:bg-gray-50 transition disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Анализиране...</span>
              </>
            ) : (
              <>
                <BrainCircuit size={18} />
                <span>Анализ на качеството</span>
              </>
            )}
          </button>

          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Експорт</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => exportService.exportClassesPDF(schedule, classes, teachers, rooms, subjects, { startTime: '08:00', lessonDuration: 40, breakDuration: 10, longBreakDuration: 20, longBreakAfterPeriod: 3, totalPeriods: periods.length, customBreaks: {} })}
                className="flex flex-col items-center justify-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 p-2 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition"
                title="Експорт на всички класове в PDF"
              >
                <FileText size={16} /> Класове (PDF)
              </button>
              <button
                onClick={() => exportService.exportTeachersPDF(schedule, classes, teachers, rooms, subjects, { startTime: '08:00', lessonDuration: 40, breakDuration: 10, longBreakDuration: 20, longBreakAfterPeriod: 3, totalPeriods: periods.length, customBreaks: {} })}
                className="flex flex-col items-center justify-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 p-2 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition"
                title="Експорт на всички учители в PDF"
              >
                <FileText size={16} /> Учители (PDF)
              </button>
            </div>
            <button
              onClick={() => exportService.exportWholeSchoolPDF(schedule, classes, teachers, rooms, subjects, { startTime: '08:00', lessonDuration: 40, breakDuration: 10, longBreakDuration: 20, longBreakAfterPeriod: 3, totalPeriods: periods.length, customBreaks: {} })}
              className="w-full flex items-center justify-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 p-2 rounded-lg text-xs font-semibold hover:bg-purple-100 transition"
            >
              <FileText size={16} /> Пълна Програма (PDF)
            </button>
            <button
              onClick={() => exportService.exportWholeSchoolExcel(schedule, classes, teachers, rooms, subjects, { startTime: '08:00', lessonDuration: 40, breakDuration: 10, longBreakDuration: 20, longBreakAfterPeriod: 3, totalPeriods: periods.length, customBreaks: {} })}
              className="w-full flex items-center justify-center gap-1 bg-green-50 text-green-700 border border-green-200 p-2 rounded-lg text-xs font-semibold hover:bg-green-100 transition"
            >
              <Sheet size={16} /> Пълен Експорт (Excel)
            </button>
          </div>
        </div>
      </div>

      {/* --- Main Area: Grid --- */}
      <div className="flex-1 overflow-auto p-2 lg:p-6 relative">
        {analysisResult && (
          <div className="mb-6 bg-white p-6 rounded-xl shadow border border-purple-100 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2"><BrainCircuit size={20} /> Анализ на разписанието</h3>
              <button onClick={() => setAnalysisResult(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
              {analysisResult}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden min-w-[800px]">
          {/* Header Row (Days) */}
          <div className="grid grid-cols-[80px_repeat(5,1fr)] bg-gray-50 border-b border-gray-200">
            <div className="p-4 text-xs font-bold text-gray-400 uppercase text-center border-r">Час</div>
            {DAYS.map((day, i) => (
              <div key={day} className={`p-4 text-center font-semibold text-sm text-gray-700 border-r last:border-r-0 ${i === 4 ? 'bg-red-50/30' : ''}`}>
                {day}
              </div>
            ))}
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-gray-100">
            {periods.map((periodLabel, pIndex) => (
              <div key={pIndex} className="grid grid-cols-[80px_repeat(5,1fr)] min-h-[100px]">
                {/* Time Label */}
                <div className="p-2 flex items-center justify-center text-xs font-medium text-gray-500 bg-gray-50/50 border-r">
                  {periodLabel}
                </div>

                {/* Day Cells */}
                {DAYS.map((_, dIndex) => {
                  // Find scheduled item for this slot (for the SELECTED class)
                  const cellItem = schedule.find(s =>
                    s.classGroupId === selectedClassId &&
                    s.dayIndex === dIndex &&
                    s.periodIndex === pIndex
                  );

                  const subject = subjects.find(s => s.id === cellItem?.subjectId);
                  const teacher = teachers.find(t => t.id === cellItem?.teacherId);

                  // Conflict Logic
                  const conflictReason = conflictSlots[`${dIndex}-${pIndex}`];
                  const isConflictSlot = !!conflictReason;
                  const isDragActive = !!draggedItem;

                  let cellClasses = "border-r last:border-r-0 relative p-1 transition-all duration-200 ";

                  if (isDragActive) {
                    if (isConflictSlot) {
                      cellClasses += "bg-red-50/60 "; // Saturated background for all conflicts
                    } else if (!cellItem) {
                      // Valid drop target (empty slot)
                      cellClasses += "bg-emerald-50 ring-2 ring-inset ring-emerald-300 ring-dashed ";
                    }
                  } else {
                    cellClasses += "bg-white ";
                  }

                  return (
                    <div
                      key={`${dIndex}-${pIndex}`}
                      onDragOver={(e) => handleDragOver(e, isConflictSlot, dIndex, pIndex)}
                      onDrop={(e) => handleDrop(e, dIndex, pIndex)}
                      className={cellClasses}
                      title={conflictReason || ''} // Fallback native tooltip
                    >
                      {/* Detailed Conflict Tooltip - ONLY Show on Hover of specific cell */}
                      {isDragActive && isConflictSlot && hoveredSlot?.d === dIndex && hoveredSlot?.p === pIndex && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-50 p-1 text-center animate-in zoom-in-95 border-2 border-red-200 shadow-lg rounded-lg">
                          <Ban className="text-red-500 mb-1" size={20} />
                          <span className="text-[10px] font-bold text-red-700 leading-tight select-none">
                            {conflictReason}
                          </span>
                        </div>
                      )}

                      {cellItem ? (
                        <div
                          draggable={!cellItem.locked}
                          onDragStart={(e) => !cellItem.locked && handleDragStart(e, {
                            type: 'SCHEDULED_LESSON',
                            subjectId: cellItem.subjectId,
                            teacherId: cellItem.teacherId,
                            classGroupId: cellItem.classGroupId,
                            duration: 1,
                            scheduleId: cellItem.id,
                            origin: { dayIndex: dIndex, periodIndex: pIndex }
                          })}
                          onDragEnd={handleDragEnd}
                          className={`h-full w-full rounded-lg border p-2 flex flex-col justify-between shadow-sm group relative z-10 ${cellItem.locked ? 'border-gray-300 bg-gray-50 cursor-not-allowed' : 'border-indigo-100 bg-indigo-50/80 cursor-move hover:shadow-md'}`}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`text-xs font-bold ${cellItem.locked ? 'text-gray-600' : 'text-indigo-900'}`}>{subject?.name}</span>
                            <div className="flex gap-1">
                              <button onClick={() => toggleLock(cellItem.id)} className="text-gray-400 hover:text-gray-600">
                                {cellItem.locked ? <Lock size={12} /> : <Unlock size={12} className="opacity-0 group-hover:opacity-100" />}
                              </button>
                              {!cellItem.locked && (
                                <button onClick={() => removeScheduleItem(cellItem.id)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                  &times;
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="mt-1">
                            <div className="text-[10px] text-gray-600 flex items-center gap-1">
                              <span className="truncate max-w-[80px]">{teacher?.name.split(' ')[1]}</span>
                            </div>
                            <select
                              value={cellItem.roomId}
                              onChange={(e) => changeRoom(cellItem.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="mt-1 text-[10px] text-gray-700 bg-white/80 border border-indigo-100 rounded px-1 py-0.5 w-full max-w-full truncate focus:ring-1 focus:ring-indigo-300 outline-none cursor-pointer"
                              title="Смени кабинет"
                            >
                              {rooms.map(r => {
                                // Check if room is busy at this time (by another class)
                                const isBusy = schedule.some(s =>
                                  s.roomId === r.id &&
                                  s.dayIndex === dIndex &&
                                  s.periodIndex === pIndex &&
                                  s.id !== cellItem.id
                                );
                                return (
                                  <option key={r.id} value={r.id}>
                                    {r.name.split('(')[0]} {isBusy ? '(Зает)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      ) : (
                        // Empty Slot Visualization
                        <div className="h-full w-full flex items-center justify-center">
                          {/* Valid target visual is handled by cellClasses */}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div >
    </div >
  );
};

export default Scheduler;
