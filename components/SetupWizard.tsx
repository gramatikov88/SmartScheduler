
import React, { useState } from 'react';
import { Teacher, Room, ClassGroup, Subject, RoomType, SubjectType, SchoolConfig, SubjectCategory } from '../types';
import { Users, Layout, BookOpen, Trash2, Plus, Save, Filter, Clock, X, Library, Tag, Check, AlertCircle } from 'lucide-react';
import { generatePeriods } from '../constants';

interface SetupWizardProps {
  teachers: Teacher[];
  rooms: Room[];
  classes: ClassGroup[];
  subjects: Subject[];
  subjectCategories: SubjectCategory[];
  schoolConfig: SchoolConfig;
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  setClasses: React.Dispatch<React.SetStateAction<ClassGroup[]>>;
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  setSubjectCategories: React.Dispatch<React.SetStateAction<SubjectCategory[]>>;
  setSchoolConfig: React.Dispatch<React.SetStateAction<SchoolConfig>>;
}

const SetupWizard: React.FC<SetupWizardProps> = ({
  teachers, rooms, classes, subjects, subjectCategories, schoolConfig, 
  setTeachers, setRooms, setClasses, setSubjects, setSubjectCategories, setSchoolConfig
}) => {
  const [activeTab, setActiveTab] = useState<'teachers' | 'subjects' | 'rooms' | 'curriculum' | 'bells'>('teachers');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [addingSubjectToTeacher, setAddingSubjectToTeacher] = useState<string | null>(null);

  // New Subject Form State
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectType, setNewSubjectType] = useState<string>(SubjectType.HUMANITIES);
  const [newSubjectDifficulty, setNewSubjectDifficulty] = useState(5);

  // New Category State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Curriculum Editing State
  const [addingCurriculumToClass, setAddingCurriculumToClass] = useState<string | null>(null);
  const [newCurriculumState, setNewCurriculumState] = useState<{subjectId: string, hours: number, teacherId: string}>({
      subjectId: '',
      hours: 2,
      teacherId: ''
  });

  const getCategoryName = (id: string) => {
    return subjectCategories.find(c => c.id === id)?.name || id;
  };

  const addTeacher = () => {
    const newTeacher: Teacher = {
      id: `t_${Date.now()}`,
      name: 'Нов Учител',
      subjects: [],
      maxHoursPerDay: 6,
      unwantedDays: []
    };
    setTeachers([newTeacher, ...teachers]);
  };

  const updateTeacher = (id: string, field: keyof Teacher, value: any) => {
    setTeachers(teachers.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const updateConfig = (field: keyof SchoolConfig, value: any) => {
    setSchoolConfig(prev => ({ ...prev, [field]: value }));
  };
  
  const updateCustomBreak = (periodIndex: number, value: number) => {
    setSchoolConfig(prev => ({
        ...prev,
        customBreaks: {
            ...prev.customBreaks,
            [periodIndex]: value
        }
    }));
  };

  const addSubject = () => {
    if (!newSubjectName.trim()) return;
    const newSubject: Subject = {
      id: `sub_${Date.now()}`,
      name: newSubjectName,
      type: newSubjectType,
      difficulty: newSubjectDifficulty,
    };
    setSubjects([...subjects, newSubject]);
    setNewSubjectName('');
    setNewSubjectDifficulty(5);
  };

  const deleteSubject = (id: string) => {
    if (window.confirm('Сигурни ли сте, че искате да изтриете този предмет? Това може да повлияе на разпределените часове.')) {
      setSubjects(subjects.filter(s => s.id !== id));
      // Cleanup teachers assigned to this subject
      setTeachers(teachers.map(t => ({
        ...t,
        subjects: t.subjects.filter(sId => sId !== id)
      })));
    }
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const newId = newCategoryName.toUpperCase().replace(/\s+/g, '_');
    // Check for duplicates
    if (subjectCategories.some(c => c.id === newId)) {
        alert("Тази категория вече съществува.");
        return;
    }
    
    setSubjectCategories([...subjectCategories, { id: newId, name: newCategoryName }]);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const deleteCategory = (id: string) => {
      // Check if used
      const isUsed = subjects.some(s => s.type === id);
      if (isUsed) {
          alert("Не може да изтриете категория, която се използва от предмети.");
          return;
      }
      setSubjectCategories(subjectCategories.filter(c => c.id !== id));
  };

  // --- Curriculum Actions ---
  const addClass = () => {
      const newClass: ClassGroup = {
          id: `c_${Date.now()}`,
          name: 'Нов Клас',
          studentsCount: 26,
          shift: 1,
          curriculum: []
      };
      setClasses([...classes, newClass]);
  };

  const deleteClass = (id: string) => {
      if(window.confirm("Сигурни ли сте? Всички данни за този клас ще бъдат загубени.")) {
          setClasses(classes.filter(c => c.id !== id));
      }
  };

  const updateClass = (id: string, field: keyof ClassGroup, value: any) => {
      setClasses(classes.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const updateCurriculumItem = (classId: string, subjectId: string, field: 'hoursPerWeek' | 'teacherId', value: any) => {
      setClasses(classes.map(c => {
          if (c.id !== classId) return c;
          const newCurriculum = c.curriculum.map(item => 
             item.subjectId === subjectId ? { ...item, [field]: value } : item
          );
          return { ...c, curriculum: newCurriculum };
      }));
  };

  const removeSubjectFromClass = (classId: string, subjectId: string) => {
      setClasses(classes.map(c => {
          if (c.id !== classId) return c;
          return { ...c, curriculum: c.curriculum.filter(item => item.subjectId !== subjectId) };
      }));
  };

  const startAddingCurriculum = (classId: string) => {
      // Find first subject not in class
      const currentClass = classes.find(c => c.id === classId);
      const usedSubjects = currentClass?.curriculum.map(c => c.subjectId) || [];
      const availableSubject = subjects.find(s => !usedSubjects.includes(s.id));
      
      if (!availableSubject) {
          alert("Няма налични предмети за добавяне (всички са добавени).");
          return;
      }

      setAddingCurriculumToClass(classId);
      setNewCurriculumState({
          subjectId: availableSubject.id,
          hours: 2,
          teacherId: '' // Default to empty, will force user to select or remain unassigned
      });
  };

  const confirmAddCurriculum = () => {
      if (!addingCurriculumToClass || !newCurriculumState.subjectId) return;

      setClasses(classes.map(c => {
          if (c.id !== addingCurriculumToClass) return c;
          return {
              ...c,
              curriculum: [...c.curriculum, {
                  subjectId: newCurriculumState.subjectId,
                  hoursPerWeek: newCurriculumState.hours,
                  teacherId: newCurriculumState.teacherId // Can be empty string if unassigned
              }]
          };
      }));

      setAddingCurriculumToClass(null);
  };

  const previewPeriods = generatePeriods(schoolConfig);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('teachers')}
          className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 min-w-fit ${activeTab === 'teachers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Users size={18} /> Учители
        </button>
        <button
          onClick={() => setActiveTab('subjects')}
          className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 min-w-fit ${activeTab === 'subjects' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Library size={18} /> Предмети & Типове
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 min-w-fit ${activeTab === 'rooms' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Layout size={18} /> Кабинети
        </button>
        <button
          onClick={() => setActiveTab('curriculum')}
          className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 min-w-fit ${activeTab === 'curriculum' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <BookOpen size={18} /> Учебен План
        </button>
        <button
          onClick={() => setActiveTab('bells')}
          className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 min-w-fit ${activeTab === 'bells' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Clock size={18} /> Звънец
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {activeTab === 'teachers' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">Списък с Преподаватели</h2>
                <button onClick={addTeacher} className="btn-primary flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
                  <Plus size={16} /> Добави Учител
                </button>
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 whitespace-nowrap mr-2">
                    <Filter size={14} /> Филтър:
                  </span>
                  <button
                    onClick={() => setSubjectFilter('ALL')}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${
                      subjectFilter === 'ALL'
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    Всички
                  </button>
                  {subjectCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSubjectFilter(cat.id)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${
                        subjectFilter === cat.id
                          ? 'bg-indigo-100 text-indigo-700 border-indigo-200 font-medium'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
              </div>
            </div>

            {teachers.map(teacher => (
              <div key={teacher.id} className="p-4 border rounded-lg bg-gray-50 flex flex-col md:flex-row gap-4 items-start md:items-center relative">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Име</label>
                  <input
                    type="text"
                    value={teacher.name}
                    onChange={(e) => updateTeacher(teacher.id, 'name', e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="w-32">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Макс. часове</label>
                  <input
                    type="number"
                    value={teacher.maxHoursPerDay}
                    onChange={(e) => updateTeacher(teacher.id, 'maxHoursPerDay', parseInt(e.target.value))}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="flex-1 min-w-[300px] relative">
                   <label className="text-xs text-gray-500 font-semibold uppercase">
                     Квалификация {subjectFilter !== 'ALL' && `(${getCategoryName(subjectFilter)})`}
                   </label>
                   <div className="flex flex-wrap gap-1 mt-1">
                      {subjects
                        .filter(sub => teacher.subjects.includes(sub.id))
                        .filter(sub => subjectFilter === 'ALL' || sub.type === subjectFilter)
                        .map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => {
                             const newSubjects = teacher.subjects.filter(s => s !== sub.id);
                             updateTeacher(teacher.id, 'subjects', newSubjects);
                          }}
                          className={`text-xs px-2 py-1 rounded-full border transition-colors bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-red-100 hover:text-red-700 hover:border-red-200`}
                        >
                          {sub.name}
                        </button>
                      ))}
                      
                      {/* Plus Button to Add New Qualification */}
                      <button
                        onClick={() => setAddingSubjectToTeacher(addingSubjectToTeacher === teacher.id ? null : teacher.id)}
                        className="text-xs px-2 py-1 rounded-full border border-dashed border-gray-400 text-gray-600 hover:bg-white hover:border-indigo-500 hover:text-indigo-600 flex items-center gap-1 transition-all"
                      >
                        <Plus size={12} />
                      </button>

                      {subjects
                        .filter(sub => teacher.subjects.includes(sub.id))
                        .filter(sub => subjectFilter === 'ALL' || sub.type === subjectFilter).length === 0 && teacher.subjects.length > 0 && (
                          <span className="text-xs text-gray-400 italic py-1">Няма квалификации по {getCategoryName(subjectFilter)}</span>
                      )}
                       {teacher.subjects.length === 0 && (
                          <span className="text-xs text-gray-400 italic py-1">Няма добавени квалификации</span>
                      )}
                   </div>

                   {/* Dropdown for adding subjects */}
                   {addingSubjectToTeacher === teacher.id && (
                     <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-3 max-h-64 overflow-y-auto">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                           <span className="text-xs font-bold text-gray-700">Добави квалификация</span>
                           <button onClick={() => setAddingSubjectToTeacher(null)} className="text-gray-400 hover:text-gray-700"><X size={14}/></button>
                        </div>
                        <div className="space-y-1">
                           {subjects
                             .filter(s => !teacher.subjects.includes(s.id))
                             .map(sub => (
                               <button
                                 key={sub.id}
                                 onClick={() => {
                                   updateTeacher(teacher.id, 'subjects', [...teacher.subjects, sub.id]);
                                   setAddingSubjectToTeacher(null);
                                 }}
                                 className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-indigo-50 text-gray-700 flex justify-between group"
                               >
                                 <span>{sub.name}</span>
                                 <span className="text-gray-400 group-hover:text-indigo-400 text-[10px]">{getCategoryName(sub.type)}</span>
                               </button>
                             ))
                           }
                           {subjects.filter(s => !teacher.subjects.includes(s.id)).length === 0 && (
                             <div className="text-center text-xs text-gray-400 py-2">Учителят има всички квалификации.</div>
                           )}
                        </div>
                     </div>
                   )}
                </div>
                <button
                  onClick={() => setTeachers(teachers.filter(t => t.id !== teacher.id))}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-6">
              <h2 className="text-lg font-semibold text-gray-800">Управление на Предмети</h2>
              
              {/* Create Subject Form */}
              <div className="p-5 bg-gray-50 border rounded-xl shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 uppercase mb-4">Добави нов предмет</h3>
                <div className="flex flex-col gap-4">
                  <div className="w-full">
                    <label className="text-xs text-gray-500 font-semibold mb-1.5 block">Име на предмета</label>
                    <input
                      type="text"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="напр. Конкурентно Програмиране"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="text-xs text-gray-500 font-semibold mb-1.5 block">Тип (Категория)</label>
                      <select
                        value={newSubjectType}
                        onChange={(e) => setNewSubjectType(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        {subjectCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full md:w-40">
                      <label className="text-xs text-gray-500 font-semibold mb-1.5 block">Сложност (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={newSubjectDifficulty}
                        onChange={(e) => setNewSubjectDifficulty(parseInt(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <button 
                      onClick={addSubject}
                      className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-sm font-medium transition-colors"
                    >
                      <Plus size={18} /> Добави
                    </button>
                  </div>
                </div>
              </div>

              {/* Subjects List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subjects.map(subject => (
                  <div key={subject.id} className="p-3 border rounded-lg bg-white shadow-sm flex justify-between items-center group">
                    <div>
                      <div className="font-bold text-gray-800">{subject.name}</div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{getCategoryName(subject.type)}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-orange-50 rounded-full text-orange-600">Сложност: {subject.difficulty}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteSubject(subject.id)}
                      className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Изтрий предмет"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories Management Sidebar */}
            <div className="w-full lg:w-80 space-y-4">
               <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                 <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2"><Tag size={16}/> Категории</h3>
                    <button onClick={() => setIsAddingCategory(!isAddingCategory)} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold">
                       {isAddingCategory ? 'Откажи' : '+ Нова'}
                    </button>
                 </div>
                 <div className="p-4">
                    {isAddingCategory && (
                       <div className="mb-4 flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Име..." 
                            className="flex-1 text-sm border rounded px-2 py-1"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                          />
                          <button onClick={addCategory} className="bg-indigo-600 text-white p-1 rounded hover:bg-indigo-700">
                             <Plus size={16}/>
                          </button>
                       </div>
                    )}
                    <div className="space-y-2">
                       {subjectCategories.map(cat => (
                         <div key={cat.id} className="flex justify-between items-center p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-100 group">
                            <span className="text-sm text-gray-700">{cat.name}</span>
                            <button 
                              onClick={() => deleteCategory(cat.id)}
                              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={14}/>
                            </button>
                         </div>
                       ))}
                    </div>
                 </div>
               </div>
               <div className="p-4 bg-blue-50 text-blue-800 text-xs rounded-lg">
                  Създайте нови категории (напр. "СИП", "Олимпияди"), за да организирате предметите по-добре при назначаване на учители.
               </div>
            </div>
          </div>
        )}

        {activeTab === 'rooms' && (
           <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Материална База</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map(room => (
                <div key={room.id} className="p-4 border rounded-lg bg-white shadow-sm">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-800">{room.name}</h3>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">{room.type}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Капацитет: <span className="font-medium text-gray-900">{room.capacity} места</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
              * Редактирането на кабинети е ограничено в тази демо версия.
            </div>
           </div>
        )}

        {activeTab === 'curriculum' && (
          <div className="space-y-6 pb-20">
             <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">Учебен План по Класове</h2>
                <button onClick={addClass} className="btn-primary bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                   <Plus size={16}/> Добави Клас
                </button>
             </div>
             
             {classes.map(cls => (
               <div key={cls.id} className="border rounded-xl overflow-hidden shadow-sm bg-white">
                 <div className="bg-gray-50 px-4 py-3 border-b flex flex-wrap gap-4 justify-between items-center">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="flex flex-col">
                           <label className="text-[10px] text-gray-500 font-bold uppercase">Име на Клас</label>
                           <input 
                             type="text" 
                             value={cls.name}
                             onChange={(e) => updateClass(cls.id, 'name', e.target.value)}
                             className="bg-white border border-gray-300 rounded px-2 py-1 text-sm font-bold w-24 focus:ring-indigo-500"
                           />
                        </div>
                        <div className="flex flex-col">
                           <label className="text-[10px] text-gray-500 font-bold uppercase">Ученици</label>
                           <input 
                             type="number" 
                             value={cls.studentsCount}
                             onChange={(e) => updateClass(cls.id, 'studentsCount', parseInt(e.target.value))}
                             className="bg-white border border-gray-300 rounded px-2 py-1 text-sm w-20 focus:ring-indigo-500"
                           />
                        </div>
                         <div className="flex flex-col">
                           <label className="text-[10px] text-gray-500 font-bold uppercase">Смяна</label>
                           <select
                             value={cls.shift}
                             onChange={(e) => updateClass(cls.id, 'shift', parseInt(e.target.value))}
                             className="bg-white border border-gray-300 rounded px-2 py-1 text-sm w-24 focus:ring-indigo-500"
                           >
                              <option value={1}>Първа</option>
                              <option value={2}>Втора</option>
                           </select>
                        </div>
                    </div>
                    <button onClick={() => deleteClass(cls.id)} className="text-gray-400 hover:text-red-500">
                       <Trash2 size={18}/>
                    </button>
                 </div>
                 
                 <div className="p-4">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                        <tr>
                          <th className="px-3 py-2 w-[30%]">Предмет</th>
                          <th className="px-3 py-2 w-[20%]">Хорариум</th>
                          <th className="px-3 py-2 w-[40%]">Преподавател</th>
                          <th className="px-3 py-2 w-[10%] text-right">Действие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cls.curriculum.map((item, idx) => {
                          const subject = subjects.find(s => s.id === item.subjectId);
                          // Filter teachers who teach this subject
                          const qualifiedTeachers = teachers.filter(t => t.subjects.includes(item.subjectId));
                          
                          return (
                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50 group">
                              <td className="px-3 py-2 font-medium text-gray-700">
                                 {subject?.name}
                                 <div className="text-[10px] text-gray-400">{getCategoryName(subject?.type || '')}</div>
                              </td>
                              <td className="px-3 py-2">
                                 <div className="flex items-center gap-1">
                                    <input 
                                       type="number" 
                                       min="1" 
                                       className="w-12 border rounded px-1 py-0.5 text-center"
                                       value={item.hoursPerWeek}
                                       onChange={(e) => updateCurriculumItem(cls.id, item.subjectId, 'hoursPerWeek', parseInt(e.target.value))}
                                    />
                                    <span className="text-xs text-gray-500">часа</span>
                                 </div>
                              </td>
                              <td className="px-3 py-2">
                                 <select 
                                    className={`w-full border rounded px-2 py-1 text-sm ${!item.teacherId ? 'text-red-500 border-red-200 bg-red-50' : 'text-gray-700'}`}
                                    value={item.teacherId}
                                    onChange={(e) => updateCurriculumItem(cls.id, item.subjectId, 'teacherId', e.target.value)}
                                 >
                                    <option value="">-- Неназначен --</option>
                                    {qualifiedTeachers.map(t => (
                                       <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                    {/* Allow assigning unqualified teachers but mark them? Or simply list all in a separate group? For now strict. */}
                                 </select>
                                 {qualifiedTeachers.length === 0 && (
                                     <div className="text-[10px] text-red-500 flex items-center gap-1 mt-1">
                                         <AlertCircle size={10}/> Няма квалифицирани учители!
                                     </div>
                                 )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                 <button 
                                   onClick={() => removeSubjectFromClass(cls.id, item.subjectId)}
                                   className="text-gray-300 hover:text-red-500 transition-colors"
                                 >
                                    <Trash2 size={16}/>
                                 </button>
                              </td>
                            </tr>
                          );
                        })}
                        
                        {/* Add New Subject Row */}
                        {addingCurriculumToClass === cls.id ? (
                           <tr className="bg-indigo-50/50 border-t-2 border-indigo-100">
                              <td className="px-3 py-2">
                                 <select 
                                    className="w-full border border-indigo-300 rounded px-2 py-1 text-sm focus:ring-indigo-500"
                                    value={newCurriculumState.subjectId}
                                    onChange={(e) => setNewCurriculumState({...newCurriculumState, subjectId: e.target.value, teacherId: ''})}
                                 >
                                    <option value="">Избери предмет...</option>
                                    {subjects
                                       .filter(s => !cls.curriculum.find(c => c.subjectId === s.id))
                                       .map(s => <option key={s.id} value={s.id}>{s.name} ({getCategoryName(s.type)})</option>)
                                    }
                                 </select>
                              </td>
                              <td className="px-3 py-2">
                                 <input 
                                    type="number" 
                                    min="1"
                                    className="w-16 border border-indigo-300 rounded px-2 py-1 text-sm"
                                    value={newCurriculumState.hours}
                                    onChange={(e) => setNewCurriculumState({...newCurriculumState, hours: parseInt(e.target.value)})}
                                 />
                              </td>
                              <td className="px-3 py-2">
                                 <select 
                                    className="w-full border border-indigo-300 rounded px-2 py-1 text-sm"
                                    value={newCurriculumState.teacherId}
                                    onChange={(e) => setNewCurriculumState({...newCurriculumState, teacherId: e.target.value})}
                                    disabled={!newCurriculumState.subjectId}
                                 >
                                    <option value="">-- Избери учител --</option>
                                    {teachers
                                       .filter(t => t.subjects.includes(newCurriculumState.subjectId))
                                       .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                                    }
                                 </select>
                              </td>
                              <td className="px-3 py-2 text-right flex justify-end gap-2">
                                 <button onClick={confirmAddCurriculum} className="text-indigo-600 hover:text-indigo-800 bg-indigo-100 p-1 rounded"><Check size={16}/></button>
                                 <button onClick={() => setAddingCurriculumToClass(null)} className="text-gray-500 hover:text-gray-700 bg-gray-100 p-1 rounded"><X size={16}/></button>
                              </td>
                           </tr>
                        ) : (
                           <tr>
                              <td colSpan={4} className="px-3 py-3 text-center border-t border-dashed border-gray-200">
                                 <button 
                                   onClick={() => startAddingCurriculum(cls.id)}
                                   className="text-indigo-600 text-sm font-medium hover:text-indigo-800 flex items-center justify-center gap-1 mx-auto py-1 px-3 hover:bg-indigo-50 rounded transition-colors"
                                 >
                                    <Plus size={14}/> Добави Предмет
                                 </button>
                              </td>
                           </tr>
                        )}
                      </tbody>
                    </table>
                 </div>
               </div>
             ))}
             
             {classes.length === 0 && (
                <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                   <p className="text-gray-500 mb-2">Все още няма добавени класове.</p>
                   <button onClick={addClass} className="text-indigo-600 font-bold hover:underline">Добави първия клас</button>
                </div>
             )}
          </div>
        )}

        {activeTab === 'bells' && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-6">
                 <h2 className="text-lg font-semibold text-gray-800">Настройки на Звънеца</h2>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase">Начало на учебния ден</label>
                      <input
                        type="time"
                        value={schoolConfig.startTime}
                        onChange={(e) => updateConfig('startTime', e.target.value)}
                        className="w-full mt-1 px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase">Продължителност на час (мин)</label>
                      <input
                        type="number"
                        min="10"
                        max="120"
                        value={schoolConfig.lessonDuration}
                        onChange={(e) => updateConfig('lessonDuration', parseInt(e.target.value))}
                        className="w-full mt-1 px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase">Стандартно междучасие (мин)</label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={schoolConfig.breakDuration}
                        onChange={(e) => updateConfig('breakDuration', parseInt(e.target.value))}
                        className="w-full mt-1 px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                     <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase">Брой часове</label>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={schoolConfig.totalPeriods}
                        onChange={(e) => updateConfig('totalPeriods', parseInt(e.target.value))}
                        className="w-full mt-1 px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                 </div>
  
                 <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <h3 className="font-semibold text-orange-800 mb-2">Голямо Междучасие</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                          <label className="text-xs text-orange-700 font-semibold uppercase">След кой час?</label>
                          <select
                            value={schoolConfig.longBreakAfterPeriod}
                            onChange={(e) => updateConfig('longBreakAfterPeriod', parseInt(e.target.value))}
                            className="w-full mt-1 px-3 py-2 border rounded-md border-orange-200 focus:ring-orange-500"
                          >
                            {Array.from({length: schoolConfig.totalPeriods - 1}).map((_, i) => (
                              <option key={i} value={i+1}>След {i+1} час</option>
                            ))}
                          </select>
                       </div>
                       <div>
                          <label className="text-xs text-orange-700 font-semibold uppercase">Продължителност (мин)</label>
                          <input
                            type="number"
                            min="0"
                            max="120"
                            value={schoolConfig.longBreakDuration}
                            onChange={(e) => updateConfig('longBreakDuration', parseInt(e.target.value))}
                            className="w-full mt-1 px-3 py-2 border rounded-md border-orange-200 focus:ring-orange-500"
                          />
                       </div>
                    </div>
                 </div>
              </div>
  
              <div className="w-full md:w-80 bg-gray-50 p-6 rounded-xl border">
                 <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                   <Clock size={16}/> Преглед на деня
                 </h3>
                 <div className="space-y-0">
                    {previewPeriods.map((period, index) => {
                       // Logic to determine break text
                       const breakIndex = index + 1;
                       let breakTime = schoolConfig.breakDuration;
                       let isSpecial = false;
                       let isLong = false;

                       if (schoolConfig.customBreaks[breakIndex] !== undefined) {
                           breakTime = schoolConfig.customBreaks[breakIndex];
                           isSpecial = true;
                       } else if (breakIndex === schoolConfig.longBreakAfterPeriod) {
                           breakTime = schoolConfig.longBreakDuration;
                           isSpecial = true;
                           isLong = true;
                       }

                       return (
                        <React.Fragment key={index}>
                          <div className="flex justify-between py-2 text-sm border-b border-gray-100 last:border-0">
                             <span className="font-bold text-gray-700">{index + 1}. Час</span>
                             <span className="font-mono text-gray-600 bg-white px-2 rounded border">{period}</span>
                          </div>
                          {index < previewPeriods.length - 1 && (
                            <div className="flex justify-center my-1">
                               <div className={`text-[10px] px-2 py-0.5 rounded-full ${isSpecial ? (isLong ? 'bg-orange-100 text-orange-700 font-bold' : 'bg-blue-100 text-blue-700 font-bold') : 'bg-gray-200 text-gray-500'}`}>
                                 {breakTime} мин. почивка
                               </div>
                            </div>
                          )}
                        </React.Fragment>
                       );
                    })}
                 </div>
              </div>
            </div>
            
            {/* Custom Breaks Table */}
            <div className="border-t pt-6">
                <h3 className="text-md font-bold text-gray-800 mb-3">Индивидуални Междучасия</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({length: schoolConfig.totalPeriods - 1}).map((_, i) => {
                        const periodIndex = i + 1;
                        const isLong = periodIndex === schoolConfig.longBreakAfterPeriod;
                        const customVal = schoolConfig.customBreaks[periodIndex];
                        const displayVal = customVal !== undefined ? customVal : (isLong ? schoolConfig.longBreakDuration : schoolConfig.breakDuration);
                        
                        return (
                            <div key={periodIndex} className={`p-3 border rounded-lg ${isLong ? 'bg-orange-50 border-orange-200' : 'bg-gray-50'}`}>
                                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                                    Между {periodIndex} и {periodIndex + 1} час
                                    {isLong && <span className="ml-2 text-orange-600">(Голямо)</span>}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        min="0"
                                        className={`w-full p-1.5 text-sm border rounded ${customVal !== undefined ? 'border-blue-400 ring-1 ring-blue-100' : 'border-gray-300'}`}
                                        value={displayVal}
                                        onChange={(e) => updateCustomBreak(periodIndex, parseInt(e.target.value) || 0)}
                                    />
                                    <span className="text-xs text-gray-500">мин</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;
