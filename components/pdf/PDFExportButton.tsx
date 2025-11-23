import React from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { FileDown, Loader2 } from 'lucide-react';
import { ScheduleDocument } from './ScheduleDocument';
import { ScheduleItem, ClassGroup, Teacher, Room, Subject } from '../../types';

interface PDFExportButtonProps {
    type: 'class' | 'teacher' | 'master';
    data?: any; // ClassGroup or Teacher (not needed for master)
    schedule: ScheduleItem[];
    subjects: Subject[];
    teachers: Teacher[];
    rooms: Room[];
    classes: ClassGroup[];
    label: string;
    fileName: string;
    className?: string;
}

export const PDFExportButton: React.FC<PDFExportButtonProps> = ({
    type, data, schedule, subjects, teachers, rooms, classes, label, fileName, className
}) => {
    // Safety check: If type is class/teacher, data MUST be present
    if ((type === 'class' || type === 'teacher') && !data) {
        return (
            <button className={`${className} opacity-50 cursor-not-allowed`} disabled>
                <FileDown size={16} />
                {label}
            </button>
        );
    }

    return (
        <PDFDownloadLink
            document={
                <ScheduleDocument
                    type={type}
                    data={data}
                    schedule={schedule}
                    subjects={subjects}
                    teachers={teachers}
                    rooms={rooms}
                    classes={classes}
                />
            }
            fileName={fileName}
            className={className}
        >
            {({ blob, url, loading, error }) => (
                <button
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${loading ? 'bg-gray-100 text-gray-400 cursor-wait' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                    disabled={loading}
                >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                    {loading ? 'Зареждане...' : label}
                </button>
            )}
        </PDFDownloadLink>
    );
};
