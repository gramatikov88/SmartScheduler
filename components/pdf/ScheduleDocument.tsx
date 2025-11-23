import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { ScheduleItem, ClassGroup, Teacher, Room, Subject } from '../../types';

// Register fonts
Font.register({
    family: 'Roboto',
    fonts: [
        { src: '/fonts/Roboto-Regular.woff2' },
        { src: '/fonts/Roboto-Bold.woff2', fontWeight: 'bold' }
    ]
});

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 30,
        fontFamily: 'Roboto'
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#112244',
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#112244',
        textAlign: 'center',
        marginBottom: 5
    },
    subtitle: {
        fontSize: 12,
        color: '#666666',
        textAlign: 'center'
    },
    table: {
        display: 'flex',
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#bfbfbf',
        borderRightWidth: 0,
        borderBottomWidth: 0
    },
    tableRow: {
        margin: 'auto',
        flexDirection: 'row'
    },
    tableColHeader: {
        width: '15%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: '#bfbfbf',
        backgroundColor: '#f0f0f0',
        padding: 5
    },
    tableColHeaderFirst: {
        width: '10%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: '#bfbfbf',
        backgroundColor: '#f0f0f0',
        padding: 5
    },
    tableCol: {
        width: '15%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: '#bfbfbf',
        padding: 5
    },
    tableColFirst: {
        width: '10%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: '#bfbfbf',
        padding: 5,
        backgroundColor: '#fafafa'
    },
    tableCellHeader: {
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center'
    },
    tableCell: {
        fontSize: 9,
        textAlign: 'center'
    },
    cellSubject: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 2
    },
    cellDetail: {
        fontSize: 8,
        color: '#444444'
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 8,
        color: '#888888'
    }
});

interface ScheduleDocumentProps {
    type: 'class' | 'teacher' | 'master';
    data?: any; // The specific entity (ClassGroup or Teacher)
    schedule: ScheduleItem[];
    subjects: Subject[];
    teachers: Teacher[];
    rooms: Room[];
    classes: ClassGroup[];
    title?: string;
}

const DAYS = ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const SchedulePage: React.FC<{
    title: string;
    subtitle: string;
    scheduleData: ScheduleItem[];
    subjects: Subject[];
    teachers: Teacher[];
    rooms: Room[];
    classes: ClassGroup[];
    entityId: string;
    type: 'class' | 'teacher';
}> = ({ title, subtitle, scheduleData, subjects, teachers, rooms, classes, entityId, type }) => {

    const getCellContent = (dayIndex: number, periodIndex: number) => {
        const item = scheduleData.find(s =>
            s.dayIndex === dayIndex &&
            s.periodIndex === periodIndex &&
            (type === 'class' ? s.classGroupId === entityId : s.teacherId === entityId)
        );

        if (!item) return null;

        const subject = subjects.find(s => s.id === item.subjectId);
        const teacher = teachers.find(t => t.id === item.teacherId);
        const room = rooms.find(r => r.id === item.roomId);
        const classGroup = classes.find(c => c.id === item.classGroupId);

        return (
            <View>
                <Text style={styles.cellSubject}>{subject?.name || '---'}</Text>
                {type === 'class' ? (
                    <Text style={styles.cellDetail}>{teacher?.name}</Text>
                ) : (
                    <Text style={styles.cellDetail}>{classGroup?.name}</Text>
                )}
                <Text style={styles.cellDetail}>{room?.name || 'Room?'}</Text>
            </View>
        );
    };

    return (
        <Page size="A4" orientation="landscape" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <View style={styles.table}>
                {/* Header Row */}
                <View style={styles.tableRow}>
                    <View style={styles.tableColHeaderFirst}>
                        <Text style={styles.tableCellHeader}>Час / Ден</Text>
                    </View>
                    {DAYS.map(day => (
                        <View key={day} style={styles.tableColHeader}>
                            <Text style={styles.tableCellHeader}>{day}</Text>
                        </View>
                    ))}
                </View>

                {/* Data Rows */}
                {PERIODS.map((period, pIndex) => (
                    <View key={period} style={styles.tableRow}>
                        <View style={styles.tableColFirst}>
                            <Text style={styles.tableCellHeader}>{period}. час</Text>
                        </View>
                        {DAYS.map((_, dIndex) => (
                            <View key={`${dIndex}-${pIndex}`} style={styles.tableCol}>
                                {getCellContent(dIndex, pIndex) || <Text style={styles.tableCell}>-</Text>}
                            </View>
                        ))}
                    </View>
                ))}
            </View>

            <Text style={styles.footer}>
                SmartScheduler • Генерирано на {new Date().toLocaleDateString('bg-BG')}
            </Text>
        </Page>
    );
};

export const ScheduleDocument: React.FC<ScheduleDocumentProps> = ({
    type, data, schedule, subjects, teachers, rooms, classes, title
}) => {
    return (
        <Document>
            {type === 'master' ? (
                // Master Schedule: Iterate through ALL classes
                classes.map((cls) => (
                    <SchedulePage
                        key={cls.id}
                        title={`Седмично Разписание - ${cls.name}`}
                        subtitle={`Учебна година 2024/2025`}
                        scheduleData={schedule}
                        subjects={subjects}
                        teachers={teachers}
                        rooms={rooms}
                        classes={classes}
                        entityId={cls.id}
                        type="class"
                    />
                ))
            ) : (
                // Single Entity (Class or Teacher)
                <SchedulePage
                    title={title || 'Седмично Разписание'}
                    subtitle={data?.name || ''}
                    scheduleData={schedule}
                    subjects={subjects}
                    teachers={teachers}
                    rooms={rooms}
                    classes={classes}
                    entityId={data?.id}
                    type={type as 'class' | 'teacher'}
                />
            )}
        </Document>
    );
};
