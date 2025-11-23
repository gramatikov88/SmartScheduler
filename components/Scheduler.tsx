
import React, { useState, useRef, useMemo } from 'react';
import { ScheduleItem, ClassGroup, Teacher, Room, Subject, GridSlot, DragItem, RoomType, SchoolConfig } from '../types';
import { DAYS } from '../constants';
import { Lock, Unlock, AlertTriangle, Check, BrainCircuit, Sparkles, Loader2, Ban } from 'lucide-react';
import { analyzeScheduleWithGemini, generateScheduleWithGemini } from '../services/geminiService';

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
  const [conflictSlots, setConflictSlots] = useState<string[]>([]);
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

  // -- Helper: Detect Conflicts --
  const checkConflicts = (day: number, period: number, teacherId: string, currentClassId: string, ignoreScheduleId?: string): boolean => {
    // 1. Teacher is busy elsewhere
    const teacherBusy = schedule.some(s => 
      s.id !== ignoreScheduleId &&
      s.dayIndex === day &&
      s.periodIndex === period &&
      s.teacherId === teacherId
    );

    // 2. Class is busy (shouldn't happen in class view, but good for validation)
    const classBusy = schedule.some(s => 
      s.id !== ignoreScheduleId &&
      s.dayIndex === day &&
      s.periodIndex === period &&
      s.classGroupId === currentClassId
    );

    return teacherBusy || classBusy;
  };

  const getConflictMap = (teacherId: string, currentClassId: string, subjectId: string, ignoreScheduleId?: string) => {
     const conflicts: string[] = [];
     const subject = subjects.find(s => s.id === subjectId);
     const requiredRoomType = subject?.requiresRoomType || RoomType.CLASSROOM;

     for(let d=0; d<DAYS.length; d++) {
       for(let p=0; p<periods.length; p++) {
          // 1. Basic Conflict (Teacher or Class busy)
          if (checkConflicts(d, p, teacherId, currentClassId, ignoreScheduleId)) {
             conflicts.push(`${d}-${p}`);
             continue;
          }

          // 2. Room Availability Check
          // Find if there is AT LEAST ONE room of the required type available at this time
          const hasFreeRoom = rooms.some(r => {
             if (r.type !== requiredRoomType) return false;
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
             conflicts.push(`${d}-${p}`);
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
    setConflictSlots([]);
  };

  const handleDragOver = (e: React.DragEvent, isConflict: boolean) => {
    e.preventDefault(); 
    if (isConflict) {
       e.dataTransfer.dropEffect = 'none';
    } else {
       e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent, dayIndex: number, periodIndex: number) => {
    e.preventDefault();
    if (!draggedItem || !selectedClass) return;

    // Hard Constraint Check: Is the slot actually available?
    const isConflict = checkConflicts(dayIndex, periodIndex, draggedItem.teacherId, draggedItem.classGroupId, draggedItem.scheduleId);
    
    // Find a room (Simplistic allocation: First available room of required type)
    const subject = subjects.find(s => s.id === draggedItem.subjectId);
    const requiredRoomType = subject?.requiresRoomType || RoomType.CLASSROOM;
    
    // Find room not occupied at this time
    const availableRoom = rooms.find(r => {
      if (r.type !== requiredRoomType) return false;
      const isRoomBusy = schedule.some(s => 
        s.id !== draggedItem.scheduleId &&
        s.dayIndex === dayIndex &&
        s.periodIndex === periodIndex &&
        s.roomId === r.id
      );
      return !isRoomBusy && r.capacity >= selectedClass.studentsCount;
    });

    if (isConflict) {
      alert("Конфликт! Този учител или клас вече е зает по това време.");
      return;
    }

    if (!availableRoom) {
      alert(`Няма свободен кабинет тип "${requiredRoomType}" за този час!`);
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

  const handleGeminiAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    const result = await analyzeScheduleWithGemini(schedule, teachers, classes, subjects);
    setAnalysisResult(result);
    setIsAnalyzing(false);
  };

  const handleAutoGenerate = async () => {
    if (schedule.length > 0) {
      if (!window.confirm("Това ще изтрие текущото разписание и ще генерира ново. Сигурни ли сте?")) {
        return;
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

      const newSchedule = await generateScheduleWithGemini(teachers, classes, rooms, subjects, config);
      setSchedule(newSchedule);
      alert(`Успешно генерирани ${newSchedule.length} часа!`);
    } catch (error) {
      alert("Грешка при генерирането. Моля опитайте отново.");
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
                <Loader2 size={18} className="animate-spin"/>
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
               <span className="animate-pulse">Анализиране...</span>
             ) : (
               <>
                 <BrainCircuit size={18} />
                 <span>Анализ на качеството</span>
               </>
             )}
           </button>
        </div>
      </div>

      {/* --- Main Area: Grid --- */}
      <div className="flex-1 overflow-auto p-2 lg:p-6 relative">
        {analysisResult && (
          <div className="mb-6 bg-white p-6 rounded-xl shadow border border-purple-100 animate-in fade-in slide-in-from-top-4">
             <div className="flex justify-between items-start mb-2">
               <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2"><BrainCircuit size={20}/> Анализ на разписанието</h3>
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
                    const room = rooms.find(r => r.id === cellItem?.roomId);

                    // Conflict Visuals
                    const isConflictSlot = conflictSlots.includes(`${dIndex}-${pIndex}`);
                    const isDragActive = !!draggedItem;
                    
                    let cellClasses = "border-r last:border-r-0 relative p-1 transition-all duration-200 ";
                    
                    if (isDragActive) {
                        if (isConflictSlot) {
                            cellClasses += "bg-red-50 ";
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
                        onDragOver={(e) => handleDragOver(e, isConflictSlot)}
                        onDrop={(e) => handleDrop(e, dIndex, pIndex)}
                        className={cellClasses}
                      >
                         {/* Conflict Overlay Icon */}
                         {isDragActive && isConflictSlot && (
                             <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
                                <Ban className="text-red-500/70" size={28} strokeWidth={1.5} />
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
                                    {cellItem.locked ? <Lock size={12}/> : <Unlock size={12} className="opacity-0 group-hover:opacity-100"/>}
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
                                <div className="text-[10px] text-gray-500 bg-white/50 px-1 rounded inline-block mt-1">
                                  Стая {room?.name.split('(')[0]}
                                </div>
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
    </div>
  );
};

export default Scheduler;
