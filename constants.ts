
import { Teacher, Room, Subject, ClassGroup, RoomType, SubjectType, SchoolConfig, SubjectCategory } from './types';

export const DAYS = ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък'];

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  startTime: "08:00",
  lessonDuration: 40,
  breakDuration: 10,
  longBreakDuration: 20,
  longBreakAfterPeriod: 3, // After 3rd period
  totalPeriods: 7,
  customBreaks: {}
};

export const DEFAULT_SUBJECT_CATEGORIES: SubjectCategory[] = [
  { id: SubjectType.HUMANITIES, name: 'Хуманитарни' },
  { id: SubjectType.STEM, name: 'STEM' },
  { id: SubjectType.ARTS, name: 'Изкуства' },
  { id: SubjectType.SPORTS, name: 'Спорт' },
  { id: SubjectType.IT, name: 'ИТ' },
];

export const generatePeriods = (config: SchoolConfig): string[] => {
  const periods: string[] = [];
  let [hours, minutes] = config.startTime.split(':').map(Number);
  let currentMinutes = hours * 60 + minutes;

  for (let i = 1; i <= config.totalPeriods; i++) {
    const startMins = currentMinutes;
    const endMins = startMins + config.lessonDuration;
    
    // Format start
    const startH = Math.floor(startMins / 60).toString().padStart(2, '0');
    const startM = (startMins % 60).toString().padStart(2, '0');
    
    // Format end
    const endH = Math.floor(endMins / 60).toString().padStart(2, '0');
    const endM = (endMins % 60).toString().padStart(2, '0');
    
    periods.push(`${startH}:${startM} - ${endH}:${endM}`);

    // Add break logic
    // Priority: 1. Custom Break, 2. Long Break, 3. Standard Break
    let breakTime = config.breakDuration;
    
    if (config.customBreaks[i] !== undefined) {
      breakTime = config.customBreaks[i];
    } else if (i === config.longBreakAfterPeriod) {
      breakTime = config.longBreakDuration;
    }

    currentMinutes = endMins + breakTime;
  }
  return periods;
};

// Mock Data
export const MOCK_SUBJECTS: Subject[] = [
  { id: 'sub_math', name: 'Математика', type: SubjectType.STEM, difficulty: 9 },
  { id: 'sub_bg', name: 'Бълг. език и Литература', type: SubjectType.HUMANITIES, difficulty: 8 },
  { id: 'sub_eng', name: 'Английски език', type: SubjectType.HUMANITIES, difficulty: 7 },
  { id: 'sub_hist', name: 'История', type: SubjectType.HUMANITIES, difficulty: 6 },
  { id: 'sub_it', name: 'Информ. технологии', type: SubjectType.IT, requiresRoomType: RoomType.LAB_IT, difficulty: 5 },
  { id: 'sub_sport', name: 'Физическо', type: SubjectType.SPORTS, requiresRoomType: RoomType.GYM, difficulty: 2 },
  { id: 'sub_phys', name: 'Физика', type: SubjectType.STEM, requiresRoomType: RoomType.LAB_SCIENCE, difficulty: 8 },
];

export const MOCK_TEACHERS: Teacher[] = [
  { 
    id: 't_ivanov', 
    name: 'Иван Иванов', 
    subjects: ['sub_math', 'sub_phys'], 
    maxHoursPerDay: 6, 
    unwantedDays: [],
    constraints: { travels: false, cannotTeachLast: false, maxGaps: 2 }
  },
  { 
    id: 't_petrova', 
    name: 'Мария Петрова', 
    subjects: ['sub_bg', 'sub_hist'], 
    maxHoursPerDay: 5, 
    unwantedDays: [4], // No Fridays
    constraints: { travels: true, cannotTeachLast: true, maxGaps: 1 }
  },
  { 
    id: 't_georgiev', 
    name: 'Георги Георгиев', 
    subjects: ['sub_sport'], 
    maxHoursPerDay: 7, 
    unwantedDays: [],
    constraints: { travels: false, cannotTeachLast: false, maxGaps: 3 }
  },
  { 
    id: 't_dimitrova', 
    name: 'Елена Димитрова', 
    subjects: ['sub_eng'], 
    maxHoursPerDay: 6, 
    unwantedDays: [],
    constraints: { travels: false, cannotTeachLast: false, maxGaps: 2 }
  },
  { 
    id: 't_kolev', 
    name: 'Николай Колев', 
    subjects: ['sub_it'], 
    maxHoursPerDay: 6, 
    unwantedDays: [],
    constraints: { travels: false, cannotTeachLast: false, maxGaps: 2 }
  },
];

export const MOCK_ROOMS: Room[] = [
  { id: 'r_101', name: '101 (Класна стая)', type: RoomType.CLASSROOM, capacity: 30 },
  { id: 'r_102', name: '102 (Класна стая)', type: RoomType.CLASSROOM, capacity: 30 },
  { id: 'r_201', name: '201 (Компютърен)', type: RoomType.LAB_IT, capacity: 15 },
  { id: 'r_gym', name: 'Физкултурен салон', type: RoomType.GYM, capacity: 60 },
  { id: 'r_lab', name: 'Лаборатория', type: RoomType.LAB_SCIENCE, capacity: 20 },
];

export const MOCK_CLASSES: ClassGroup[] = [
  {
    id: 'c_5a',
    name: '5 А',
    studentsCount: 26,
    shift: 1,
    curriculum: [
      { subjectId: 'sub_math', hoursPerWeek: 4, teacherId: 't_ivanov' },
      { subjectId: 'sub_bg', hoursPerWeek: 4, teacherId: 't_petrova' },
      { subjectId: 'sub_it', hoursPerWeek: 2, teacherId: 't_kolev' },
      { subjectId: 'sub_sport', hoursPerWeek: 2, teacherId: 't_georgiev' },
      { subjectId: 'sub_eng', hoursPerWeek: 3, teacherId: 't_dimitrova' },
    ]
  },
  {
    id: 'c_5b',
    name: '5 Б',
    studentsCount: 25,
    shift: 1,
    curriculum: [
      { subjectId: 'sub_math', hoursPerWeek: 4, teacherId: 't_ivanov' },
      { subjectId: 'sub_bg', hoursPerWeek: 4, teacherId: 't_petrova' },
      { subjectId: 'sub_hist', hoursPerWeek: 2, teacherId: 't_petrova' },
      { subjectId: 'sub_sport', hoursPerWeek: 2, teacherId: 't_georgiev' },
    ]
  }
];
