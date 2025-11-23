
export enum SubjectType {
  HUMANITIES = 'Humanities',
  STEM = 'STEM',
  ARTS = 'Arts',
  SPORTS = 'Sports',
  IT = 'IT'
}

export interface SubjectCategory {
  id: string;
  name: string;
}

export enum RoomType {
  CLASSROOM = 'Classroom',
  LAB_IT = 'IT Lab',
  GYM = 'Gym',
  LAB_SCIENCE = 'Science Lab'
}

export interface SchoolConfig {
  startTime: string; // "08:00"
  lessonDuration: number; // minutes
  breakDuration: number; // minutes
  longBreakDuration: number; // minutes
  longBreakAfterPeriod: number; // period index (1-based) after which long break occurs
  totalPeriods: number;
  customBreaks: Record<number, number>; // Key: Period index (after which break occurs), Value: minutes
}

export interface TeacherConstraints {
  travels: boolean; // Cannot have 1st period
  cannotTeachLast: boolean; // Cannot have last period
  maxGaps: number; // Max empty slots between lessons
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[]; // Subject IDs
  maxHoursPerDay: number;
  unwantedDays: number[]; // 0=Mon, 4=Fri
  constraints: TeacherConstraints;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
}

export interface Subject {
  id: string;
  name: string;
  type: string; // Now a string to allow dynamic categories (SubjectCategory.id)
  requiresRoomType?: RoomType; // If null, standard classroom
  difficulty: number; // 1-10, for soft constraint logic
}

export interface ClassGroup {
  id: string;
  name: string; // e.g. "12A"
  studentsCount: number;
  shift: 1 | 2; // 1 = Morning, 2 = Afternoon
  curriculum: {
    subjectId: string;
    hoursPerWeek: number;
    teacherId: string; // Pre-assigned teacher for this class/subject
  }[];
}

export interface ScheduleItem {
  id: string;
  classGroupId: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
  dayIndex: number; // 0-4 (Mon-Fri)
  periodIndex: number; // 0-6 (1st - 7th hour)
  locked: boolean;
}

export interface GridSlot {
  dayIndex: number;
  periodIndex: number;
}

// Drag item payload
export interface DragItem {
  type: 'UNASSIGNED_LESSON' | 'SCHEDULED_LESSON';
  subjectId: string;
  teacherId: string;
  classGroupId: string;
  duration: number;
  origin?: GridSlot; // If moved from grid
  scheduleId?: string; // If existing
}
