
import React, { useState, useMemo } from 'react';
import { Calendar, Settings, Grid, School } from 'lucide-react';
import SetupWizard from './components/SetupWizard';
import Scheduler from './components/Scheduler';
import { MOCK_TEACHERS, MOCK_ROOMS, MOCK_CLASSES, MOCK_SUBJECTS, DEFAULT_SCHOOL_CONFIG, generatePeriods, DEFAULT_SUBJECT_CATEGORIES } from './constants';
import { Teacher, Room, ClassGroup, ScheduleItem, SchoolConfig, Subject, SubjectCategory } from './types';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'setup' | 'scheduler'>('scheduler');
  
  // Central State for the Application
  const [teachers, setTeachers] = useState<Teacher[]>(MOCK_TEACHERS);
  const [rooms, setRooms] = useState<Room[]>(MOCK_ROOMS);
  const [classes, setClasses] = useState<ClassGroup[]>(MOCK_CLASSES);
  const [subjects, setSubjects] = useState<Subject[]>(MOCK_SUBJECTS);
  const [subjectCategories, setSubjectCategories] = useState<SubjectCategory[]>(DEFAULT_SUBJECT_CATEGORIES);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);

  const periods = useMemo(() => generatePeriods(schoolConfig), [schoolConfig]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <School className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-600">
            SmartScheduler
          </h1>
        </div>

        <nav className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveView('setup')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeView === 'setup' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <Settings size={16} /> Настройки
          </button>
          <button
            onClick={() => setActiveView('scheduler')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeView === 'scheduler' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <Calendar size={16} /> Програма
          </button>
        </nav>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-semibold">v1.0 Beta</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeView === 'setup' ? (
          <div className="h-full p-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-2">
            <SetupWizard 
              teachers={teachers} setTeachers={setTeachers}
              rooms={rooms} setRooms={setRooms}
              classes={classes} setClasses={setClasses}
              subjects={subjects} setSubjects={setSubjects}
              subjectCategories={subjectCategories} setSubjectCategories={setSubjectCategories}
              schoolConfig={schoolConfig}
              setSchoolConfig={setSchoolConfig}
            />
          </div>
        ) : (
          <div className="h-full animate-in fade-in zoom-in-95">
             <Scheduler 
               schedule={schedule}
               setSchedule={setSchedule}
               classes={classes}
               teachers={teachers}
               subjects={subjects}
               rooms={rooms}
               periods={periods}
             />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
