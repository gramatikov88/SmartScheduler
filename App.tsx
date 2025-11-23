import React, { useState, useMemo } from 'react';
import { Calendar, Settings, Grid, School } from 'lucide-react';
import SetupWizard from './components/SetupWizard';
import Scheduler from './components/Scheduler';
import { generatePeriods } from './constants';
import { SchoolContextProvider, useSchool } from './context/SchoolContext';

const AppContent: React.FC = () => {
  const [activeView, setActiveView] = useState<'setup' | 'scheduler'>('scheduler');

  // Context Data
  const {
    teachers, setTeachers,
    rooms, setRooms,
    classes, setClasses,
    schedule, setSchedule,
    config, setConfig,
    subjects, setSubjects,
    subjectCategories, setSubjectCategories,
    loading
  } = useSchool();

  const periods = useMemo(() => generatePeriods(config), [config]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-indigo-600 text-xl font-semibold animate-pulse">Loading School Data...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-md">
            <School size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">SmartScheduler</h1>
            <p className="text-xs text-gray-500 font-medium">AI-Powered School Management</p>
          </div>
        </div>

        <nav className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveView('setup')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === 'setup'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
          >
            <Settings size={16} /> Настройки
          </button>
          <button
            onClick={() => setActiveView('scheduler')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === 'scheduler'
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
              schoolConfig={config}
              setSchoolConfig={setConfig}
            />
          </div>
        ) : (
          <div className="h-full animate-in fade-in zoom-in-95 duration-300">
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

const App: React.FC = () => {
  return (
    <SchoolContextProvider>
      <AppContent />
    </SchoolContextProvider>
  );
};

export default App;
