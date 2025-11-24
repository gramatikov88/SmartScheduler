import React from 'react';
import { ScheduleItem, ClassGroup, Teacher, Room, Subject } from '../types';
import { DAYS } from '../constants';

interface PrintableScheduleProps {
    mode: 'class' | 'master' | 'teacher' | 'teachers_master';
    selectedClassId?: string;
    selectedTeacherId?: string;
    schedule: ScheduleItem[];
    classes: ClassGroup[];
    teachers: Teacher[];
    subjects: Subject[];
    rooms: Room[];
    periods: string[];
}

export const PrintableSchedule: React.FC<PrintableScheduleProps> = ({
    mode,
    selectedClassId,
    selectedTeacherId,
    schedule,
    classes,
    teachers,
    subjects,
    rooms,
    periods
}) => {

    // Helper to render a single class table
    const renderClassTable = (cls: ClassGroup) => {
        return (
            <div key={cls.id} className="page-break mb-8 p-4" style={{ backgroundColor: '#ffffff' }}>
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Седмично Разписание - {cls.name}</h1>
                    <p style={{ color: '#4b5563' }}>Учебна година {new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
                </div>

                <table className="w-full border-collapse border border-gray-300 text-sm" style={{ borderColor: '#d1d5db' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f3f4f6' }}>
                            <th className="border p-2 w-16" style={{ borderColor: '#d1d5db', color: '#111827' }}>Час</th>
                            {DAYS.map(day => (
                                <th key={day} className="border p-2" style={{ borderColor: '#d1d5db', color: '#111827' }}>{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {periods.map((periodLabel, pIndex) => (
                            <tr key={pIndex}>
                                <td className="border p-2 font-bold text-center" style={{ borderColor: '#d1d5db', backgroundColor: '#f9fafb', color: '#111827' }}>
                                    {periodLabel}
                                </td>
                                {DAYS.map((_, dIndex) => {
                                    const item = schedule.find(s =>
                                        s.classGroupId === cls.id &&
                                        s.dayIndex === dIndex &&
                                        s.periodIndex === pIndex
                                    );

                                    const subject = subjects.find(s => s.id === item?.subjectId);
                                    const teacher = teachers.find(t => t.id === item?.teacherId);
                                    const room = rooms.find(r => r.id === item?.roomId);

                                    return (
                                        <td key={dIndex} className="border p-2 text-center h-16 align-middle" style={{ borderColor: '#d1d5db' }}>
                                            {item ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold" style={{ color: '#111827' }}>{subject?.name}</span>
                                                    <span className="text-xs" style={{ color: '#4b5563' }}>{teacher?.name}</span>
                                                    <span className="text-[10px] italic" style={{ color: '#6b7280' }}>[{room?.name}]</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#d1d5db' }}>-</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="mt-4 text-right text-xs" style={{ color: '#9ca3af' }}>
                    SmartScheduler • Генерирано на {new Date().toLocaleDateString('bg-BG')}
                </div>
            </div>
        );
    };

    // Helper to render a single teacher table
    const renderTeacherTable = (teacher: Teacher) => {
        return (
            <div key={teacher.id} className="page-break mb-8 p-4" style={{ backgroundColor: '#ffffff' }}>
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Седмично Разписание - {teacher.name}</h1>
                    <p style={{ color: '#4b5563' }}>Учебна година {new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
                </div>

                <table className="w-full border-collapse border border-gray-300 text-sm" style={{ borderColor: '#d1d5db' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f3f4f6' }}>
                            <th className="border p-2 w-16" style={{ borderColor: '#d1d5db', color: '#111827' }}>Час</th>
                            {DAYS.map(day => (
                                <th key={day} className="border p-2" style={{ borderColor: '#d1d5db', color: '#111827' }}>{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {periods.map((periodLabel, pIndex) => (
                            <tr key={pIndex}>
                                <td className="border p-2 font-bold text-center" style={{ borderColor: '#d1d5db', backgroundColor: '#f9fafb', color: '#111827' }}>
                                    {periodLabel}
                                </td>
                                {DAYS.map((_, dIndex) => {
                                    const item = schedule.find(s =>
                                        s.teacherId === teacher.id &&
                                        s.dayIndex === dIndex &&
                                        s.periodIndex === pIndex
                                    );

                                    const subject = subjects.find(s => s.id === item?.subjectId);
                                    const cls = classes.find(c => c.id === item?.classGroupId);
                                    const room = rooms.find(r => r.id === item?.roomId);

                                    return (
                                        <td key={dIndex} className="border p-2 text-center h-16 align-middle" style={{ borderColor: '#d1d5db' }}>
                                            {item ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold" style={{ color: '#111827' }}>{subject?.name}</span>
                                                    <span className="text-xs" style={{ color: '#4b5563' }}>{cls?.name}</span>
                                                    <span className="text-[10px] italic" style={{ color: '#6b7280' }}>[{room?.name}]</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#d1d5db' }}>-</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="mt-4 text-right text-xs" style={{ color: '#9ca3af' }}>
                    SmartScheduler • Генерирано на {new Date().toLocaleDateString('bg-BG')}
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 min-w-[1000px]" style={{ backgroundColor: '#ffffff' }}>
            {mode === 'master' && (
                <div className="text-center mb-12 page-break">
                    <h1 className="text-4xl font-bold mb-4" style={{ color: '#312e81' }}>УЧИЛИЩНА ПРОГРАМА (КЛАСОВЕ)</h1>
                    <p className="text-xl" style={{ color: '#4b5563' }}>Обобщено разписание за всички класове</p>
                </div>
            )}

            {mode === 'teachers_master' && (
                <div className="text-center mb-12 page-break">
                    <h1 className="text-4xl font-bold mb-4" style={{ color: '#312e81' }}>УЧИЛИЩНА ПРОГРАМА (УЧИТЕЛИ)</h1>
                    <p className="text-xl" style={{ color: '#4b5563' }}>Обобщено разписание за всички учители</p>
                </div>
            )}

            {/* Render logic based on mode */}
            {mode === 'class' && selectedClassId && classes.filter(c => c.id === selectedClassId).map(renderClassTable)}
            {mode === 'master' && classes.map(renderClassTable)}

            {mode === 'teacher' && selectedTeacherId && teachers.filter(t => t.id === selectedTeacherId).map(renderTeacherTable)}
            {mode === 'teachers_master' && teachers.map(renderTeacherTable)}
        </div>
    );
};
