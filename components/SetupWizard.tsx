import React, { useState } from 'react';
import { Teacher, Room, ClassGroup, Subject, RoomType, SubjectType, SchoolConfig, SubjectCategory } from '../types';
import { Users, Layout, BookOpen, Trash2, Plus, Save, Filter, Clock, X, Library, Tag, Check, AlertCircle, Briefcase, Key, Pencil } from 'lucide-react';
import { generatePeriods, SUBJECT_ASSIGNMENT_TYPES } from '../constants';

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

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  [RoomType.CLASSROOM]: 'Класна стая',
  [RoomType.LAB_IT]: 'Компютърен кабинет',
  [RoomType.LAB_SCIENCE]: 'Лаборатория',
  [RoomType.GYM]: 'Физкултурен салон'
};

const SetupWizard: React.FC<SetupWizardProps> = ({
  teachers, rooms, classes, subjects, subjectCategories, schoolConfig,
  setTeachers, setRooms, setClasses, setSubjects, setSubjectCategories, setSchoolConfig
}) => {
  const [activeTab, setActiveTab] = useState<'teachers' | 'subjects' | 'rooms' | 'curriculum' | 'bells' | 'api'>('teachers');
  const [apiKey, setApiKey] = useState(localStorage.getItem('GEMINI_API_KEY') || '');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [addingSubjectToTeacher, setAddingSubjectToTeacher] = useState<string | null>(null);

  // New Subject Form State
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectType, setNewSubjectType] = useState<string>(SubjectType.HUMANITIES);
  const [newSubjectDifficulty, setNewSubjectDifficulty] = useState(5);
  const [newSubjectRoomType, setNewSubjectRoomType] = useState<RoomType | 'default'>('default');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

  // New Category State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // New Room State
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<RoomType>(RoomType.CLASSROOM);
  const [newRoomCapacity, setNewRoomCapacity] = useState(26);

  // Curriculum Editing State
  const [addingCurriculumToClass, setAddingCurriculumToClass] = useState<string | null>(null);
  const [newCurriculumState, setNewCurriculumState] = useState<{ subjectId: string, hours: number, teacherId: string, requiresDoublePeriod: boolean, assignmentType: string }>({
    subjectId: '',
    hours: 2,
    teacherId: '',
    requiresDoublePeriod: false,
    assignmentType: 'ООП'
  });

  // Ensure all teachers have colors
  React.useEffect(() => {
    let hasChanges = false;
    const colors = ['#e0f2fe', '#fce7f3', '#dcfce7', '#fef3c7', '#fae8ff', '#ffe4e6', '#ccfbf1', '#f3f4f6', '#fed7aa', '#d9f99d', '#bfdbfe', '#ddd6fe'];

    const updatedTeachers = teachers.map((t, index) => {
      if (!t.color) {
        hasChanges = true;
        return { ...t, color: colors[index % colors.length] };
      }
      return t;
    });

    if (hasChanges) {
      setTeachers(updatedTeachers);
    }
  }, [teachers.length]); // Run when teachers count changes, or initially



  // New Class Form State
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassData, setNewClassData] = useState({
    name: '',
    studentsCount: 26,
    shift: 1
  });

  const getCategoryName = (id: string) => {
    return subjectCategories.find(c => c.id === id)?.name || id;
  };

  const addTeacher = () => {
    const colors = ['#e0f2fe', '#fce7f3', '#dcfce7', '#fef3c7', '#fae8ff', '#ffe4e6', '#ccfbf1', '#f3f4f6'];
    const randomColor = colors[teachers.length % colors.length];

    const newTeacher: Teacher = {
      id: `t_${Date.now()}`,
      name: 'Нов Учител',
      subjects: [],
      maxHoursPerDay: 6,
      unwantedDays: [],
      constraints: { travels: false, cannotTeachLast: false, maxGaps: 2 },
      color: randomColor
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

    // Determine strict room requirement: 'default' means undefined/standard
    const requiresRoom = newSubjectRoomType === 'default' ? undefined : newSubjectRoomType;

    if (editingSubjectId) {
      // Update existing
      setSubjects(subjects.map(s => s.id === editingSubjectId ? {
        ...s,
        name: newSubjectName,
        type: newSubjectType,
        difficulty: newSubjectDifficulty,
        requiresRoomType: requiresRoom
      } : s));

      setEditingSubjectId(null);
    } else {
      // Create new
      const newSubject: Subject = {
        id: `sub_${Date.now()}`,
        name: newSubjectName,
        type: newSubjectType,
        difficulty: newSubjectDifficulty,
        requiresRoomType: requiresRoom
      };
      setSubjects([...subjects, newSubject]);
    }

    // Reset form
    setNewSubjectName('');
    setNewSubjectDifficulty(5);
    setNewSubjectRoomType('default');
  };

  const startEditingSubject = (subject: Subject) => {
    setEditingSubjectId(subject.id);
    setNewSubjectName(subject.name);
    setNewSubjectType(subject.type);
    setNewSubjectDifficulty(subject.difficulty);
    setNewSubjectRoomType(subject.requiresRoomType || 'default');

    // Scroll to form (optional UX)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditingSubject = () => {
    setEditingSubjectId(null);
    setNewSubjectName('');
    setNewSubjectDifficulty(5);
    setNewSubjectRoomType('default');
  };

  const deleteSubject = (id: string) => {
    if (window.confirm('Сигурни ли сте, че искате да изтриете този предмет? Това може да повлияе на разпределените часове.')) {
      setSubjects(subjects.filter(s => s.id !== id));
      // Cleanup teachers assigned to this subject
      setTeachers(teachers.map(t => ({
        ...t,
        subjects: t.subjects.filter(sId => sId !== id)
      })));

      if (editingSubjectId === id) {
        cancelEditingSubject();
      }
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

  // --- Room Actions ---
  const addRoom = () => {
    if (!newRoomName.trim()) return;
    const newRoom: Room = {
      id: `r_${Date.now()}`,
      name: newRoomName,
      type: newRoomType,
      capacity: newRoomCapacity
    };
    setRooms([newRoom, ...rooms]);
    setNewRoomName('');
    setNewRoomCapacity(26);
  };

  const updateRoom = (id: string, field: keyof Room, value: any) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteRoom = (id: string) => {
    if (window.confirm("Сигурни ли сте?")) {
      setRooms(rooms.filter(r => r.id !== id));
    }
  };

  // --- Curriculum Actions ---
  const saveNewClass = () => {
    const className = newClassData.name.trim();

    if (!className) {
      alert("Моля въведете име на класа.");
      return;
    }

    if (classes.some(c => c.name.toLowerCase() === className.toLowerCase())) {
      alert("Вече съществува клас с това име!");
      return;
    }

    const newClass: ClassGroup = {
      id: `c_${Date.now()}`,
      name: className,
      studentsCount: newClassData.studentsCount,
      shift: newClassData.shift as 1 | 2,
      curriculum: []
    };
    setClasses([newClass, ...classes]);

    // Reset form
    setIsAddingClass(false);
    setNewClassData({ name: '', studentsCount: 26, shift: 1 });
  };

  const deleteClass = (id: string) => {
    if (window.confirm("Сигурни ли сте? Всички данни за този клас ще бъдат загубени.")) {
      setClasses(classes.filter(c => c.id !== id));
    }
  };

  const updateClass = (id: string, field: keyof ClassGroup, value: any) => {
    setClasses(classes.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const updateCurriculumItem = (classId: string, subjectId: string, field: 'hoursPerWeek' | 'teacherId' | 'requiresDoublePeriod' | 'assignmentType', value: any) => {
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
    // Find first subject not in class OR allow duplicates if we want to support multiple types for same subject
    // For now, let's just pick the first subject available.
    // We will allow adding same subject multiple times, so we don't filter out used subjects strictly.
    const currentClass = classes.find(c => c.id === classId);
    const usedSubjects = currentClass?.curriculum.map(c => c.subjectId) || [];
    const availableSubject = subjects.find(s => !usedSubjects.includes(s.id)) || subjects[0];

    if (!availableSubject) {
      alert("Няма налични предмети.");
      return;
    }

    setAddingCurriculumToClass(classId);
    setNewCurriculumState({
      subjectId: availableSubject.id,
      hours: 2,
      teacherId: '',
      requiresDoublePeriod: false,
      assignmentType: 'ООП'
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
          teacherId: newCurriculumState.teacherId, // Can be empty string if unassigned
          requiresDoublePeriod: newCurriculumState.requiresDoublePeriod,
          assignmentType: newCurriculumState.assignmentType
        }]
      };
    }));

    setAddingCurriculumToClass(null);
  };

  const getTeacherColor = (id: string) => teachers.find(t => t.id === id)?.color || '#e5e7eb';

  const calculateTeacherWorkload = (teacherId: string) => {
    let total = 0;
    classes.forEach(c => {
      c.curriculum.forEach(curr => {
        if (curr.teacherId === teacherId) {
          total += curr.hoursPerWeek;
        }
      });
    });
    return total;
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
        <button
          onClick={() => setActiveTab('api')}
          className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 min-w-fit ${activeTab === 'api' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Key size={18} /> API
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
                  className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${subjectFilter === 'ALL'
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
                    className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${subjectFilter === cat.id
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
              <div key={teacher.id} className="p-4 border rounded-lg bg-gray-50 flex flex-col gap-4 relative">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 font-semibold uppercase">Име</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={teacher.color || '#e0f2fe'}
                        onChange={(e) => updateTeacher(teacher.id, 'color', e.target.value)}
                        className="h-[42px] w-[50px] p-1 border rounded-md cursor-pointer"
                        title="Цвят на учителя в графика"
                      />
                      <input
                        type="text"
                        value={teacher.name}
                        onChange={(e) => updateTeacher(teacher.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        style={{ borderLeftColor: teacher.color || '#e5e7eb', borderLeftWidth: '4px' }}
                      />
                    </div>
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-gray-500 font-semibold uppercase text-indigo-600" title="Общ брой часове за седмицата">Часове / Седмица</label>
                    <div className="w-full mt-1 px-3 py-2 border rounded-md bg-indigo-50 text-indigo-700 font-bold text-center">
                      {calculateTeacherWorkload(teacher.id)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[300px]">
                    <label className="text-xs text-gray-500 font-semibold uppercase mb-2 block">
                      Квалификация {subjectFilter !== 'ALL' && `(${getCategoryName(subjectFilter)})`}
                    </label>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 border rounded-lg p-2 max-h-60 overflow-y-auto bg-white shadow-inner">
                      {subjects
                        .filter(sub => subjectFilter === 'ALL' || sub.type === subjectFilter)
                        .map(sub => {
                          const isAssigned = teacher.subjects.includes(sub.id);
                          return (
                            <label key={sub.id} className={`flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer transition-all border select-none h-full ${isAssigned ? 'bg-indigo-50 border-indigo-200 text-indigo-900 ring-1 ring-indigo-500 shadow-sm' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50 text-gray-600'}`}>
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    updateTeacher(teacher.id, 'subjects', [...teacher.subjects, sub.id]);
                                  } else {
                                    updateTeacher(teacher.id, 'subjects', teacher.subjects.filter(s => s !== sub.id));
                                  }
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 w-4 h-4 flex-shrink-0"
                              />
                              <div className="flex flex-col leading-tight overflow-hidden">
                                <span className="font-medium truncate" title={sub.name}>{sub.name}</span>
                                <span className="text-[10px] text-gray-400 truncate">{getCategoryName(sub.type)}</span>
                              </div>
                            </label>
                          );
                        })
                      }
                      {subjects.length === 0 && (
                        <div className="col-span-full text-center text-gray-400 text-xs py-4">
                          Няма добавени предмети. Отидете в таб "Предмети & Типове".
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setTeachers(teachers.filter(t => t.id !== teacher.id))}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Working Conditions Footer */}
                <div className="w-full pt-3 mt-1 border-t border-gray-200/60 flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Briefcase size={14} className="text-indigo-400" />
                    <span className="font-semibold uppercase text-[10px] text-gray-400 tracking-wider">Условия на труд:</span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer group" title="Забрана за 1-ви час">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={teacher.constraints?.travels || false}
                        onChange={(e) => updateTeacher(teacher.id, 'constraints', { ...teacher.constraints, travels: e.target.checked })}
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                    <span className="text-xs text-gray-600 group-hover:text-indigo-700 transition-colors">Пътуващ (Без 1-ви час)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer group" title="Забрана за последен час">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={teacher.constraints?.cannotTeachLast || false}
                        onChange={(e) => updateTeacher(teacher.id, 'constraints', { ...teacher.constraints, cannotTeachLast: e.target.checked })}
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                    </div>
                    <span className="text-xs text-gray-600 group-hover:text-orange-700 transition-colors">Без последен час</span>
                  </label>

                  <div className="flex items-center gap-2 ml-auto">
                    <label className="flex items-center gap-2 cursor-pointer group mr-4" title="Ресурсен учител (работи с отделни ученици)">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={teacher.isResourceTeacher || false}
                          onChange={(e) => updateTeacher(teacher.id, 'isResourceTeacher', e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                      </div>
                      <span className="text-xs text-gray-600 group-hover:text-purple-700 transition-colors">Ресурсен</span>
                    </label>

                    <label className="text-xs text-gray-600">Макс. прозорци:</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      className="w-12 border rounded px-1 py-0.5 text-xs text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      value={teacher.constraints?.maxGaps || 0}
                      onChange={(e) => updateTeacher(teacher.id, 'constraints', { ...teacher.constraints, maxGaps: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-6">
              <h2 className="text-lg font-semibold text-gray-800">Управление на Предмети</h2>

              {/* Create Subject Form */}
              <div className="p-5 bg-gray-50 border rounded-xl shadow-sm relative transition-all border-l-4 border-l-indigo-600">
                <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center justify-between">
                  <span>{editingSubjectId ? 'Редактиране на предмет' : 'Добави нов предмет'}</span>
                  {editingSubjectId && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Режим редакция</span>
                  )}
                </h3>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                    <div className="flex-1 w-full">
                      <label className="text-xs text-gray-500 font-semibold mb-1.5 block">Изисква кабинет (избираемо)</label>
                      <select
                        value={newSubjectRoomType}
                        onChange={(e) => setNewSubjectRoomType(e.target.value as RoomType | 'default')}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        <option value="default">Стандартен (Без значение)</option>
                        {Object.entries(ROOM_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full">
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
                  </div>

                  <div className="flex gap-2">
                    {editingSubjectId && (
                      <button
                        onClick={cancelEditingSubject}
                        className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                      >
                        Откажи
                      </button>
                    )}
                    <button
                      onClick={addSubject}
                      className={`flex-1 px-6 py-2.5 ${editingSubjectId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg flex items-center justify-center gap-2 shadow-sm font-medium transition-colors`}
                    >
                      {editingSubjectId ? <Save size={18} /> : <Plus size={18} />}
                      {editingSubjectId ? 'Запази промените' : 'Добави'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Subjects List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subjects.map(subject => (
                  <div key={subject.id} className="p-3 border rounded-lg bg-white shadow-sm flex justify-between items-center group relative hover:border-indigo-300 transition-colors">
                    <div className="flex-1 cursor-pointer" onClick={() => startEditingSubject(subject)} title="Кликни за редакция">
                      <div className="font-bold text-gray-800">{subject.name}</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{getCategoryName(subject.type)}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-orange-50 rounded-full text-orange-600">Сложност: {subject.difficulty}</span>
                        {subject.requiresRoomType && (
                          <span className="text-[10px] px-2 py-0.5 bg-purple-50 rounded-full text-purple-600 border border-purple-100">
                            🏠 {ROOM_TYPE_LABELS[subject.requiresRoomType] || subject.requiresRoomType}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditingSubject(subject)}
                        className="text-gray-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded"
                        title="Редактирай"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => deleteSubject(subject.id)}
                        className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded"
                        title="Изтрий"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories Management Sidebar */}
            <div className="w-full lg:w-80 space-y-4">
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2"><Tag size={16} /> Категории</h3>
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
                        <Plus size={16} />
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
                          <Trash2 size={14} />
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
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800">Материална База</h2>

            {/* Add Room Form */}
            <div className="p-5 bg-gray-50 border rounded-xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 uppercase mb-4">Добави нова стая/кабинет</h3>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 font-semibold mb-1.5 block">Име / Номер</label>
                  <input
                    type="text"
                    placeholder="напр. 203"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 font-semibold mb-1.5 block">Тип</label>
                  <select
                    value={newRoomType}
                    onChange={(e) => setNewRoomType(e.target.value as RoomType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-indigo-500"
                  >
                    {Object.values(RoomType).map(type => (
                      <option key={type} value={type}>{ROOM_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="text-xs text-gray-500 font-semibold mb-1.5 block">Места</label>
                  <input
                    type="number"
                    min="1"
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={addRoom}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Plus size={18} /> Добави
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map(room => (
                <div key={room.id} className="p-4 border rounded-lg bg-white shadow-sm flex flex-col gap-3 group">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Име</label>
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => updateRoom(room.id, 'name', e.target.value)}
                        className="w-full px-2 py-1 text-sm font-bold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => deleteRoom(room.id)}
                      className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Тип</label>
                      <select
                        value={room.type}
                        onChange={(e) => updateRoom(room.id, 'type', e.target.value)}
                        className="w-full text-xs px-2 py-1 border rounded bg-gray-50 text-gray-700"
                      >
                        {Object.values(RoomType).map(type => (
                          <option key={type} value={type}>{ROOM_TYPE_LABELS[type]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Капацитет</label>
                      <input
                        type="number"
                        value={room.capacity}
                        onChange={(e) => updateRoom(room.id, 'capacity', parseInt(e.target.value))}
                        className="w-full text-xs px-2 py-1 border rounded bg-gray-50 text-gray-700"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'curriculum' && (
          <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Учебен План по Класове</h2>
              <button onClick={() => setIsAddingClass(true)} className="btn-primary bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                <Plus size={16} /> Добави Клас
              </button>
            </div>

            {isAddingClass && (
              <div className="border rounded-xl overflow-hidden shadow-sm bg-indigo-50 border-indigo-200 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-3 border-b border-indigo-200 flex flex-wrap gap-4 justify-between items-center">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-indigo-700 font-bold uppercase">Име на Клас</label>
                      <input
                        type="text"
                        placeholder="напр. 8 А"
                        autoFocus
                        value={newClassData.name}
                        onChange={(e) => setNewClassData({ ...newClassData, name: e.target.value })}
                        className="bg-white border border-indigo-300 rounded px-2 py-1 text-sm font-bold w-32 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-indigo-700 font-bold uppercase">Ученици</label>
                      <input
                        type="number"
                        min="1"
                        value={newClassData.studentsCount}
                        onChange={(e) => setNewClassData({ ...newClassData, studentsCount: parseInt(e.target.value) })}
                        className="bg-white border border-indigo-300 rounded px-2 py-1 text-sm w-20 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-indigo-700 font-bold uppercase">Смяна</label>
                      <select
                        value={newClassData.shift}
                        onChange={(e) => setNewClassData({ ...newClassData, shift: parseInt(e.target.value) })}
                        className="bg-white border border-indigo-300 rounded px-2 py-1 text-sm w-24 focus:ring-indigo-500"
                      >
                        <option value={1}>Първа</option>
                        <option value={2}>Втора</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveNewClass}
                      className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700 font-medium"
                    >
                      <Check size={16} /> Запази
                    </button>
                    <button
                      onClick={() => setIsAddingClass(false)}
                      className="flex items-center gap-1 bg-white text-gray-600 border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50 font-medium"
                    >
                      <X size={16} /> Отказ
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="p-4">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                      <tr>
                        <th className="px-3 py-2 w-[25%]">Предмет</th>
                        <th className="px-3 py-2 w-[20%]">Тип</th>
                        <th className="px-3 py-2 w-[10%]">Хорариум</th>
                        <th className="px-3 py-2 w-[10%]">Блок?</th>
                        <th className="px-3 py-2 w-[25%]">Преподавател</th>
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
                              <select
                                className="w-full border rounded px-1 py-1 text-xs text-gray-600"
                                value={item.assignmentType || 'ООП'}
                                onChange={(e) => updateCurriculumItem(cls.id, item.subjectId, 'assignmentType', e.target.value)}
                              >
                                {Object.entries(SUBJECT_ASSIGNMENT_TYPES).map(([key, label]) => (
                                  <option key={key} value={key} title={label}>{key}</option>
                                ))}
                              </select>
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
                              <label className="flex items-center gap-2 cursor-pointer group" title="Изисквай сдвоен час (блок)">
                                <div className="relative flex items-center">
                                  <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={item.requiresDoublePeriod || false}
                                    onChange={(e) => updateCurriculumItem(cls.id, item.subjectId, 'requiresDoublePeriod', e.target.checked)}
                                  />
                                  <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                </div>
                                <span className="text-[10px] text-gray-400 group-hover:text-indigo-600">Да</span>
                              </label>
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
                              </select>
                              {qualifiedTeachers.length === 0 && (
                                <div className="text-[10px] text-red-500 flex items-center gap-1 mt-1">
                                  <AlertCircle size={10} /> Няма квалифицирани учители!
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => removeSubjectFromClass(cls.id, item.subjectId)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={16} />
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
                              onChange={(e) => setNewCurriculumState({ ...newCurriculumState, subjectId: e.target.value, teacherId: '' })}
                            >
                              <option value="">Избери предмет...</option>
                              {subjects.map(s => {
                                const existingEntries = cls.curriculum.filter(c => c.subjectId === s.id);
                                let label = `${s.name} (${getCategoryName(s.type)})`;
                                let className = "";

                                if (existingEntries.length > 0) {
                                  const types = existingEntries.map(e => e.assignmentType || 'ООП').join(', ');
                                  label += ` (Вече добавен като: ${types})`;
                                  className = "text-indigo-600 font-bold bg-indigo-50";
                                }

                                return (
                                  <option key={s.id} value={s.id} className={className}>
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="w-full border border-indigo-300 rounded px-2 py-1 text-sm focus:ring-indigo-500"
                              value={newCurriculumState.assignmentType}
                              onChange={(e) => setNewCurriculumState({ ...newCurriculumState, assignmentType: e.target.value })}
                            >
                              {Object.entries(SUBJECT_ASSIGNMENT_TYPES).map(([key, label]) => (
                                <option key={key} value={key} title={label}>{key} - {label.split('–')[1]?.trim() || label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="1"
                              className="w-16 border border-indigo-300 rounded px-2 py-1 text-sm"
                              value={newCurriculumState.hours}
                              onChange={(e) => setNewCurriculumState({ ...newCurriculumState, hours: parseInt(e.target.value) })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer" title="Изисквай сдвоен час (блок)">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                checked={newCurriculumState.requiresDoublePeriod}
                                onChange={(e) => setNewCurriculumState({ ...newCurriculumState, requiresDoublePeriod: e.target.checked })}
                              />
                              <span className="text-xs text-gray-600">Блок</span>
                            </label>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="w-full border border-indigo-300 rounded px-2 py-1 text-sm"
                              value={newCurriculumState.teacherId}
                              onChange={(e) => setNewCurriculumState({ ...newCurriculumState, teacherId: e.target.value })}
                              disabled={!newCurriculumState.subjectId}
                              style={{
                                borderLeftColor: getTeacherColor(newCurriculumState.teacherId),
                                borderLeftWidth: '4px'
                              }}
                            >
                              <option value="">-- Избери учител --</option>
                              {teachers
                                .filter(t => t.subjects.includes(newCurriculumState.subjectId))
                                .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                              }
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right flex justify-end gap-2">
                            <button onClick={confirmAddCurriculum} className="text-indigo-600 hover:text-indigo-800 bg-indigo-100 p-1 rounded"><Check size={16} /></button>
                            <button onClick={() => setAddingCurriculumToClass(null)} className="text-gray-500 hover:text-gray-700 bg-gray-100 p-1 rounded"><X size={16} /></button>
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-3 text-center border-t border-dashed border-gray-200">
                            <button
                              onClick={() => startAddingCurriculum(cls.id)}
                              className="text-indigo-600 text-sm font-medium hover:text-indigo-800 flex items-center justify-center gap-1 mx-auto py-1 px-3 hover:bg-indigo-50 rounded transition-colors"
                            >
                              <Plus size={14} /> Добави Предмет
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {classes.length === 0 && !isAddingClass && (
              <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500 mb-2">Все още няма добавени класове.</p>
                <button onClick={() => setIsAddingClass(true)} className="text-indigo-600 font-bold hover:underline">Добави първия клас</button>
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
                        {Array.from({ length: schoolConfig.totalPeriods - 1 }).map((_, i) => (
                          <option key={i} value={i + 1}>След {i + 1} час</option>
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
                  <Clock size={16} /> Преглед на деня
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
                {Array.from({ length: schoolConfig.totalPeriods - 1 }).map((_, i) => {
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

        {activeTab === 'api' && (
          <div className="max-w-2xl mx-auto space-y-8 py-8">
            <div className="text-center space-y-2">
              <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Key size={32} className="text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Gemini AI Конфигурация</h2>
              <p className="text-gray-500">
                За да използвате функциите за автоматично генериране и анализ, е необходим валиден API ключ от Google Gemini.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Google Gemini API Key</label>
                <div className="relative">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-sm"
                  />
                  <Key className="absolute left-3 top-3.5 text-gray-400" size={18} />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Ключът се съхранява локално във вашия браузър (Local Storage).
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    localStorage.setItem('GEMINI_API_KEY', apiKey);
                    alert('API ключът е запазен успешно!');
                  }}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Запази Ключа
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('GEMINI_API_KEY');
                    setApiKey('');
                    alert('API ключът е изтрит.');
                  }}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Изчисти
                </button>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3">
              <div className="bg-blue-100 p-2 rounded-full h-fit">
                <BookOpen size={20} className="text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-blue-800 text-sm mb-1">Как да взема ключ?</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  1. Посетете <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-blue-900">Google AI Studio</a>.<br />
                  2. Влезте с Google акаунт.<br />
                  3. Натиснете "Create API key".<br />
                  4. Копирайте ключа и го поставете тук.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;
