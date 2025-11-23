import React from 'react';
import { ScheduleItem, ClassGroup, Teacher, Room, Subject } from '../types';
import { DAYS } from '../constants';

interface PrintableScheduleProps {
    mode: 'class' | 'master';
    selectedClassId?: string;
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
            <div key={cls.id} className="page-break mb-8">
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-900">Седмично Разписание - {cls.name}</h1>
                    <p className="text-gray-600">Учебна година {new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
                </div>

                <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 p-2 w-16">Час</th>
                            {DAYS.map(day => (
                                <th key={day} className="border border-gray-300 p-2">{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {periods.map((periodLabel, pIndex) => (
                            <tr key={pIndex}>
                                <td className="border border-gray-300 p-2 font-bold text-center bg-gray-50">
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
                                        <td key={dIndex} className="border border-gray-300 p-2 text-center h-16 align-middle">
                                            {item ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-gray-900">{subject?.name}</span>
                                                    <span className="text-xs text-gray-600">{teacher?.name}</span>
                                                    <span className="text-[10px] text-gray-500 italic">[{room?.name}]</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="mt-4 text-right text-xs text-gray-400">
                    SmartScheduler • Генерирано на {new Date().toLocaleDateString('bg-BG')}
                </div>
            </div>
        );
    };

    // Filter classes based on mode
    const classesToPrint = mode === 'master'
        ? classes
        : classes.filter(c => c.id === selectedClassId);

    return (
        <div className="p-8 bg-white">
            {mode === 'master' && (
                <div className="text-center mb-12 page-break">
                    <h1 className="text-4xl font-bold text-indigo-900 mb-4">УЧИЛИЩНА ПРОГРАМА</h1>
                    <p className="text-xl text-gray-600">Обобщено разписание за всички класове</p>
                </div>
            )}

            {classesToPrint.map(cls => renderClassTable(cls))}
        </div>
    );
};
