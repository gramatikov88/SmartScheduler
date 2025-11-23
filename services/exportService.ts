import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ScheduleItem, ClassGroup, Teacher, Room, Subject, SchoolConfig } from '../types';

// Helper to get day name
const DAYS = ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък'];

// --- Font Loading Helper ---
let fontLoaded = false;
const loadCyrillicFont = async (doc: jsPDF) => {
    if (fontLoaded) {
        doc.setFont('Roboto');
        return;
    }

    const fontUrls = [
        'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf',
        'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf'
    ];

    for (const url of fontUrls) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;

            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');

            doc.addFileToVFS('Roboto-Regular.ttf', base64);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.setFont('Roboto');
            fontLoaded = true;
            return;
        } catch (e) {
            console.warn(`Failed to load font from ${url}`, e);
        }
    }

    if (!fontLoaded) {
        alert("Внимание: Неуспешно зареждане на шрифт (Кирилица)! Проверете интернет връзката. Експортът може да е с грешни символи.");
    }
};

// --- Common Table Styles ---
const getTableStyles = () => ({
    font: 'Roboto',
    fontSize: 9,
    cellPadding: 2,
    valign: 'middle' as 'middle',
    halign: 'center' as 'center',
    lineColor: [220, 220, 230] as [number, number, number],
    lineWidth: 0.1,
    textColor: [50, 50, 50] as [number, number, number],
});

const getHeadStyles = () => ({
    fillColor: [63, 81, 181] as [number, number, number], // Indigo 500
    textColor: 255,
    fontStyle: 'bold' as 'bold',
    halign: 'center' as 'center',
    valign: 'middle' as 'middle',
    minCellHeight: 10
});

const getAlternateRowStyles = () => ({
    fillColor: [248, 250, 252] as [number, number, number] // Slate 50
});

// --- Data Helpers ---
const getCellContent = (
    schedule: ScheduleItem[],
    subjects: Subject[],
    teachers: Teacher[],
    rooms: Room[],
    filterFn: (item: ScheduleItem) => boolean
) => {
    const item = schedule.find(filterFn);
    if (!item) return '';

    const subject = subjects.find(s => s.id === item.subjectId)?.name || '?';
    const teacher = teachers.find(t => t.id === item.teacherId)?.name.split(' ')[1] || '?';
    const room = rooms.find(r => r.id === item.roomId)?.name.split('(')[0] || '?';

    return `${subject}\n${teacher}\n[${room}]`;
};

// Helper for Teacher Cell
const getCellForTeacher = (
    schedule: ScheduleItem[],
    classes: ClassGroup[],
    rooms: Room[],
    subjects: Subject[],
    teacherId: string,
    dayIdx: number,
    periodIdx: number
) => {
    const item = schedule.find(s =>
        s.teacherId === teacherId &&
        s.dayIndex === dayIdx &&
        s.periodIndex === periodIdx
    );
    if (!item) return '';

    const cls = classes.find(c => c.id === item.classGroupId)?.name || '?';
    const subject = subjects.find(s => s.id === item.subjectId)?.name || '?';
    const room = rooms.find(r => r.id === item.roomId)?.name.split('(')[0] || '?';

    return `${cls}\n${subject}\n[${room}]`;
};

export const exportService = {
    // 1. Export ALL Classes (One page per class)
    exportClassesPDF: async (
        schedule: ScheduleItem[],
        classes: ClassGroup[],
        teachers: Teacher[],
        rooms: Room[],
        subjects: Subject[],
        config: SchoolConfig
    ) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        await loadCyrillicFont(doc);

        classes.forEach((cls, index) => {
            if (index > 0) doc.addPage();

            // Header
            doc.setFont('Roboto');
            doc.setFontSize(24);
            doc.setTextColor(26, 35, 126); // Indigo 900
            doc.text(`Седмично Разписание`, 148, 15, { align: 'center' });

            doc.setFontSize(16);
            doc.setTextColor(60, 60, 60);
            doc.text(`Клас: ${cls.name}`, 148, 25, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Смяна: ${cls.shift === 1 ? 'Първа' : 'Втора'} | Класен ръководител: -`, 148, 32, { align: 'center' });

            // Grid Data
            const tableBody = [];
            for (let p = 0; p < config.totalPeriods; p++) {
                const row = [
                    `${p + 1} час`,
                    getCellContent(schedule, subjects, teachers, rooms, s => s.classGroupId === cls.id && s.dayIndex === 0 && s.periodIndex === p),
                    getCellContent(schedule, subjects, teachers, rooms, s => s.classGroupId === cls.id && s.dayIndex === 1 && s.periodIndex === p),
                    getCellContent(schedule, subjects, teachers, rooms, s => s.classGroupId === cls.id && s.dayIndex === 2 && s.periodIndex === p),
                    getCellContent(schedule, subjects, teachers, rooms, s => s.classGroupId === cls.id && s.dayIndex === 3 && s.periodIndex === p),
                    getCellContent(schedule, subjects, teachers, rooms, s => s.classGroupId === cls.id && s.dayIndex === 4 && s.periodIndex === p),
                ];
                tableBody.push(row);
            }

            autoTable(doc, {
                head: [['Час', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък']],
                body: tableBody,
                startY: 40,
                theme: 'grid',
                styles: getTableStyles(),
                headStyles: getHeadStyles(),
                alternateRowStyles: getAlternateRowStyles(),
                columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold', fillColor: [240, 240, 240] } },
            });

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`SmartScheduler • Генерирано на ${new Date().toLocaleDateString('bg-BG')}`, 14, doc.internal.pageSize.height - 10);
        });

        doc.save(`Classes_Schedule_${new Date().toISOString().split('T')[0]}.pdf`);
    },

    // 2. Export ALL Teachers (One page per teacher)
    exportTeachersPDF: async (
        schedule: ScheduleItem[],
        classes: ClassGroup[],
        teachers: Teacher[],
        rooms: Room[],
        subjects: Subject[],
        config: SchoolConfig
    ) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        await loadCyrillicFont(doc);

        teachers.forEach((teacher, index) => {
            if (index > 0) doc.addPage();

            // Header
            doc.setFont('Roboto');
            doc.setFontSize(24);
            doc.setTextColor(26, 35, 126);
            doc.text(`Седмично Разписание`, 148, 15, { align: 'center' });

            doc.setFontSize(16);
            doc.setTextColor(60, 60, 60);
            doc.text(`Учител: ${teacher.name}`, 148, 25, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Предмети: ${teacher.subjects.map(sid => subjects.find(s => s.id === sid)?.name).join(', ')}`, 148, 32, { align: 'center' });

            // Grid Data
            const tableBody = [];
            for (let p = 0; p < config.totalPeriods; p++) {
                const row = [
                    `${p + 1} час`,
                    getCellForTeacher(schedule, classes, rooms, subjects, teacher.id, 0, p),
                    getCellForTeacher(schedule, classes, rooms, subjects, teacher.id, 1, p),
                    getCellForTeacher(schedule, classes, rooms, subjects, teacher.id, 2, p),
                    getCellForTeacher(schedule, classes, rooms, subjects, teacher.id, 3, p),
                    getCellForTeacher(schedule, classes, rooms, subjects, teacher.id, 4, p),
                ];
                tableBody.push(row);
            }

            autoTable(doc, {
                head: [['Час', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък']],
                body: tableBody,
                startY: 40,
                theme: 'grid',
                styles: getTableStyles(),
                headStyles: { ...getHeadStyles(), fillColor: [0, 150, 136] as [number, number, number] }, // Teal 500
                alternateRowStyles: getAlternateRowStyles(),
                columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold', fillColor: [240, 240, 240] } },
            });

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`SmartScheduler • Генерирано на ${new Date().toLocaleDateString('bg-BG')}`, 14, doc.internal.pageSize.height - 10);
        });

        doc.save(`Teachers_Schedule_${new Date().toISOString().split('T')[0]}.pdf`);
    },

    // 3. Export Whole School PDF (Master Document)
    exportWholeSchoolPDF: async (
        schedule: ScheduleItem[],
        classes: ClassGroup[],
        teachers: Teacher[],
        rooms: Room[],
        subjects: Subject[],
        config: SchoolConfig
    ) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        await loadCyrillicFont(doc);

        // Title Page
        doc.setFont('Roboto');
        doc.setFillColor(245, 247, 250);
        doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');

        doc.setFontSize(40);
        doc.setTextColor(26, 35, 126);
        doc.text("УЧИЛИЩНА ПРОГРАМА", 148, 90, { align: 'center' });

        doc.setLineWidth(0.5);
        doc.setDrawColor(26, 35, 126);
        doc.line(74, 100, 222, 100);

        doc.setFontSize(16);
        doc.setTextColor(100);
        doc.text(`Учебна година ${new Date().getFullYear()}/${new Date().getFullYear() + 1}`, 148, 115, { align: 'center' });
        doc.text(`Генерирана на: ${new Date().toLocaleDateString('bg-BG')}`, 148, 125, { align: 'center' });
        doc.addPage();

        // Part 1: Classes
        classes.forEach((cls) => {
            doc.addPage();
            doc.setFont('Roboto');

            // Header
            doc.setFontSize(24);
            doc.setTextColor(26, 35, 126);
            doc.text(`Седмично Разписание`, 148, 15, { align: 'center' });

            doc.setFontSize(16);
            doc.setTextColor(60, 60, 60);
            doc.text(`Клас: ${cls.name}`, 148, 25, { align: 'center' });

            const tableBody = [];
            for (let p = 0; p < config.totalPeriods; p++) {
                const row = [
                    `${p + 1} час`,
                    getCellContent(schedule, subjects, teachers, rooms, s => s.classGroupId === cls.id && s.dayIndex === 0 && s.periodIndex === p),
                    getCellContent(schedule, subjects, teachers, rooms, s => s.classGroupId === cls.id && s.dayIndex === 1 && s.periodIndex === p),
                    getCellContent(schedule, subjects, teachers, rooms, s => s.classGroupId === cls.id && s.dayIndex === 2 && s.periodIndex === p),
                    getCellContent(schedule, subjects, teachers, rooms, s => s.classGroupId === cls.id && s.dayIndex === 3 && s.periodIndex === p),
                    getCellContent(schedule, subjects, teachers, rooms, s => s.classGroupId === cls.id && s.dayIndex === 4 && s.periodIndex === p),
                ];
                tableBody.push(row);
            }

            autoTable(doc, {
                head: [['Час', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък']],
                body: tableBody,
                startY: 35,
                theme: 'grid',
                styles: getTableStyles(),
                headStyles: getHeadStyles(),
                alternateRowStyles: getAlternateRowStyles(),
                columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold', fillColor: [240, 240, 240] } },
            });

            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`SmartScheduler • Клас ${cls.name}`, 14, doc.internal.pageSize.height - 10);
        });

        // Part 2: Teachers Separator
        doc.addPage();
        doc.setFillColor(240, 253, 244); // Green 50
        doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');

        doc.setFontSize(30);
        doc.setTextColor(0, 150, 136); // Teal
        doc.text("ПРОГРАМА НА УЧИТЕЛИТЕ", 148, 100, { align: 'center' });

        teachers.forEach((teacher) => {
            doc.addPage();
            doc.setFont('Roboto');

            // Header
            doc.setFontSize(24);
            doc.setTextColor(26, 35, 126);
            doc.text(`Седмично Разписание`, 148, 15, { align: 'center' });

            doc.setFontSize(16);
            doc.setTextColor(60, 60, 60);
            doc.text(`Учител: ${teacher.name}`, 148, 25, { align: 'center' });

            const tableBody = [];
            for (let p = 0; p < config.totalPeriods; p++) {
                const row = [
                    `${p + 1} час`,
                    getCellForTeacher(schedule, classes, rooms, subjects, teacher.id, 0, p),
                    getCellForTeacher(schedule, classes, rooms, subjects, teacher.id, 1, p),
                    getCellForTeacher(schedule, classes, rooms, subjects, teacher.id, 2, p),
                    getCellForTeacher(schedule, classes, rooms, subjects, teacher.id, 3, p),
                    getCellForTeacher(schedule, classes, rooms, subjects, teacher.id, 4, p),
                ];
                tableBody.push(row);
            }

            autoTable(doc, {
                head: [['Час', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък']],
                body: tableBody,
                startY: 35,
                theme: 'grid',
                styles: getTableStyles(),
                headStyles: { ...getHeadStyles(), fillColor: [0, 150, 136] as [number, number, number] },
                alternateRowStyles: getAlternateRowStyles(),
                columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold', fillColor: [240, 240, 240] } },
            });

            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`SmartScheduler • ${teacher.name}`, 14, doc.internal.pageSize.height - 10);
        });

        doc.save(`Master_Schedule_${new Date().toISOString().split('T')[0]}.pdf`);
    },

    exportWholeSchoolExcel: (
        schedule: ScheduleItem[],
        classes: ClassGroup[],
        teachers: Teacher[],
        rooms: Room[],
        subjects: Subject[],
        config: SchoolConfig
    ) => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Master List (Raw Data)
        const masterData = schedule.map(item => ({
            'Ден': DAYS[item.dayIndex],
            'Час': item.periodIndex + 1,
            'Клас': classes.find(c => c.id === item.classGroupId)?.name,
            'Предмет': subjects.find(s => s.id === item.subjectId)?.name,
            'Учител': teachers.find(t => t.id === item.teacherId)?.name,
            'Стая': rooms.find(r => r.id === item.roomId)?.name
        }));
        const wsMaster = XLSX.utils.json_to_sheet(masterData);
        XLSX.utils.book_append_sheet(wb, wsMaster, "Master Data");

        // Sheet 2: Teachers Summary
        const teacherRows = teachers.map(t => {
            const hours = schedule.filter(s => s.teacherId === t.id).length;
            return { 'Име': t.name, 'Часове седмично': hours, 'Максимум': t.maxHoursPerDay * 5 };
        });
        const wsTeachers = XLSX.utils.json_to_sheet(teacherRows);
        XLSX.utils.book_append_sheet(wb, wsTeachers, "Teachers Load");

        XLSX.writeFile(wb, `Whole_School_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
};
