import React, { useState, useMemo } from 'react';
import { ScheduleItem, ClassGroup, Teacher, Room, Subject, DragItem, RoomType, SchoolConfig } from '../types';
import { DAYS } from '../constants';
import { Lock, Unlock, Ban, FileSpreadsheet, Users, School, BrainCircuit, AlertCircle } from 'lucide-react';
import { exportService } from '../services/exportService';
import { PrintableSchedule } from './PrintableSchedule';
import { ExportButtons } from './ExportButtons';

interface SchedulerProps {
  schedule: ScheduleItem[];
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleItem[]>>;
  classes: ClassGroup[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  periods: string[];
  analysisResult?: string | null;
  onClearAnalysis?: () => void;
}

const Scheduler: React.FC<SchedulerProps> = ({
  schedule, setSchedule, classes, teachers, subjects, rooms, periods, analysisResult, onClearAnalysis
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || '');
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');

  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [conflictSlots, setConflictSlots] = useState<Record<string, string>>({});
  const [hoveredSlot, setHoveredSlot] = useState<{ d: number, p: number } | null>(null);

  const [printMode, setPrintMode] = useState<'class' | 'master' | null>(null);

  const handlePrint = (mode: 'class' | 'master') => {
    setPrintMode(mode);
    // Allow React to render the printable area before triggering print
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);

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
      // Resource Teacher Exception:
      // If the teacher being scheduled IS a resource teacher, they CAN overlap with a regular lesson.
      // BUT, if the slot is already occupied by ANOTHER Resource Teacher, we might want to block it (optional, but safer).
      // For now, we just allow the overlap if the incoming teacher is Resource.
      if (teacher?.isResourceTeacher) {
        // Allow overlap
      } else {
        // Regular teacher cannot overlap
        return "Класът вече има час";
      }
    }

    // 4. Max Gaps Check
    if (teacher && teacher.constraints?.maxGaps !== undefined) {
      // Get all lessons for this teacher on this day
      const dailyLessons = schedule.filter(s =>
        s.teacherId === teacherId &&
        s.dayIndex === day &&
        s.id !== ignoreScheduleId // Exclude the one being moved if it exists
      );

      // Add the potential new lesson
      const potentialLessons = [
        ...dailyLessons,
        { periodIndex: period } // We only need the period index
      ].sort((a, b) => a.periodIndex - b.periodIndex);

      if (potentialLessons.length > 1) {
        const firstPeriod = potentialLessons[0].periodIndex;
        const lastPeriod = potentialLessons[potentialLessons.length - 1].periodIndex;
        const totalSpan = lastPeriod - firstPeriod + 1;
        const actualLessonsCount = potentialLessons.length;
        const gaps = totalSpan - actualLessonsCount;

        if (gaps > teacher.constraints.maxGaps) {
          return `Твърде много прозорци (${gaps} > ${teacher.constraints.maxGaps})`;
        }
      }
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
    if (!draggedItem) return;

    // Determine the class for the item being dropped
    const itemClassId = draggedItem.classGroupId;
    const itemClass = classes.find(c => c.id === itemClassId);

    if (!itemClass) return;

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
      return !isRoomBusy && r.capacity >= itemClass.studentsCount;
    });

    if (!availableRoom) {
      // Determine specific error for better UX
      const hasCapacity = roomsOfType.some(r => r.capacity >= itemClass.studentsCount);

      if (!hasCapacity) {
        alert(`Няма кабинет от тип "${requiredRoomType}" с достатъчен капацитет за този клас (${itemClass.studentsCount} ученици)! Моля увеличете местата в кабинета или разделете класа.`);
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

  return (
    <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-gray-50">
      {/* --- Sidebar: Unassigned Bank --- */}
      <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col p-4 shadow-sm z-10">

        {/* View Mode Toggles */}
        <div className="flex p-1 bg-gray-100 rounded-lg mb-4">
          <button
            onClick={() => setViewMode('class')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'class' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <School size={16} />
            Класове
          </button>
          <button
            onClick={() => setViewMode('teacher')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'teacher' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users size={16} />
            Учители
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {viewMode === 'class' ? 'Избери Клас' : 'Избери Учител'}
          </label>

          {viewMode === 'class' ? (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-purple-500 focus:border-purple-500"
            >
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>

        {/* Validation Warnings */}
        {(() => {
          const warnings: string[] = [];
          if (viewMode === 'class' && selectedClass) {
            selectedClass.curriculum.forEach(item => {
              if (item.requiresDoublePeriod) {
                const subject = subjects.find(s => s.id === item.subjectId);
                const classSchedule = schedule.filter(s => s.classGroupId === selectedClass.id && s.subjectId === item.subjectId);

                // Group by day
                const byDay: Record<number, number[]> = {};
                classSchedule.forEach(s => {
                  if (!byDay[s.dayIndex]) byDay[s.dayIndex] = [];
                  byDay[s.dayIndex].push(s.periodIndex);
                });

                // Check for at least one block
                let hasBlock = false;
                Object.values(byDay).forEach(periods => {
                  periods.sort((a, b) => a - b);
                  for (let i = 0; i < periods.length - 1; i++) {
                    if (periods[i + 1] === periods[i] + 1) {
                      hasBlock = true;
                      break;
                    }
                  }
                });

                // Only warn if we have scheduled enough hours to potentially form a block (>= 2)
                // AND we haven't found a block yet.
                if (classSchedule.length >= 2 && !hasBlock) {
                  warnings.push(`Предметът "${subject?.name}" изисква блок (сдвоен час), но такъв липсва.`);
                }
              }
            });
          }

          if (warnings.length > 0) {
            return (
              <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-orange-800 font-bold text-xs uppercase mb-2">
                  <AlertCircle size={14} /> Внимание
                </div>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="text-xs text-orange-700 leading-tight">• {w}</li>
                  ))}
                </ul>
              </div>
            );
          }
          return null;
        })()}

        {viewMode === 'class' && (
          <>
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
          </>
        )}

        {viewMode === 'teacher' && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm italic p-4 text-center">
            <Users size={48} className="mb-2 opacity-20" />
            <p>Преглед на програмата по учители.</p>
            <p className="text-xs mt-2">Можете да местите часове и тук, но за добавяне на нови използвайте изглед "Класове".</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Експорт</div>
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm flex-wrap justify-center">

              <ExportButtons
                schedule={schedule}
                classes={classes}
                teachers={teachers}
                subjects={subjects}
                rooms={rooms}
                periods={periods}
                selectedClassId={selectedClassId}
                selectedTeacherId={selectedTeacherId}
                viewMode={viewMode}
              />

              <div className="w-full h-px bg-gray-100 my-1"></div>

              <button
                onClick={() => exportService.exportWholeSchoolExcel(schedule, classes, teachers, rooms, subjects, { startTime: '08:00', lessonDuration: 40, breakDuration: 10, longBreakDuration: 20, longBreakAfterPeriod: 3, totalPeriods: periods.length, customBreaks: {} })}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                title="Експорт в Excel"
              >
                <FileSpreadsheet size={16} />
                <span className="hidden sm:inline">Excel</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Main Area: Grid --- */}
      <div className="flex-1 overflow-auto p-2 lg:p-6 relative">
        {analysisResult && (
          <div className="mb-6 bg-white p-6 rounded-xl shadow border border-purple-100 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2"><BrainCircuit size={20} /> Анализ на разписанието</h3>
              <button onClick={onClearAnalysis} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
              {analysisResult}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden min-w-[1000px]">
          {/* Header Row (Days) */}
          <div className="grid grid-cols-[80px_repeat(5,minmax(0,1fr))] bg-gray-50 border-b border-gray-200">
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
              <div key={pIndex} className="grid grid-cols-[80px_repeat(5,minmax(0,1fr))] min-h-[100px]">
                {/* Time Label */}
                <div className="p-2 flex items-center justify-center text-xs font-medium text-gray-500 bg-gray-50/50 border-r">
                  {periodLabel}
                </div>

                {/* Day Cells */}
                {DAYS.map((_, dIndex) => {
                  // Find scheduled items for this slot
                  const allItemsInSlot = schedule.filter(s =>
                    s.dayIndex === dIndex &&
                    s.periodIndex === pIndex
                  );

                  let cellItem: ScheduleItem | undefined;
                  let resourceItem: ScheduleItem | undefined;

                  if (viewMode === 'class') {
                    // In class view, we want the main lesson for this class
                    cellItem = allItemsInSlot.find(s => s.classGroupId === selectedClassId && !teachers.find(t => t.id === s.teacherId)?.isResourceTeacher);
                    // AND any resource lesson for this class
                    resourceItem = allItemsInSlot.find(s => s.classGroupId === selectedClassId && teachers.find(t => t.id === s.teacherId)?.isResourceTeacher);

                    // If only resource item exists and no main item, treat resource as main for display purposes if needed, 
                    // OR just show it as a resource item. Let's show it as main if it's the only one.
                    if (!cellItem && resourceItem) {
                      cellItem = resourceItem;
                      resourceItem = undefined;
                    }
                  } else {
                    // In teacher view, we just want the lesson this teacher is teaching
                    cellItem = allItemsInSlot.find(s => s.teacherId === selectedTeacherId);
                  }

                  const subject = subjects.find(s => s.id === cellItem?.subjectId);
                  const teacher = teachers.find(t => t.id === cellItem?.teacherId);
                  const classGroup = classes.find(c => c.id === cellItem?.classGroupId);

                  const resourceSubject = subjects.find(s => s.id === resourceItem?.subjectId);
                  const resourceTeacher = teachers.find(t => t.id === resourceItem?.teacherId);

                  // Double Period Connection Logic (Only for main item)
                  const prevItem = schedule.find(s =>
                    s.dayIndex === dIndex &&
                    s.periodIndex === pIndex - 1 &&
                    s.classGroupId === cellItem?.classGroupId &&
                    s.subjectId === cellItem?.subjectId &&
                    s.teacherId === cellItem?.teacherId
                  );
                  const nextItem = schedule.find(s =>
                    s.dayIndex === dIndex &&
                    s.periodIndex === pIndex + 1 &&
                    s.classGroupId === cellItem?.classGroupId &&
                    s.subjectId === cellItem?.subjectId &&
                    s.teacherId === cellItem?.teacherId
                  );

                  const isConnectedTop = !!prevItem && !!cellItem;
                  const isConnectedBottom = !!nextItem && !!cellItem;

                  // Conflict Logic
                  const conflictReason = conflictSlots[`${dIndex}-${pIndex}`];
                  const isConflictSlot = !!conflictReason;
                  const isDragActive = !!draggedItem;

                  let cellClasses = "border-r last:border-r-0 relative p-1 transition-all duration-200 ";

                  if (isDragActive) {
                    if (isConflictSlot) {
                      cellClasses += "bg-red-50/60 "; // Saturated background for all conflicts
                    } else if (!cellItem && !resourceItem) {
                      // Valid drop target (empty slot)
                      cellClasses += "bg-emerald-50 ring-2 ring-inset ring-emerald-300 ring-dashed ";
                    }
                  } else {
                    cellClasses += "bg-white ";
                  }

                  // Dynamic styles for connected items
                  let itemClasses = `h-full w-full border p-2 flex flex-col justify-between shadow-sm group relative z-10 `;

                  if (cellItem?.locked) {
                    itemClasses += 'border-gray-300 bg-gray-50 cursor-not-allowed ';
                  } else {
                    itemClasses += 'border-indigo-100 bg-indigo-50/80 cursor-move hover:shadow-md ';
                  }

                  // Apply connection styles
                  if (isConnectedTop) {
                    itemClasses += 'rounded-t-none border-t-0 pt-4 '; // Remove top border/radius, add padding to compensate
                  } else {
                    itemClasses += 'rounded-t-lg ';
                  }

                  if (isConnectedBottom) {
                    itemClasses += 'rounded-b-none border-b-dashed border-b-indigo-200/50 pb-4 '; // Dashed separator or no border
                  } else {
                    itemClasses += 'rounded-b-lg ';
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
                          className={itemClasses}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`text-xs font-bold ${cellItem.locked ? 'text-gray-600' : 'text-indigo-900'} ${isConnectedTop ? 'opacity-50' : ''}`}>
                              {subject?.name}
                              {isConnectedTop && <span className="ml-1 text-[9px] opacity-60">(продължение)</span>}
                            </span>
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
                              {viewMode === 'class' ? (
                                <span className="truncate max-w-[80px]">{teacher?.name.split(' ')[1]}</span>
                              ) : (
                                <span className="truncate max-w-[80px] font-semibold text-indigo-700">{classGroup?.name}</span>
                              )}
                            </div>

                            {/* Resource Teacher Indicator (Overlay) */}
                            {resourceItem && (
                              <div className="mt-1 pt-1 border-t border-indigo-200 flex items-center justify-between bg-purple-50 rounded px-1">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-purple-700 leading-tight">{resourceSubject?.name}</span>
                                  <span className="text-[8px] text-purple-600">{resourceTeacher?.name.split(' ')[1]}</span>
                                </div>
                                <button onClick={() => removeScheduleItem(resourceItem!.id)} className="text-purple-300 hover:text-purple-500">
                                  &times;
                                </button>
                              </div>
                            )}

                            {!resourceItem && (
                              <select
                                title="Смени кабинет"
                                value={cellItem.roomId}
                                onChange={(e) => changeRoom(cellItem!.id, e.target.value)}
                                className="w-full text-[10px] p-0.5 border border-gray-200 rounded mt-1 bg-white/50 focus:bg-white"
                              >
                                {rooms.map(r => {
                                  // Check if room is busy at this time (by another class)
                                  const isBusy = schedule.some(s =>
                                    s.roomId === r.id &&
                                    s.dayIndex === dIndex &&
                                    s.periodIndex === pIndex &&
                                    s.id !== cellItem!.id
                                  );
                                  return (
                                    <option
                                      key={r.id}
                                      value={r.id}
                                      className={isBusy ? "text-orange-600 font-bold bg-orange-50" : ""}
                                    >
                                      {r.name.split('(')[0]} {isBusy ? '(Зает)' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            )}
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
      </div>

      {/* Printable Area (Hidden on Screen, Visible on Print) */}
      <div id="printable-area" className={printMode ? 'block' : 'hidden'}>
        {printMode && (
          <PrintableSchedule
            mode={printMode}
            selectedClassId={selectedClassId}
            schedule={schedule}
            classes={classes}
            teachers={teachers}
            subjects={subjects}
            rooms={rooms}
            periods={periods}
          />
        )}
      </div>
    </div>
  );
};

export default Scheduler;
