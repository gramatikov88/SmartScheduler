import { Teacher, Room, ClassGroup, ScheduleItem, SchoolConfig } from '../types';
import { DEFAULT_SCHOOL_CONFIG, MOCK_TEACHERS, MOCK_ROOMS, MOCK_CLASSES } from '../constants';

const STORAGE_KEYS = {
    TEACHERS: 'teachers',
    ROOMS: 'rooms',
    CLASSES: 'classes',
    SCHEDULE: 'schedule',
    CONFIG: 'school_config',
};

// Helper to check if running in Electron
const isElectron = () => {
    return window.electronAPI !== undefined;
};

export const storageService = {
    async saveTeachers(teachers: Teacher[]) {
        if (isElectron()) {
            await window.electronAPI.writeFile(STORAGE_KEYS.TEACHERS, teachers);
        } else {
            localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
        }
    },

    async loadTeachers(): Promise<Teacher[]> {
        if (isElectron()) {
            const data = await window.electronAPI.readFile(STORAGE_KEYS.TEACHERS);
            return data || MOCK_TEACHERS;
        } else {
            const data = localStorage.getItem(STORAGE_KEYS.TEACHERS);
            return data ? JSON.parse(data) : MOCK_TEACHERS;
        }
    },

    async saveRooms(rooms: Room[]) {
        if (isElectron()) {
            await window.electronAPI.writeFile(STORAGE_KEYS.ROOMS, rooms);
        } else {
            localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
        }
    },

    async loadRooms(): Promise<Room[]> {
        if (isElectron()) {
            const data = await window.electronAPI.readFile(STORAGE_KEYS.ROOMS);
            return data || MOCK_ROOMS;
        } else {
            const data = localStorage.getItem(STORAGE_KEYS.ROOMS);
            return data ? JSON.parse(data) : MOCK_ROOMS;
        }
    },

    async saveClasses(classes: ClassGroup[]) {
        if (isElectron()) {
            await window.electronAPI.writeFile(STORAGE_KEYS.CLASSES, classes);
        } else {
            localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
        }
    },

    async loadClasses(): Promise<ClassGroup[]> {
        if (isElectron()) {
            const data = await window.electronAPI.readFile(STORAGE_KEYS.CLASSES);
            return data || MOCK_CLASSES;
        } else {
            const data = localStorage.getItem(STORAGE_KEYS.CLASSES);
            return data ? JSON.parse(data) : MOCK_CLASSES;
        }
    },

    async saveSchedule(schedule: ScheduleItem[]) {
        if (isElectron()) {
            await window.electronAPI.writeFile(STORAGE_KEYS.SCHEDULE, schedule);
        } else {
            localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(schedule));
        }
    },

    async loadSchedule(): Promise<ScheduleItem[]> {
        if (isElectron()) {
            const data = await window.electronAPI.readFile(STORAGE_KEYS.SCHEDULE);
            return data || [];
        } else {
            const data = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
            return data ? JSON.parse(data) : [];
        }
    },

    async saveConfig(config: SchoolConfig) {
        if (isElectron()) {
            await window.electronAPI.writeFile(STORAGE_KEYS.CONFIG, config);
        } else {
            localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
        }
    },

    async loadConfig(): Promise<SchoolConfig> {
        if (isElectron()) {
            const data = await window.electronAPI.readFile(STORAGE_KEYS.CONFIG);
            return data || DEFAULT_SCHOOL_CONFIG;
        } else {
            const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
            return data ? JSON.parse(data) : DEFAULT_SCHOOL_CONFIG;
        }
    }
};
