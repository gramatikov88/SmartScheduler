import { Teacher, Room, ClassGroup, ScheduleItem, SchoolConfig, Subject, SubjectCategory } from '../types';
import { MOCK_TEACHERS, MOCK_ROOMS, MOCK_CLASSES, MOCK_SUBJECTS, DEFAULT_SCHOOL_CONFIG, DEFAULT_SUBJECT_CATEGORIES } from '../constants';

const STORAGE_KEYS = {
    TEACHERS: 'teachers',
    ROOMS: 'rooms',
    CLASSES: 'classes',
    SCHEDULE: 'schedule',
    CONFIG: 'config',
    SUBJECTS: 'subjects',
    SUBJECT_CATEGORIES: 'subject_categories'
};

// Helper to interact with Electron's main process file system API
const fileSystem = window.electronAPI;

export const storageService = {
    // Generic Load
    async load<T>(key: string, defaultValue: T): Promise<T> {
        if (fileSystem) {
            try {
                const data = await fileSystem.readFile(`${key}.json`);
                return data ? JSON.parse(data) : defaultValue;
            } catch (error) {
                console.warn(`Failed to load ${key} from file, falling back to defaults/local storage`, error);
                // Fallback to localStorage if file system fails (e.g. in browser mode)
                const local = localStorage.getItem(key);
                return local ? JSON.parse(local) : defaultValue;
            }
        } else {
            const local = localStorage.getItem(key);
            return local ? JSON.parse(local) : defaultValue;
        }
    },

    // Generic Save
    async save<T>(key: string, data: T): Promise<boolean> {
        if (fileSystem) {
            try {
                await fileSystem.writeFile(`${key}.json`, JSON.stringify(data, null, 2));
                return true;
            } catch (error) {
                console.error(`Failed to save ${key} to file`, error);
                localStorage.setItem(key, JSON.stringify(data));
                return false;
            }
        } else {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        }
    },

    // Specific Loaders
    async loadTeachers(): Promise<Teacher[]> {
        return this.load(STORAGE_KEYS.TEACHERS, MOCK_TEACHERS);
    },
    async loadRooms(): Promise<Room[]> {
        return this.load(STORAGE_KEYS.ROOMS, MOCK_ROOMS);
    },
    async loadClasses(): Promise<ClassGroup[]> {
        return this.load(STORAGE_KEYS.CLASSES, MOCK_CLASSES);
    },
    async loadSchedule(): Promise<ScheduleItem[]> {
        return this.load(STORAGE_KEYS.SCHEDULE, []);
    },
    async loadConfig(): Promise<SchoolConfig> {
        return this.load(STORAGE_KEYS.CONFIG, DEFAULT_SCHOOL_CONFIG);
    },
    async loadSubjects(): Promise<Subject[]> {
        return this.load(STORAGE_KEYS.SUBJECTS, MOCK_SUBJECTS);
    },
    async loadSubjectCategories(): Promise<SubjectCategory[]> {
        return this.load(STORAGE_KEYS.SUBJECT_CATEGORIES, DEFAULT_SUBJECT_CATEGORIES);
    },

    // Specific Savers
    async saveTeachers(teachers: Teacher[]) {
        return this.save(STORAGE_KEYS.TEACHERS, teachers);
    },
    async saveRooms(rooms: Room[]) {
        return this.save(STORAGE_KEYS.ROOMS, rooms);
    },
    async saveClasses(classes: ClassGroup[]) {
        return this.save(STORAGE_KEYS.CLASSES, classes);
    },
    async saveSchedule(schedule: ScheduleItem[]) {
        return this.save(STORAGE_KEYS.SCHEDULE, schedule);
    },
    async saveConfig(config: SchoolConfig) {
        return this.save(STORAGE_KEYS.CONFIG, config);
    },
    async saveSubjects(subjects: Subject[]) {
        return this.save(STORAGE_KEYS.SUBJECTS, subjects);
    },
    async saveSubjectCategories(categories: SubjectCategory[]) {
        return this.save(STORAGE_KEYS.SUBJECT_CATEGORIES, categories);
    }
};
