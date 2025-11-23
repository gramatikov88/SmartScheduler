import React, { createContext, useContext, useState, useEffect } from 'react';
import { Teacher, Room, ClassGroup, ScheduleItem, SchoolConfig } from '../types';
import { storageService } from '../services/storageService';
import { DEFAULT_SCHOOL_CONFIG } from '../constants';

interface SchoolContextType {
    teachers: Teacher[];
    rooms: Room[];
    classes: ClassGroup[];
    schedule: ScheduleItem[];
    config: SchoolConfig;
    setTeachers: (teachers: Teacher[]) => void;
    setRooms: (rooms: Room[]) => void;
    setClasses: (classes: ClassGroup[]) => void;
    setSchedule: (schedule: ScheduleItem[]) => void;
    setConfig: (config: SchoolConfig) => void;
    loading: boolean;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [teachers, setTeachersState] = useState<Teacher[]>([]);
    const [rooms, setRoomsState] = useState<Room[]>([]);
    const [classes, setClassesState] = useState<ClassGroup[]>([]);
    const [schedule, setScheduleState] = useState<ScheduleItem[]>([]);
    const [config, setConfigState] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [loadedTeachers, loadedRooms, loadedClasses, loadedSchedule, loadedConfig] = await Promise.all([
                    storageService.loadTeachers(),
                    storageService.loadRooms(),
                    storageService.loadClasses(),
                    storageService.loadSchedule(),
                    storageService.loadConfig()
                ]);

                setTeachersState(loadedTeachers);
                setRoomsState(loadedRooms);
                setClassesState(loadedClasses);
                setScheduleState(loadedSchedule);
                setConfigState(loadedConfig);
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const setTeachers = (newTeachers: Teacher[]) => {
        setTeachersState(newTeachers);
        storageService.saveTeachers(newTeachers);
    };

    const setRooms = (newRooms: Room[]) => {
        setRoomsState(newRooms);
        storageService.saveRooms(newRooms);
    };

    const setClasses = (newClasses: ClassGroup[]) => {
        setClassesState(newClasses);
        storageService.saveClasses(newClasses);
    };

    const setSchedule = (newSchedule: ScheduleItem[]) => {
        setScheduleState(newSchedule);
        storageService.saveSchedule(newSchedule);
    };

    const setConfig = (newConfig: SchoolConfig) => {
        setConfigState(newConfig);
        storageService.saveConfig(newConfig);
    };

    return (
        <SchoolContext.Provider value={{
            teachers, rooms, classes, schedule, config,
            setTeachers, setRooms, setClasses, setSchedule, setConfig,
            loading
        }}>
            {children}
        </SchoolContext.Provider>
    );
};

export const useSchool = () => {
    const context = useContext(SchoolContext);
    if (context === undefined) {
        throw new Error('useSchool must be used within a SchoolContextProvider');
    }
    return context;
};
