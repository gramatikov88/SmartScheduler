import React, { createContext, useContext, useState, useEffect } from 'react';
import { Teacher, Room, ClassGroup, ScheduleItem, SchoolConfig, Subject, SubjectCategory } from '../types';
import { storageService } from '../services/storageService';
import { DEFAULT_SCHOOL_CONFIG, MOCK_SUBJECTS, DEFAULT_SUBJECT_CATEGORIES } from '../constants';

interface SchoolContextType {
    teachers: Teacher[];
    rooms: Room[];
    classes: ClassGroup[];
    schedule: ScheduleItem[];
    config: SchoolConfig;
    subjects: Subject[];
    subjectCategories: SubjectCategory[];
    setTeachers: (teachers: Teacher[] | ((prev: Teacher[]) => Teacher[])) => void;
    setRooms: (rooms: Room[] | ((prev: Room[]) => Room[])) => void;
    setClasses: (classes: ClassGroup[] | ((prev: ClassGroup[]) => ClassGroup[])) => void;
    setSchedule: (schedule: ScheduleItem[] | ((prev: ScheduleItem[]) => ScheduleItem[])) => void;
    setConfig: (config: SchoolConfig | ((prev: SchoolConfig) => SchoolConfig)) => void;
    setSubjects: (subjects: Subject[] | ((prev: Subject[]) => Subject[])) => void;
    setSubjectCategories: (categories: SubjectCategory[] | ((prev: SubjectCategory[]) => SubjectCategory[])) => void;
    loading: boolean;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [teachers, setTeachersState] = useState<Teacher[]>([]);
    const [rooms, setRoomsState] = useState<Room[]>([]);
    const [classes, setClassesState] = useState<ClassGroup[]>([]);
    const [schedule, setScheduleState] = useState<ScheduleItem[]>([]);
    const [config, setConfigState] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);
    const [subjects, setSubjectsState] = useState<Subject[]>([]);
    const [subjectCategories, setSubjectCategoriesState] = useState<SubjectCategory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [
                    loadedTeachers,
                    loadedRooms,
                    loadedClasses,
                    loadedSchedule,
                    loadedConfig,
                    loadedSubjects,
                    loadedCategories
                ] = await Promise.all([
                    storageService.loadTeachers(),
                    storageService.loadRooms(),
                    storageService.loadClasses(),
                    storageService.loadSchedule(),
                    storageService.loadConfig(),
                    storageService.loadSubjects(),
                    storageService.loadSubjectCategories()
                ]);

                setTeachersState(loadedTeachers);
                setRoomsState(loadedRooms);
                setClassesState(loadedClasses);
                setScheduleState(loadedSchedule);
                setConfigState(loadedConfig);
                setSubjectsState(loadedSubjects);
                setSubjectCategoriesState(loadedCategories);
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const setTeachers = (newTeachers: Teacher[] | ((prev: Teacher[]) => Teacher[])) => {
        setTeachersState(prev => {
            const resolved = typeof newTeachers === 'function' ? (newTeachers as any)(prev) : newTeachers;
            storageService.saveTeachers(resolved);
            return resolved;
        });
    };

    const setRooms = (newRooms: Room[] | ((prev: Room[]) => Room[])) => {
        setRoomsState(prev => {
            const resolved = typeof newRooms === 'function' ? (newRooms as any)(prev) : newRooms;
            storageService.saveRooms(resolved);
            return resolved;
        });
    };

    const setClasses = (newClasses: ClassGroup[] | ((prev: ClassGroup[]) => ClassGroup[])) => {
        setClassesState(prev => {
            const resolved = typeof newClasses === 'function' ? (newClasses as any)(prev) : newClasses;
            storageService.saveClasses(resolved);
            return resolved;
        });
    };

    const setSchedule = (newSchedule: ScheduleItem[] | ((prev: ScheduleItem[]) => ScheduleItem[])) => {
        setScheduleState(prev => {
            const resolved = typeof newSchedule === 'function' ? (newSchedule as any)(prev) : newSchedule;
            storageService.saveSchedule(resolved);
            return resolved;
        });
    };

    const setConfig = (newConfig: SchoolConfig | ((prev: SchoolConfig) => SchoolConfig)) => {
        setConfigState(prev => {
            const resolved = typeof newConfig === 'function' ? (newConfig as any)(prev) : newConfig;
            storageService.saveConfig(resolved);
            return resolved;
        });
    };

    const setSubjects = (newSubjects: Subject[] | ((prev: Subject[]) => Subject[])) => {
        setSubjectsState(prev => {
            const resolved = typeof newSubjects === 'function' ? (newSubjects as any)(prev) : newSubjects;
            storageService.saveSubjects(resolved);
            return resolved;
        });
    };

    const setSubjectCategories = (newCategories: SubjectCategory[] | ((prev: SubjectCategory[]) => SubjectCategory[])) => {
        setSubjectCategoriesState(prev => {
            const resolved = typeof newCategories === 'function' ? (newCategories as any)(prev) : newCategories;
            storageService.saveSubjectCategories(resolved);
            return resolved;
        });
    };

    return (
        <SchoolContext.Provider value={{
            teachers, rooms, classes, schedule, config, subjects, subjectCategories,
            setTeachers, setRooms, setClasses, setSchedule, setConfig, setSubjects, setSubjectCategories,
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
