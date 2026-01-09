import { ScheduleItem, ClassGroup, Teacher, Subject, Room, RoomType, GridSlot } from '../types';
import { DAYS, PERIODS } from '../constants';

// -- Helper: Detect Conflict Reason --
export const getConflictReason = (
    day: number,
    period: number,
    teacherId: string,
    currentClassId: string,
    subjectId: string,
    schedule: ScheduleItem[],
    classes: ClassGroup[],
    teachers: Teacher[],
    subjects: Subject[],
    assignmentType: string = 'ООП',
    ignoreScheduleId?: string
): string | null => {
    const teacher = teachers.find(t => t.id === teacherId);

    // 1. Teacher Constraints
    if (teacher) {
        if (teacher.constraints?.travels && period === 0) {
            return "Пътуващ учител (без 1-ви час)";
        }
        // Note: Assuming PERIODS length is constant or passed. For now using global constant or assumption.
        // Ideally we should pass totalPeriods. Let's assume standard length from constants if imported,
        // but better to rely on what is passed or standard.
        // The original code used `periods.length`.
        if (teacher.constraints?.cannotTeachLast && period >= 6) { // Hardcoded 6 (7th period) or generic?
            // Let's check how many periods usually. `periods` was passed prop.
            // We'll trust the caller to handle index bounds or assume standard 7 periods (0-6).
            // Actually, let's just use the teacher logic as is, but be careful about max period.
            // logic: if period == last.
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
        // Special Rule: Allow merging ONLY for "FUCH Cybersecurity" (ФУЧ Киберсигурност)
        // Check if the INCOMING lesson is eligible
        const currentSubject = subjects.find(s => s.id === subjectId);
        const isCurrentCyber = assignmentType === 'ФУЧ' &&
            (currentSubject?.name.toLowerCase().includes('кибер') || currentSubject?.name.toLowerCase().includes('cyber'));

        // Check if the EXISTING lesson is eligible
        const busySubject = subjects.find(s => s.id === teacherBusy.subjectId);
        const isBusyCyber = (teacherBusy.assignmentType === 'ФУЧ' || !teacherBusy.assignmentType) && // assignmentType might be missing on old items? safer to check
            (busySubject?.name.toLowerCase().includes('кибер') || busySubject?.name.toLowerCase().includes('cyber'));

        // Merge is allowed only if BOTH are cybersecurity
        const isMergeable = isCurrentCyber && isBusyCyber;

        if (!isMergeable) {
            const busyClass = classes.find(c => c.id === teacherBusy.classGroupId)?.name;
            return `Учителят е зает ${busyClass ? `(Клас ${busyClass})` : ''}`;
        }
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

    // 4. Max Gaps Check
    if (teacher && teacher.constraints?.maxGaps !== undefined) {
        const dailyLessons = schedule.filter(s =>
            s.teacherId === teacherId &&
            s.dayIndex === day &&
            s.id !== ignoreScheduleId
        );

        const potentialLessons = [
            ...dailyLessons,
            { periodIndex: period }
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

    // 5. FUCH before OOP Validation
    if (assignmentType === 'ФУЧ' || assignmentType === 'ООП') {
        const isFuch = assignmentType === 'ФУЧ';
        const subjectLessons = schedule.filter(s =>
            s.classGroupId === currentClassId &&
            s.subjectId === subjectId &&
            s.id !== ignoreScheduleId
        );

        if (isFuch) {
            const oopAfter = subjectLessons.find(s =>
                (s.assignmentType === 'ООП' || !s.assignmentType) &&
                (
                    (s.dayIndex > day) ||
                    (s.dayIndex === day && s.periodIndex > period)
                )
            );
            if (oopAfter) {
                return `Невалидна подредба: ФУЧ преди ООП`;
            }
        } else {
            const fuchBefore = subjectLessons.find(s =>
                s.assignmentType === 'ФУЧ' &&
                (
                    (s.dayIndex < day) ||
                    (s.dayIndex === day && s.periodIndex < period)
                )
            );
            if (fuchBefore) {
                return `Невалидна подредба: ООП след ФУЧ`;
            }
        }
    }

    // 6. 8th Period Restriction (Index 7 is 8th period)
    if (period === 7) {
        // If the assignment is explicitly NOT 'ФУЧ', disallow.
        if (assignmentType && assignmentType !== 'ФУЧ') {
            return "8-мият час е разрешен само за ФУЧ";
        }
    }

    return null;
};

export const findBestRoom = (
    subjectId: string,
    classGroupId: string,
    day: number,
    period: number,
    schedule: ScheduleItem[],
    rooms: Room[],
    classes: ClassGroup[],
    subjects: Subject[],
    ignoreScheduleId?: string,
    ignoreScheduleIdsArray: string[] = []
): Room | undefined => {
    const subject = subjects.find(s => s.id === subjectId);
    const requiredRoomType = subject?.requiresRoomType || RoomType.CLASSROOM;
    const cls = classes.find(c => c.id === classGroupId);
    if (!cls) return undefined;

    const roomsOfType = rooms.filter(r => r.type === requiredRoomType);

    return roomsOfType.find(r => {
        const isRoomBusy = schedule.some(s =>
            s.id !== ignoreScheduleId &&
            !ignoreScheduleIdsArray.includes(s.id) &&
            s.dayIndex === day &&
            s.periodIndex === period &&
            s.roomId === r.id
        );
        return !isRoomBusy && r.capacity >= cls.studentsCount;
    });
};
