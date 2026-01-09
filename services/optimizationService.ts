import { ScheduleItem, ClassGroup, Teacher, Subject, Room, RoomType } from '../types';
import { getConflictReason, findBestRoom } from '../utils/schedulerUtils';
import { DEFAULT_SCHOOL_CONFIG, DAYS } from '../constants';

const getCurriculumInfo = (lesson: ScheduleItem, classes: ClassGroup[]) => {
    const cls = classes.find(c => c.id === lesson.classGroupId);
    return cls?.curriculum.find(c => c.subjectId === lesson.subjectId && c.assignmentType === lesson.assignmentType); // Match assignment type too strictly? 
    // Actually assignmentType on curriculum item might be undefined if old data.
};

const getBlockPartner = (lesson: ScheduleItem, schedule: ScheduleItem[], classes: ClassGroup[]): ScheduleItem | undefined => {
    // Check if this lesson SHOULD be part of a block
    const curr = getCurriculumInfo(lesson, classes);
    if (!curr?.requiresDoublePeriod) return undefined;

    // Look for adjacent lesson of same type
    // We assume the schedule is currently valid-ish, so the partner is adjacent.
    // Check P-1 and P+1
    return schedule.find(s =>
        s.id !== lesson.id &&
        s.classGroupId === lesson.classGroupId &&
        s.subjectId === lesson.subjectId &&
        s.assignmentType === lesson.assignmentType &&
        s.dayIndex === lesson.dayIndex &&
        (s.periodIndex === lesson.periodIndex - 1 || s.periodIndex === lesson.periodIndex + 1)
    );
};

export const generateScheduleVariant = (
    schedule: ScheduleItem[],
    classes: ClassGroup[],
    teachers: Teacher[],
    subjects: Subject[],
    rooms: Room[],
    iterations: number = 200
): ScheduleItem[] => {
    let newSchedule = [...schedule];
    const TOTAL_PERIODS = DEFAULT_SCHOOL_CONFIG.totalPeriods;

    for (let i = 0; i < iterations; i++) {
        // 1. Pick random lesson
        const idxA = Math.floor(Math.random() * newSchedule.length);
        const lessonA = newSchedule[idxA];
        if (lessonA.locked) continue;

        // 2. Check Block Status
        const partnerA = getBlockPartner(lessonA, newSchedule, classes);
        const isBlockA = !!partnerA;

        // Define the "Unit A" (Lesson A + optional Partner)
        // Ensure consistent ordering (e.g. by period)
        const unitA = isBlockA && partnerA
            ? (lessonA.periodIndex < partnerA.periodIndex ? [lessonA, partnerA] : [partnerA, lessonA])
            : [lessonA];

        // 3. Pick random target
        // If Unit A is block, max start index is TOTAL - 2. If single, max is TOTAL - 1.
        const maxStartIndex = isBlockA ? (TOTAL_PERIODS - 2) : (TOTAL_PERIODS - 1);
        const targetDay = Math.floor(Math.random() * DAYS.length);
        const targetPeriod = Math.floor(Math.random() * (maxStartIndex + 1));

        // Skip if same position
        if (unitA[0].dayIndex === targetDay && unitA[0].periodIndex === targetPeriod) continue;

        // 4. Check what's at Target
        // We need to check collisions for ALL parts of the unit
        // Target slots: 
        //   Block: [targetDay, targetPeriod], [targetDay, targetPeriod+1]
        //   Single: [targetDay, targetPeriod]

        const targetSlots = unitA.map((_, idx) => ({ d: targetDay, p: targetPeriod + idx }));

        // Find existing lessons at these slots for this CLASS
        const collisions = targetSlots.map(slot =>
            newSchedule.find(s => s.dayIndex === slot.d && s.periodIndex === slot.p && s.classGroupId === lessonA.classGroupId)
        ).filter(Boolean) as ScheduleItem[];

        // If simple move (collision list empty)
        if (collisions.length === 0) {
            // Check conflicts for moving Unit A to Empty Slots
            // Exclude Unit A from schedule checks
            const tempSchedule = newSchedule.filter(s => !unitA.some(u => u.id === s.id));

            let possible = true;
            const updates: ScheduleItem[] = [];

            for (let k = 0; k < unitA.length; k++) {
                const u = unitA[k];
                const tD = targetDay;
                const tP = targetPeriod + k;

                const conflict = getConflictReason(tD, tP, u.teacherId, u.classGroupId, u.subjectId, tempSchedule, classes, teachers, subjects, u.assignmentType);
                if (conflict) { possible = false; break; }

                const room = findBestRoom(u.subjectId, u.classGroupId, tD, tP, tempSchedule, rooms, classes, subjects);
                if (!room) { possible = false; break; }

                updates.push({ ...u, dayIndex: tD, periodIndex: tP, roomId: room.id });
            }

            if (possible) {
                // Apply Move
                newSchedule = newSchedule.map(s => {
                    const update = updates.find(up => up.id === s.id);
                    return update || s;
                });
            }
        }
        // If collisions, maybe Swap? 
        // Implementing Block Swaps is complex (Block vs Single, Block vs Block). 
        // For robustness in this iteration, we only swap SINGLE vs SINGLE.
        else if (!isBlockA && collisions.length === 1) {
            const lessonB = collisions[0];
            const partnerB = getBlockPartner(lessonB, newSchedule, classes);

            // Only swap if B is also NOT a block (Single <-> Single swap)
            if (!lessonB.locked && !partnerB) {
                // Try Swap Logic
                const tempSchedule = newSchedule.filter(s => s.id !== lessonA.id && s.id !== lessonB.id);

                // Check A -> B's slot
                const conflictA = getConflictReason(targetDay, targetPeriod, lessonA.teacherId, lessonA.classGroupId, lessonA.subjectId, tempSchedule, classes, teachers, subjects, lessonA.assignmentType);
                // Check B -> A's slot
                const conflictB = getConflictReason(lessonA.dayIndex, lessonA.periodIndex, lessonB.teacherId, lessonB.classGroupId, lessonB.subjectId, tempSchedule, classes, teachers, subjects, lessonB.assignmentType);

                if (!conflictA && !conflictB) {
                    const roomA = findBestRoom(lessonA.subjectId, lessonA.classGroupId, targetDay, targetPeriod, tempSchedule, rooms, classes, subjects);
                    const roomB = findBestRoom(lessonB.subjectId, lessonB.classGroupId, lessonA.dayIndex, lessonA.periodIndex, tempSchedule, rooms, classes, subjects);

                    if (roomA && roomB) {
                        const newA = { ...lessonA, dayIndex: targetDay, periodIndex: targetPeriod, roomId: roomA.id };
                        const newB = { ...lessonB, dayIndex: lessonA.dayIndex, periodIndex: lessonA.periodIndex, roomId: roomB.id };

                        newSchedule = newSchedule.map(s => {
                            if (s.id === newA.id) return newA;
                            if (s.id === newB.id) return newB;
                            return s;
                        });
                    }
                }
            }
        }
    }

    return newSchedule;
};
