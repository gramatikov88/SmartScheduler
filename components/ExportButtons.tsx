import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FileDown, Loader2, Users, User, School } from 'lucide-react';
import { ScheduleItem, ClassGroup, Teacher, Room, Subject } from '../types';
import { PrintableSchedule } from './PrintableSchedule';
import { createRoot } from 'react-dom/client';

interface ExportButtonsProps {
    schedule: ScheduleItem[];
    classes: ClassGroup[];
    teachers: Teacher[];
    subjects: Subject[];
    rooms: Room[];
    periods: string[];
    selectedClassId?: string;
    selectedTeacherId?: string;
    viewMode: 'class' | 'teacher';
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
    schedule, classes, teachers, subjects, rooms, periods, selectedClassId, selectedTeacherId, viewMode
}) => {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (mode: 'class' | 'master' | 'teacher' | 'teachers_master') => {
        setIsExporting(true);
        try {
            // 1. Create a temporary container for rendering
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            container.style.width = '1200px'; // Fixed width for consistent scaling
            document.body.appendChild(container);

            // 2. Render the PrintableSchedule into the container
            const root = createRoot(container);

            // We need to wait for React to render
            await new Promise<void>((resolve) => {
                root.render(
                    <PrintableSchedule
                        mode={mode}
                        selectedClassId={selectedClassId}
                        selectedTeacherId={selectedTeacherId}
                        schedule={schedule}
                        classes={classes}
                        teachers={teachers}
                        subjects={subjects}
                        rooms={rooms}
                        periods={periods}
                    />
                );
                // Give it a moment to render
                setTimeout(resolve, 1000); // Increased timeout to ensure full render
            });

            // 3. Find all "page-break" elements (each schedule)
            const pages = container.querySelectorAll('.page-break');

            if (pages.length === 0) {
                alert('Няма данни за експортиране!');
                return;
            }

            // 4. Initialize PDF
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // 5. Loop through pages and add to PDF
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i] as HTMLElement;

                if (i > 0) pdf.addPage();

                const canvas = await html2canvas(page, {
                    scale: 2, // Higher scale for better quality
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            // 6. Save
            let filename = 'schedule.pdf';
            if (mode === 'master') filename = 'uchilishtna-programa-vsichki-klasove.pdf';
            else if (mode === 'teachers_master') filename = 'uchilishtna-programa-uchiteli.pdf';
            else if (mode === 'class' && selectedClassId) {
                const cls = classes.find(c => c.id === selectedClassId);
                filename = `programa-${cls?.name || 'klas'}.pdf`;
            } else if (mode === 'teacher' && selectedTeacherId) {
                const teacher = teachers.find(t => t.id === selectedTeacherId);
                filename = `programa-${teacher?.name || 'uchitel'}.pdf`;
            }

            pdf.save(filename);

            // Cleanup
            root.unmount();
            document.body.removeChild(container);

        } catch (error: any) {
            console.error('Export failed:', error);
            alert(`Възникна грешка при експортирането: ${error.message || error}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-wrap gap-2 justify-center">
            {/* Current View Export */}
            {viewMode === 'class' && selectedClassId && (
                <button
                    onClick={() => handleExport('class')}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                    {isExporting ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                    Експорт Клас (PDF)
                </button>
            )}

            {viewMode === 'teacher' && selectedTeacherId && (
                <button
                    onClick={() => handleExport('teacher')}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                    {isExporting ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                    Експорт Учител (PDF)
                </button>
            )}

            {/* All Classes Export */}
            <button
                onClick={() => handleExport('master')}
                disabled={isExporting}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <School size={16} />}
                Всички Класове (PDF)
            </button>

            {/* All Teachers Export */}
            <button
                onClick={() => handleExport('teachers_master')}
                disabled={isExporting}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                Всички Учители (PDF)
            </button>
        </div>
    );
};
