import React, { useState, useMemo } from 'react';
import { Calendar, Settings, Grid, School, Sparkles, BrainCircuit, Loader2, Save, FolderOpen } from 'lucide-react';
import SetupWizard from './components/SetupWizard';
import Scheduler from './components/Scheduler';
import { generatePeriods } from './constants';
import { SchoolContextProvider, useSchool } from './context/SchoolContext';
import { analyzeScheduleWithGemini, generateScheduleWithGemini } from './services/geminiService';
import { ScheduleItem, SchoolConfig } from './types';

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
    saveProject, loadProject,
    loading
  } = useSchool();

  const periods = useMemo(() => generatePeriods(config), [config]);

  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeminiAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    const result = await analyzeScheduleWithGemini(schedule, teachers, classes, subjects);
    setAnalysisResult(result);
    setIsAnalyzing(false);
  };

  const handleAutoGenerate = async () => {
    let currentScheduleToKeep: ScheduleItem[] = [];

    if (schedule.length > 0) {
      const shouldComplete = window.confirm(
        "Разписанието вече съдържа часове.\n\n" +
        "Натиснете OK, за да ДОВЪРШИТЕ текущото разписание (запазвайки въведеното).\n" +
        "Натиснете Cancel, ако искате да изтриете всичко и да генерирате наново (или да се откажете)."
      );

      if (shouldComplete) {
        currentScheduleToKeep = schedule;
      } else {
        if (!window.confirm("Сигурни ли сте, че искате да ИЗТРИЕТЕ цялото разписание и да генерирате ново от нулата?")) {
          return;
        }
        currentScheduleToKeep = [];
      }
    }

    setIsGenerating(true);
    try {
      const config: SchoolConfig = {
        startTime: '08:00',
        lessonDuration: 40,
        breakDuration: 10,
        longBreakDuration: 20,
        longBreakAfterPeriod: 3,
        totalPeriods: periods.length,
        customBreaks: {}
      };

      const newItems = await generateScheduleWithGemini(
        teachers,
        classes,
        rooms,
        subjects,
        config,
        currentScheduleToKeep
      );

      if (newItems.length === 0) {
        alert("Всички часове от учебния план вече са разпределени! Няма какво да се генерира.");
      } else {
        setSchedule([...currentScheduleToKeep, ...newItems]);
        alert(`Успешно добавени ${newItems.length} нови часа!`);
      }
    } catch (error: any) {
      console.error(error);
      alert(`Грешка при генерирането: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

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

        <nav className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
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

          <div className="w-px h-6 bg-gray-300 mx-1"></div>

          <button
            onClick={saveProject}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all"
            title="Запази проект"
          >
            <Save size={16} /> Запази
          </button>
          <button
            onClick={loadProject}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all"
            title="Зареди проект"
          >
            <FolderOpen size={16} /> Зареди
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1"></div>

          <button
            onClick={handleAutoGenerate}
            disabled={isGenerating || isAnalyzing || activeView !== 'scheduler'}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            AI Генериране
          </button>

          <button
            onClick={handleGeminiAnalysis}
            disabled={isAnalyzing || isGenerating || activeView !== 'scheduler'}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
            Анализ
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
              analysisResult={analysisResult}
              onClearAnalysis={() => setAnalysisResult(null)}
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
