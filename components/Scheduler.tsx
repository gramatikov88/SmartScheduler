import React, { useState, useMemo } from 'react';
import { ScheduleItem, ClassGroup, Teacher, Room, Subject, DragItem, RoomType, SchoolConfig, GridSlot } from '../types';
import { DAYS } from '../constants';
import { Lock, Unlock, Ban, FileSpreadsheet, Users, School, BrainCircuit, AlertCircle, LayoutGrid, Check, X } from 'lucide-react';
import { exportService } from '../services/exportService';
import { PrintableSchedule } from './PrintableSchedule';
import { ExportButtons } from './ExportButtons';
import { getConflictReason as checkConflict, findBestRoom as findRoom } from '../utils/schedulerUtils';
import { generateScheduleVariant } from '../services/optimizationService';

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
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'overview'>('class');
  const [overviewDay, setOverviewDay] = useState(0);

  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [conflictSlots, setConflictSlots] = useState<Record<string, string>>({});
  const [hoveredSlot, setHoveredSlot] = useState<{ d: number, p: number } | null>(null);
  const [suggestionModal, setSuggestionModal] = useState<{ isOpen: boolean, dayIndex: number, periodIndex: number, classGroupId: string } | null>(null);

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
    // If a modal is open, use THAT class, otherwise use selectedClass (for the dock)
    const targetClass = suggestionModal ? classes.find(c => c.id === suggestionModal.classGroupId) : selectedClass;

    if (!targetClass) return [];
    const needed = targetClass.curriculum.flatMap(c => {
      // Find how many are already scheduled with this specific assignment type
      const scheduledCount = schedule.filter(s =>
        s.classGroupId === targetClass.id &&
        s.subjectId === c.subjectId &&
        (s.assignmentType || 'ООП') === (c.assignmentType || 'ООП')
      ).length;

      const remaining = c.hoursPerWeek - scheduledCount;
      return Array(Math.max(0, remaining)).fill({
        subjectId: c.subjectId,
        teacherId: c.teacherId,
        classGroupId: targetClass.id,
        assignmentType: c.assignmentType || 'ООП'
      });
    });
    return needed;
  }, [schedule, selectedClass, classes, suggestionModal]);

  // -- Helper: Get available unassigned lessons for the selected TEACHER --
  const teacherUnassignedLessons = useMemo(() => {
    if (!selectedTeacher) return [];

    // We need to look at ALL classes to see who needs this teacher
    const needed: any[] = [];

    classes.forEach(cls => {
      cls.curriculum.forEach(c => {
        if (c.teacherId === selectedTeacher.id) {
          // Calculate how many already scheduled
          const scheduledCount = schedule.filter(s =>
            s.classGroupId === cls.id &&
            s.subjectId === c.subjectId &&
            (s.assignmentType || 'ООП') === (c.assignmentType || 'ООП')
          ).length;

          const remaining = c.hoursPerWeek - scheduledCount;

          if (remaining > 0) {
            const items = Array(remaining).fill({
              subjectId: c.subjectId,
              teacherId: selectedTeacher.id,
              classGroupId: cls.id,
              assignmentType: c.assignmentType || 'ООП'
            });
            needed.push(...items);
          }
        }
      });
    });

    return needed;
  }, [schedule, selectedTeacher, classes]);



  // ... inside Scheduler component ...

  // -- Helper: Detect Conflict Reason (Refactored to use Utils) --
  const getConflictReason = (day: number, period: number, teacherId: string, currentClassId: string, subjectId: string, assignmentType: string = 'ООП', ignoreScheduleId?: string): string | null => {
    return checkConflict(day, period, teacherId, currentClassId, subjectId, schedule, classes, teachers, subjects, assignmentType, ignoreScheduleId);
  };

  const getConflictMap = (teacherId: string, currentClassId: string, subjectId: string, assignmentType: string = 'ООП', ignoreScheduleId?: string) => {
    const conflicts: Record<string, string> = {};
    const subject = subjects.find(s => s.id === subjectId);
    const requiredRoomType = subject?.requiresRoomType || RoomType.CLASSROOM;
    const currentClass = classes.find(c => c.id === currentClassId);

    for (let d = 0; d < DAYS.length; d++) {
      for (let p = 0; p < periods.length; p++) {
        // 1. Basic Conflicts
        const reason = getConflictReason(d, p, teacherId, currentClassId, subjectId, assignmentType, ignoreScheduleId);
        if (reason) {
          conflicts[`${d}-${p}`] = reason;
          continue;
        }

        // 2. Room Availability (Using Util Logic via local wrapper or direct?)
        // The Util findBestRoom checks specific room.
        // Here we just need boolean "is any room free".
        // Let's keep the manual check here for "Any Room" or use findBestRoom result?
        // findBestRoom returns a specific Room object if valid. If it returns undefined, it means no room.
        // So we can use it!

        const bestRoom = findRoom(subjectId, currentClassId, d, p, schedule, rooms, classes, subjects, ignoreScheduleId);
        if (!bestRoom) {
          conflicts[`${d}-${p}`] = `Няма свободен/подходящ кабинет (${requiredRoomType})`;
        }
      }
    }
    return conflicts;
  };

  // -- Helper: Find Best Room (Refactored) --
  const findBestRoom = (subjectId: string, classGroupId: string, day: number, period: number, ignoreScheduleId?: string, ignoreScheduleIdsArray: string[] = []) => {
    return findRoom(subjectId, classGroupId, day, period, schedule, rooms, classes, subjects, ignoreScheduleId, ignoreScheduleIdsArray);
  };

  // -- Helper: Find free slots for a specific lesson (teacher/class constraint) --
  const findFreeSlotsForLesson = (lesson: ScheduleItem) => {
    const availableSlots: GridSlot[] = [];

    for (let d = 0; d < DAYS.length; d++) {
      for (let p = 0; p < periods.length; p++) {
        const conflict = getConflictReason(d, p, lesson.teacherId, lesson.classGroupId, lesson.subjectId, lesson.assignmentType, lesson.id);
        if (!conflict) {
          const room = findBestRoom(lesson.subjectId, lesson.classGroupId, d, p, lesson.id);
          if (room) {
            availableSlots.push({ dayIndex: d, periodIndex: p });
          }
        }
      }
    }
    return availableSlots;
  };

  // -- Action: Generate Variant --
  const handleGenerateVariant = () => {
    if (window.confirm("Генерирането на вариант ще разбърка програмата, опитвайки се да намери алтернативна подредба. Сигурни ли сте?")) {
      const newSchedule = generateScheduleVariant(schedule, classes, teachers, subjects, rooms);
      setSchedule(newSchedule);
      alert("Генериран е нов вариант!");
    }
  };


  // -- Drag Handlers --
  const handleDragStart = (e: React.DragEvent, item: DragItem) => {
    setDraggedItem(item);
    setDraggedItem(item);
    // Calculate conflicts for this specific item immediately to visualize them
    const conflicts = getConflictMap(item.teacherId, item.classGroupId, item.subjectId, item.assignmentType, item.scheduleId);
    // Note: getConflictMap currently doesn't take assignmentType fully into account for the map visualization 
    // because we didn't pass it to getConflictMap signature yet, but we can improve this.
    // For now, the critical check is in handleDrop.
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

  const handleDrop = (e: React.DragEvent, dayIndex: number, periodIndex: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    // Determine the class for the item being dropped
    const itemClassId = draggedItem.classGroupId;
    const itemClass = classes.find(c => c.id === itemClassId);

    if (!itemClass) return;

    // Hard Constraint Check: Is the slot actually available?
    const conflictReason = getConflictReason(dayIndex, periodIndex, draggedItem.teacherId, draggedItem.classGroupId, draggedItem.subjectId, draggedItem.assignmentType, draggedItem.scheduleId);

    if (conflictReason) {
      // Check if conflict is "Teacher is busy"
      if (conflictReason.includes('Учителят е зает')) {
        const conflictingLesson = schedule.find(s =>
          s.dayIndex === dayIndex &&
          s.periodIndex === periodIndex &&
          s.teacherId === draggedItem.teacherId &&
          s.id !== draggedItem.scheduleId
        );

        if (conflictingLesson) {
          const conflictingClass = classes.find(c => c.id === conflictingLesson.classGroupId);
          const conflictingSubject = subjects.find(s => s.id === conflictingLesson.subjectId);

          // Try to find a free slot for the CONFLICTING lesson to move it there
          const freeSlots = findFreeSlotsForLesson(conflictingLesson);

          if (freeSlots.length > 0) {
            // Propose the first free slot
            const bestSlot = freeSlots[0];
            const confirmMsg = `Конфликт: Учителят е зает с ${conflictingClass?.name} (${conflictingSubject?.name}).\n\nИскате ли да преместите часа на ${conflictingClass?.name} в ${DAYS[bestSlot.dayIndex]}, ${bestSlot.periodIndex + 1}. час, за да освободите място?`;

            if (window.confirm(confirmMsg)) {
              // EXECUTE SWAP/MOVE

              // 1. Find room for displaced lesson (reuse logic ideally, but simplified here)
              const displacedRoom = findBestRoom(conflictingLesson.subjectId, conflictingLesson.classGroupId, bestSlot.dayIndex, bestSlot.periodIndex, conflictingLesson.id);

              if (!displacedRoom) {
                alert("Няма свободен кабинет за премествания час!");
                return;
              }

              // 2. Find room for NEW lesson (the one being dragged)
              // We must ignore the conflicting lesson because we are about to move it
              const newLessonRoom = findBestRoom(draggedItem.subjectId, draggedItem.classGroupId, dayIndex, periodIndex, draggedItem.scheduleId, [conflictingLesson.id]);

              if (!newLessonRoom) {
                alert("Няма свободен кабинет за новия час!");
                return;
              }

              setSchedule(prev => {
                // Remove conflicting lesson from old spot, place in new spot
                // Place dragged lesson in target spot

                const newSchedule = prev.map(item => {
                  if (item.id === conflictingLesson.id) {
                    return { ...item, dayIndex: bestSlot.dayIndex, periodIndex: bestSlot.periodIndex, roomId: displacedRoom.id };
                  }
                  if (draggedItem.scheduleId && item.id === draggedItem.scheduleId) {
                    return { ...item, dayIndex, periodIndex, roomId: newLessonRoom.id };
                  }
                  return item;
                });

                if (!draggedItem.scheduleId) {
                  // Create new item
                  newSchedule.push({
                    id: `sched_${Date.now()}`,
                    classGroupId: draggedItem.classGroupId,
                    subjectId: draggedItem.subjectId,
                    teacherId: draggedItem.teacherId,
                    roomId: newLessonRoom.id,
                    dayIndex,
                    periodIndex,
                    locked: false,
                    assignmentType: draggedItem.assignmentType
                  });
                }

                return newSchedule;
              });

              handleDragEnd();
              return;
            }
          } else {
            // No free slots, ask to unassign
            if (window.confirm(`Конфликт: Учителят е зает с ${conflictingClass?.name}.\nНяма свободен час за преместване.\n\nИскате ли да ПРЕМАХНЕТЕ часа на ${conflictingClass?.name}, за да сложите този?`)) {
              // Unassign conflicting
              removeScheduleItem(conflictingLesson.id);
              // Proceed with normal logic (will succeed next time, OR proceed below if we duplicate code, simpler to just return and let user drop again? No, execute.)
              // We will fall through to standard logic but we need to update state first? 
              // Wait, if we call removeScheduleItem, state updates async?
              // Better to do it all in one update.

              // FALLTHROUGH to standard logic requires finding room again.
              // The standard logic below will run 'getConflictReason' again? No, strictly linear.
              // We need to just proceed. 
              // IMPORTANT: The `availableRoom` check below accounts for existing schedule. 
              // If we proceed immediately, `conflictingLesson` is still in `schedule` closure variable.
              // So we must manually exclude it from room checks below or do the update here.

              const newLessonRoom = findBestRoom(draggedItem.subjectId, draggedItem.classGroupId, dayIndex, periodIndex, draggedItem.scheduleId, [conflictingLesson.id]);

              if (!newLessonRoom) {
                alert("Няма свободен кабинет!");
                return; // Should revert the remove? existing remove is state update.
              }

              setSchedule(prev => {
                const filtered = prev.filter(p => p.id !== conflictingLesson.id);

                if (draggedItem.scheduleId) {
                  return filtered.map(item => item.id === draggedItem.scheduleId ? { ...item, dayIndex, periodIndex, roomId: newLessonRoom.id } : item);
                } else {
                  return [...filtered, {
                    id: `sched_${Date.now()}`,
                    classGroupId: draggedItem.classGroupId,
                    subjectId: draggedItem.subjectId,
                    teacherId: draggedItem.teacherId,
                    roomId: newLessonRoom.id,
                    dayIndex,
                    periodIndex,
                    locked: false,
                    assignmentType: draggedItem.assignmentType
                  }];
                }
              });
              handleDragEnd();
              return;
            }
          }
        }
      }

      alert(`Конфликт! ${conflictReason}`);
      return;
    }

    // Find a room
    const subject = subjects.find(s => s.id === draggedItem.subjectId);
    const requiredRoomType = subject?.requiresRoomType || RoomType.CLASSROOM;

    // Find valid available room
    const availableRoom = findBestRoom(draggedItem.subjectId, draggedItem.classGroupId, dayIndex, periodIndex, draggedItem.scheduleId);

    if (!availableRoom) {
      // ... (Error handling kept similar or simplified)
      const roomsOfType = rooms.filter(r => r.type === requiredRoomType);
      const hasCapacity = roomsOfType.some(r => r.capacity >= itemClass.studentsCount);
      if (!hasCapacity) {
        alert(`Няма кабинет от тип "${requiredRoomType}" с достатъчен капацитет!`);
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
        locked: false,
        assignmentType: draggedItem.assignmentType
      };
      setSchedule(prev => [...prev, newItem]);
    }

    handleDragEnd();
  };



  return (
    <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-gray-50">
      {/* --- Sidebar: Unassigned Bank --- */}
      <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col p-4 shadow-sm z-10">

        {/* View Mode Toggles */}
        <div className="flex p-1 bg-gray-100 rounded-lg mb-4">
          <button
            onClick={() => setViewMode('class')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'class' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            title="Класове"
          >
            <School size={16} />
          </button>
          <button
            onClick={() => setViewMode('teacher')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'teacher' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            title="Учители"
          >
            <Users size={16} />
          </button>
          <button
            onClick={() => setViewMode('overview')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'overview' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            title="Общ преглед"
          >
            <LayoutGrid size={16} />
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
              style={{
                borderLeftColor: teachers.find(t => t.id === selectedTeacherId)?.color || 'transparent',
                borderLeftWidth: '4px'
              }}
            >
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
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
                const teacherColor = teacher?.color || '#6366f1'; // Default indigo-500
                return (
                  <div
                    key={`unassigned_${idx}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, {
                      type: 'UNASSIGNED_LESSON',
                      subjectId: item.subjectId,
                      teacherId: item.teacherId,
                      classGroupId: item.classGroupId,
                      assignmentType: item.assignmentType,
                      duration: 1
                    })}
                    onDragEnd={handleDragEnd}
                    className="bg-white border-l-4 border-gray-200 p-3 rounded shadow-sm cursor-move hover:shadow-md transition-all active:scale-95 select-none"
                    style={{ borderLeftColor: teacherColor }}
                  >
                    <div className="font-semibold text-gray-800 text-sm">
                      {subject?.name}
                      <span className="text-[10px] text-indigo-600 ml-1 bg-indigo-50 px-1 rounded border border-indigo-100">
                        {item.assignmentType}
                      </span>
                    </div>
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
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Часове за разпределение</h3>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {teacherUnassignedLessons.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm italic">Всички часове на {selectedTeacher?.name} са разпределени! 🎉</div>
              )}
              {teacherUnassignedLessons.map((item, idx) => {
                const subject = subjects.find(s => s.id === item.subjectId);
                const classGroup = classes.find(c => c.id === item.classGroupId);

                // Use class color or neutral since we are in teacher view? 
                // Let's use the teacher's color for consistency or maybe a class indicator.
                // Since the border is the teacher color usually, but here the teacher is fixed.
                // Let's stick to the Teacher Color to show "This is YOUR lesson".
                const teacherColor = selectedTeacher?.color || '#6366f1';

                return (
                  <div
                    key={`t_unassigned_${idx}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, {
                      type: 'UNASSIGNED_LESSON',
                      subjectId: item.subjectId,
                      teacherId: item.teacherId,
                      classGroupId: item.classGroupId,
                      assignmentType: item.assignmentType,
                      duration: 1
                    })}
                    onDragEnd={handleDragEnd}
                    className="bg-white border-l-4 border-gray-200 p-3 rounded shadow-sm cursor-move hover:shadow-md transition-all active:scale-95 select-none"
                    style={{ borderLeftColor: teacherColor }}
                  >
                    <div className="font-semibold text-gray-800 text-sm">
                      {subject?.name}
                      <span className="text-[10px] text-indigo-600 ml-1 bg-indigo-50 px-1 rounded border border-indigo-100">
                        {item.assignmentType}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex justify-between mt-1 items-center">
                      <span className="font-bold text-gray-700 bg-gray-100 px-1.5 rounded">{classGroup?.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Инструменти</div>
            <button
              onClick={handleGenerateVariant}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors w-full"
              title="Генерирай нов вариант на разписанието"
            >
              <BrainCircuit size={16} />
              <span className="hidden sm:inline">Генерирай Вариант</span>
            </button>
            <div className="w-full h-px bg-gray-100 my-1"></div>

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

        {viewMode === 'overview' ? (
          // --- OVERVIEW MODE GRID ---
          <div className="flex flex-col h-full overflow-hidden">
            <div className="bg-white rounded-t-xl shadow border border-gray-200 overflow-auto flex-1 relative">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="p-2 border-r border-b text-left text-[10px] font-bold text-gray-500 w-16 sticky left-0 bg-gray-50 z-30">Клас</th>
                    {DAYS.map((day) => (
                      <th key={day} className="border-r border-b text-center text-[10px] font-bold text-gray-700 min-w-[300px]" colSpan={periods.length}>
                        {day}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="sticky left-0 bg-gray-50 z-30 border-r border-b"></th>
                    {DAYS.map((day) => (
                      periods.map((p, pi) => (
                        <th key={`${day}-${pi}`} className="border-r border-b text-center text-[9px] text-gray-400 font-medium px-1 w-10">
                          {pi + 1}
                        </th>
                      ))
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((cls) => {
                    const isSelected = selectedClassId === cls.id;
                    return (
                      <tr
                        key={cls.id}
                        onClick={() => {
                          setSelectedClassId(cls.id);
                          // Close modal so the sidebar updates to this class immediately
                          setSuggestionModal(null);
                        }}
                        className={`group hover:bg-gray-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/30' : ''} ${draggedItem?.classGroupId === cls.id ? 'bg-green-50/50 ring-2 ring-emerald-400 ring-inset z-20 shadow-md' : ''}`}
                      >
                        <td className={`p-1 border-r border-b text-xs font-bold sticky left-0 bg-white z-10 group-hover:bg-gray-50 ${isSelected ? '!bg-indigo-50' : ''}`}>
                          <div className={`p-0.5 rounded ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>{cls.name}</div>
                        </td>

                        {DAYS.map((dayName, dIndex) => (
                          periods.map((_, pIndex) => {
                            // Find schedule items
                            const cellItems = schedule.filter(s =>
                              s.dayIndex === dIndex &&
                              s.periodIndex === pIndex &&
                              s.classGroupId === cls.id
                            );

                            // Visualization Logic for Dragging
                            const conflictReason = conflictSlots[`${dIndex}-${pIndex}`];
                            const isDraggingForThisRow = draggedItem?.classGroupId === cls.id;

                            let cellClasses = "border-r border-b p-0.5 h-10 w-10 relative align-top transition-colors ";

                            if (isDraggingForThisRow) {
                              if (conflictReason) {
                                cellClasses += "bg-red-50 hover:bg-red-100 "; // Invalid slot
                              } else {
                                cellClasses += "bg-green-50 hover:bg-green-100 "; // Valid slot
                              }
                            } else {
                              // --- NEW STYLING LOGIC ---
                              cellClasses += "hover:bg-indigo-50 "; // Hover effect

                              // Last column of the day: darker gray separator
                              if (pIndex === periods.length - 1) {
                                cellClasses += "bg-gray-300 ";
                              }
                              // Alternating columns: light gray
                              else if (pIndex % 2 !== 0) {
                                cellClasses += "bg-gray-100 ";
                              }
                              // Default white (transparent)
                            }

                            return (
                              <td
                                key={`${dIndex}-${pIndex}`}
                                className={cellClasses + (!draggedItem ? 'cursor-pointer ring-inset hover:ring-1 hover:ring-indigo-200 z-0' : '')}
                                onClick={(e) => {
                                  if (!draggedItem && cellItems.length === 0) {
                                    e.stopPropagation();
                                    setSuggestionModal({
                                      isOpen: true,
                                      dayIndex: dIndex,
                                      periodIndex: pIndex,
                                      classGroupId: cls.id
                                    });
                                  }
                                }}
                                onDragOver={(e) => handleDragOver(e, !!conflictReason, dIndex, pIndex)}
                                onDrop={(e) => {
                                  if (draggedItem?.classGroupId === cls.id) {
                                    handleDrop(e, dIndex, pIndex);
                                  }
                                }}
                              >
                                {cellItems.map(item => {
                                  const subject = subjects.find(s => s.id === item.subjectId);
                                  const teacher = teachers.find(t => t.id === item.teacherId);
                                  const teacherColor = teacher?.color || '#e0e7ff';
                                  const teacherInitials = teacher?.name.split(' ').map(n => n[0]).join('') || '?';

                                  const isSameTeacher = draggedItem?.teacherId === item.teacherId;

                                  return (
                                    <div
                                      key={item.id}
                                      draggable={!item.locked}
                                      onDragStart={(e) => !item.locked && handleDragStart(e, {
                                        type: 'SCHEDULED_LESSON',
                                        subjectId: item.subjectId,
                                        teacherId: item.teacherId,
                                        classGroupId: item.classGroupId,
                                        duration: 1,
                                        scheduleId: item.id,
                                        assignmentType: item.assignmentType,
                                        origin: { dayIndex: dIndex, periodIndex: pIndex }
                                      })}
                                      onDragEnd={handleDragEnd}
                                      className={`w-full h-full rounded-[2px] shadow-sm flex items-center justify-center overflow-hidden cursor-move text-[8px] leading-none text-center relative group/item ${isSameTeacher ? 'ring-2 ring-red-600 ring-offset-1 z-10' : ''}`}
                                      style={{ backgroundColor: item.locked ? '#f3f4f6' : teacherColor }}
                                      title={`${subject?.name} (${teacher?.name})`}
                                    >
                                      {/* Mini block representation */}
                                      <div className="transform scale-[0.8] origin-center font-bold text-gray-800 truncate px-0.5 pointer-events-none">
                                        {subject?.name.substring(0, 3)}
                                      </div>

                                      {!item.locked && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); removeScheduleItem(item.id); }}
                                          className="absolute -top-[2px] -right-[2px] w-3 h-3 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:bg-red-600 shadow-sm z-10"
                                          title="Премахни"
                                        >
                                          &times;
                                        </button>
                                      )}
                                    </div>
                                  )
                                })}
                              </td>
                            );
                          })
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* BOTTOM DOCK */}
            <div className="h-40 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 flex flex-col z-40">
              <div className="text-xs font-bold text-gray-500 uppercase flex justify-between items-center mb-2">
                <span>Банка: {selectedClass?.name || 'Избери клас'}</span>
                <span className="text-gray-400 font-normal">Плъзнете час към съответния ред в таблицата</span>
              </div>
              <div className="flex-1 overflow-x-auto flex gap-2 items-center p-1">
                {!selectedClass && <div className="text-gray-400 text-sm italic w-full text-center">Кликнете върху име на клас от таблицата...</div>}
                {selectedClass && unassignedLessons.map((item, idx) => {
                  const subject = subjects.find(s => s.id === item.subjectId);
                  const teacher = teachers.find(t => t.id === item.teacherId);
                  const teacherColor = teacher?.color || '#e0e7ff';
                  return (
                    <div
                      key={`dock_${idx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, {
                        type: 'UNASSIGNED_LESSON',
                        subjectId: item.subjectId,
                        teacherId: item.teacherId,
                        classGroupId: item.classGroupId,
                        assignmentType: item.assignmentType,
                        duration: 1
                      })}
                      onDragEnd={handleDragEnd}
                      className="min-w-[140px] h-24 bg-white border border-gray-200 rounded-lg shadow-sm p-2 flex flex-col justify-between cursor-move hover:shadow-md hover:-translate-y-1 transition-all border-l-4"
                      style={{ borderLeftColor: teacherColor }}
                    >
                      <div>
                        <div className="font-bold text-xs text-gray-800 line-clamp-2">{subject?.name}</div>
                        <div className="text-[10px] text-gray-500 mt-1">{teacher?.name}</div>
                      </div>
                      <div className="text-[10px] bg-gray-100 self-start px-1 rounded text-gray-600">{item.assignmentType}</div>
                    </div>
                  )
                })}
                {selectedClass && unassignedLessons.length === 0 && (
                  <div className="text-green-600 text-sm font-medium w-full text-center">Всички часове са разпределени! ✅</div>
                )}
              </div>
            </div>

            {/* Trash Zone */}
            {draggedItem?.type === 'SCHEDULED_LESSON' && (
              <div
                className="absolute right-4 top-4 bottom-4 w-24 border-2 border-dashed border-red-300 bg-red-50 rounded-lg flex flex-col items-center justify-center text-red-500 cursor-pointer animate-in fade-in zoom-in-50"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedItem.scheduleId) {
                    removeScheduleItem(draggedItem.scheduleId);
                    handleDragEnd();
                  }
                }}
              >
                <Ban size={20} />
                <span className="text-[10px] font-bold mt-1">Изтрий</span>
              </div>
            )}
          </div>
        ) : (
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
                      // In teacher view, we might have MULTIPLE lessons (merged classes)
                      const items = allItemsInSlot.filter(s => s.teacherId === selectedTeacherId);
                      if (items.length > 0) {
                        cellItem = items[0]; // Primary item for main logic
                      }
                      // We will render ALL of them later
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

                    // RENDER CONTENT
                    if (viewMode === 'teacher') {
                      // Teacher View Stacked Rendering
                      const items = allItemsInSlot.filter(s => s.teacherId === selectedTeacherId);

                      if (items.length === 0) {
                        // Empty slot rendering (drag target)
                        return (
                          <div
                            key={`${dIndex}-${pIndex}`}
                            onDragOver={(e) => handleDragOver(e, isConflictSlot, dIndex, pIndex)}
                            onDrop={(e) => handleDrop(e, dIndex, pIndex)}
                            className={cellClasses + " h-full w-full relative"}
                            title={conflictReason || ''}
                          >
                            {/* Detailed Conflict Tooltip */}
                            {isDragActive && isConflictSlot && hoveredSlot?.d === dIndex && hoveredSlot?.p === pIndex && (
                              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-50 p-1 text-center animate-in zoom-in-95 border-2 border-red-200 shadow-lg rounded-lg">
                                <Ban className="text-red-500 mb-1" size={20} />
                                <span className="text-[10px] font-bold text-red-700 leading-tight select-none">
                                  {conflictReason}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${dIndex}-${pIndex}`}
                          onDragOver={(e) => handleDragOver(e, isConflictSlot, dIndex, pIndex)}
                          onDrop={(e) => handleDrop(e, dIndex, pIndex)}
                          className={cellClasses + " flex flex-col gap-1 overflow-hidden relative"}
                          title={conflictReason || ''}
                        >
                          {/* Detailed Conflict Tooltip */}
                          {isDragActive && isConflictSlot && hoveredSlot?.d === dIndex && hoveredSlot?.p === pIndex && (
                            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-50 p-1 text-center animate-in zoom-in-95 border-2 border-red-200 shadow-lg rounded-lg">
                              <Ban className="text-red-500 mb-1" size={20} />
                              <span className="text-[10px] font-bold text-red-700 leading-tight select-none">
                                {conflictReason}
                              </span>
                            </div>
                          )}
                          {items.map((exItem, idx) => {
                            const exClass = classes.find(c => c.id === exItem.classGroupId);
                            const exSubject = subjects.find(s => s.id === exItem.subjectId);
                            const exColor = teachers.find(t => t.id === exItem.teacherId)?.color;

                            return (
                              <div
                                key={exItem.id}
                                draggable={!exItem.locked}
                                onDragStart={(e) => !exItem.locked && handleDragStart(e, {
                                  type: 'SCHEDULED_LESSON',
                                  subjectId: exItem.subjectId,
                                  teacherId: exItem.teacherId,
                                  classGroupId: exItem.classGroupId,
                                  duration: 1,
                                  scheduleId: exItem.id,
                                  assignmentType: exItem.assignmentType,
                                  origin: { dayIndex: dIndex, periodIndex: pIndex }
                                })}
                                onDragEnd={handleDragEnd}
                                className={`text-[10px] p-1 border rounded shadow-sm cursor-move hover:shadow-md relative group flex-1 ${exItem.locked ? 'bg-gray-100 border-gray-300' : 'bg-white'}`}
                                style={!exItem.locked && exColor ? { backgroundColor: exColor + '40', borderColor: exColor } : undefined}
                              >
                                <div className="font-bold truncate leading-tight">{exSubject?.name}</div>
                                <div className="flex justify-between items-center mt-0.5">
                                  <span className="bg-white/50 px-1 rounded border border-black/5 font-bold">{exClass?.name}</span>
                                  {exItem.assignmentType && <span className="text-[9px] opacity-70">{exItem.assignmentType}</span>}
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeScheduleItem(exItem.id); }}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110 items-center justify-center hidden group-hover:flex"
                                  title="Премахни"
                                  style={{ width: '16px', height: '16px' }}
                                >
                                  &times;
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      );

                    } else {
                      // CLASS VIEW RENDERING (Standard)
                      let itemClasses = `h-full w-full border p-2 flex flex-col justify-between shadow-sm group relative z-10 `;
                      const itemTeacher = teachers.find(t => t.id === cellItem?.teacherId);
                      const itemColor = itemTeacher?.color;

                      if (cellItem?.locked) {
                        itemClasses += 'border-gray-300 bg-gray-50 cursor-not-allowed ';
                      } else {
                        if (!itemColor) {
                          itemClasses += 'border-indigo-100 bg-indigo-50/80 ';
                        } else {
                          itemClasses += 'border-black/5 '; // Subtle border for colored items
                        }
                        itemClasses += 'cursor-move hover:shadow-md ';
                      }

                      // Apply connection styles
                      if (isConnectedTop) {
                        itemClasses += 'rounded-t-none border-t-0 pt-4 ';
                      } else {
                        itemClasses += 'rounded-t-lg ';
                      }

                      if (isConnectedBottom) {
                        itemClasses += 'rounded-b-none border-b-dashed border-b-gray-400/30 pb-4 ';
                      } else {
                        itemClasses += 'rounded-b-lg ';
                      }

                      return (
                        <div
                          key={`${dIndex}-${pIndex}`}
                          onDragOver={(e) => handleDragOver(e, isConflictSlot, dIndex, pIndex)}
                          onDrop={(e) => handleDrop(e, dIndex, pIndex)}
                          className={cellClasses}
                          title={conflictReason || ''}
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
                              style={itemColor && !cellItem.locked ? { backgroundColor: itemColor } : undefined}
                              onDragStart={(e) => !cellItem.locked && handleDragStart(e, {
                                type: 'SCHEDULED_LESSON',
                                subjectId: cellItem.subjectId,
                                teacherId: cellItem.teacherId,
                                classGroupId: cellItem.classGroupId,
                                duration: 1,
                                scheduleId: cellItem.id,
                                assignmentType: cellItem.assignmentType,
                                origin: { dayIndex: dIndex, periodIndex: pIndex }
                              })}
                              onDragEnd={handleDragEnd}
                              className={itemClasses}
                            >
                              <div className="flex justify-between items-start">
                                <span className={`text-xs font-bold ${cellItem.locked ? 'text-gray-600' : 'text-indigo-900'} ${isConnectedTop ? 'opacity-50' : ''}`}>
                                  {subject?.name}
                                  {cellItem.assignmentType && cellItem.assignmentType !== 'ООП' && (
                                    <span className="ml-1 text-[9px] bg-yellow-100 text-yellow-800 px-1 rounded border border-yellow-200" title="Вид подготовка">
                                      {cellItem.assignmentType}
                                    </span>
                                  )}
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
                    }
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
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
        {/* Detailed Suggestion Modal */}
        {suggestionModal && suggestionModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-lg text-gray-800">
                  {classes.find(c => c.id === suggestionModal.classGroupId)?.name} &mdash; {DAYS[suggestionModal.dayIndex]}, {suggestionModal.periodIndex + 1}. час
                </h3>
                <button onClick={() => setSuggestionModal(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto bg-gray-50/50 flex-1">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Налични часове за добавяне (Банка)</h4>

                {unassignedLessons.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">Няма свободни часове за този клас в банката.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {unassignedLessons.map((lesson, idx) => {
                      const subject = subjects.find(s => s.id === lesson.subjectId);
                      const teacher = teachers.find(t => t.id === lesson.teacherId);
                      const teacherColor = teacher?.color || '#e0e7ff';

                      // Check status for THIS slot
                      const conflict = getConflictReason(
                        suggestionModal.dayIndex,
                        suggestionModal.periodIndex,
                        lesson.teacherId,
                        lesson.classGroupId,
                        lesson.subjectId,
                        lesson.assignmentType
                      );

                      let isSwapPossible = false;
                      let swapData = null;

                      if (conflict && conflict.includes('Учителят е зает')) {
                        // Check for swap
                        const conflictingLesson = schedule.find(s =>
                          s.dayIndex === suggestionModal.dayIndex &&
                          s.periodIndex === suggestionModal.periodIndex &&
                          s.teacherId === lesson.teacherId
                        );
                        if (conflictingLesson) {
                          const freeSlots = findFreeSlotsForLesson(conflictingLesson);
                          if (freeSlots.length > 0) {
                            isSwapPossible = true;
                            swapData = { conflictingLesson, targetSlot: freeSlots[0] };
                          }
                        }
                      }

                      return (
                        <div key={idx} className={`border rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2 transition-all ${conflict && !isSwapPossible ? 'opacity-60 grayscale' : 'hover:shadow-md ring-1 ring-transparent hover:ring-indigo-200'}`} style={{ borderLeft: `4px solid ${teacherColor}` }}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-sm text-gray-800">{subject?.name}</div>
                              <div className="text-xs text-gray-500">{teacher?.name}</div>
                            </div>
                            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium">{lesson.assignmentType}</span>
                          </div>

                          <div className="pt-2 mt-auto border-t border-gray-100 flex items-center justify-between">
                            {conflict ? (
                              isSwapPossible ? (
                                <button
                                  onClick={() => {
                                    if (!swapData) return;
                                    const { conflictingLesson, targetSlot } = swapData;
                                    const confClass = classes.find(c => c.id === conflictingLesson.classGroupId);

                                    // Move existing
                                    const displacedRoom = findBestRoom(conflictingLesson.subjectId, conflictingLesson.classGroupId, targetSlot.dayIndex, targetSlot.periodIndex, conflictingLesson.id);

                                    // Find room for NEW
                                    const newRoom = findBestRoom(lesson.subjectId, lesson.classGroupId, suggestionModal.dayIndex, suggestionModal.periodIndex, undefined, [conflictingLesson.id]);

                                    if (!displacedRoom) { alert('Грешка: Няма свободен кабинет за премествания час.'); return; }
                                    if (!newRoom) { alert('Грешка: Няма свободен кабинет за новия час.'); return; }

                                    if (window.confirm(`Потвърдете размяна:\n\n1. Местим ${confClass?.name} (${subjects.find(s => s.id === conflictingLesson.subjectId)?.name}) в ${DAYS[targetSlot.dayIndex]}, ${targetSlot.periodIndex + 1}. час.\n2. Слагаме ${classes.find(c => c.id === suggestionModal.classGroupId)?.name} тук.`)) {
                                      setSchedule(prev => {
                                        const newSched = prev.map(p => p.id === conflictingLesson.id ? { ...p, dayIndex: targetSlot.dayIndex, periodIndex: targetSlot.periodIndex, roomId: displacedRoom.id } : p);
                                        newSched.push({
                                          id: `sched_${Date.now()}`,
                                          classGroupId: lesson.classGroupId,
                                          subjectId: lesson.subjectId,
                                          teacherId: lesson.teacherId,
                                          roomId: newRoom.id,
                                          dayIndex: suggestionModal.dayIndex,
                                          periodIndex: suggestionModal.periodIndex,
                                          locked: false,
                                          assignmentType: lesson.assignmentType
                                        });
                                        return newSched;
                                      });
                                      setSuggestionModal(null);
                                    }
                                  }}
                                  className="w-full py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-bold rounded flex items-center justify-center gap-1"
                                >
                                  <BrainCircuit size={14} /> Размени & Сложи
                                </button>
                              ) : (
                                <div className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                                  <AlertCircle size={12} /> {conflict}
                                </div>
                              )
                            ) : (
                              <button
                                onClick={() => {
                                  const room = findBestRoom(lesson.subjectId, lesson.classGroupId, suggestionModal.dayIndex, suggestionModal.periodIndex);
                                  if (!room) {
                                    const subject = subjects.find(s => s.id === lesson.subjectId);
                                    alert(`Няма свободен кабинет от тип "${subject?.requiresRoomType || 'Стандартен'}"!`);
                                    return;
                                  }
                                  setSchedule(prev => [...prev, {
                                    id: `sched_${Date.now()}`,
                                    classGroupId: lesson.classGroupId,
                                    subjectId: lesson.subjectId,
                                    teacherId: lesson.teacherId,
                                    roomId: room.id,
                                    dayIndex: suggestionModal.dayIndex,
                                    periodIndex: suggestionModal.periodIndex,
                                    locked: false,
                                    assignmentType: lesson.assignmentType
                                  }]);
                                  setSuggestionModal(null);
                                }}
                                className="w-full py-1.5 bg-green-100 text-green-700 hover:bg-green-200 text-xs font-bold rounded flex items-center justify-center gap-1"
                              >
                                <Check size={14} /> Сложи тук
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-3 bg-gray-100 border-t text-xs text-gray-500 text-center">
                Изберете предмет, за да го поставите в този слот. Системата автоматично проверява за конфликти и кабинети.
              </div>
            </div>
          </div>
        )}
      </div>
    </div >
  );
};

export default Scheduler;
