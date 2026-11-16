import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  ImagePlus,
  LogOut,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Course, COURSES } from '../data/academyData';
import {
  DynamicTeacher,
  EDUCATIONAL_STAGES,
  EducationalStage,
  StudentRecord,
} from '../types/student';
import {
  apiAddCourse,
  apiAddTeacher,
  apiDeleteCourse,
  apiDeleteTeacher,
  apiFetchSupervisorStudents,
  apiUpdateSupervisorStudent,
} from '../utils/apiClient';
import {
  fetchAllFirebaseStudents,
  updateFirebaseStudentBySupervisor,
} from '../services/firebaseStudents';
import { ResilientImage } from './ResilientImage';

export type AdminTab = 'students' | 'teachers' | 'courses';

interface SupervisorDashboardProps {
  supervisorName: string;
  supervisorPhone: string;
  token: string;
  initialTab?: AdminTab;
  teachers: DynamicTeacher[];
  customCourses: Course[];
  onCatalogUpdated: () => Promise<void> | void;
  onLogout: () => void;
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 640;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('تعذر تحميل الملف.'));
    reader.readAsDataURL(file);
  });
}

export function SupervisorDashboard({
  supervisorName,
  supervisorPhone,
  token,
  initialTab = 'students',
  teachers,
  customCourses,
  onCatalogUpdated,
  onLogout,
}: SupervisorDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('جميع المراحل');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  const [editNotes, setEditNotes] = useState('');
  const [editAttendance, setEditAttendance] = useState<number>(100);
  const [editCourses, setEditCourses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Teacher form state
  const [teacherName, setTeacherName] = useState('');
  const [teacherSubject, setTeacherSubject] = useState('');
  const [teacherImage, setTeacherImage] = useState('');
  const [teacherGrades, setTeacherGrades] = useState<EducationalStage[]>([
    'الصف الثالث الثانوي',
  ]);
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [teacherFeedback, setTeacherFeedback] = useState('');

  // Course form state
  const [courseTitle, setCourseTitle] = useState('');
  const [courseSubtitle, setCourseSubtitle] = useState('');
  const [courseGrade, setCourseGrade] =
    useState<EducationalStage>('الصف الثالث الثانوي');
  const [courseTeacherId, setCourseTeacherId] = useState('');
  const [courseMode, setCourseMode] = useState<'أونلاين' | 'سنتر وأونلاين'>(
    'سنتر وأونلاين'
  );
  const [coursePrice, setCoursePrice] = useState('250');
  const [courseLessonsText, setCourseLessonsText] = useState('');
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseFeedback, setCourseFeedback] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (teachers.length > 0 && !courseTeacherId) {
      setCourseTeacherId(teachers[0].id);
    }
  }, [teachers, courseTeacherId]);

  const allCourses = useMemo(
    () => [...customCourses, ...COURSES],
    [customCourses]
  );

  const loadStudents = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (token === 'firebase-google-session') {
        const fbStudents = await fetchAllFirebaseStudents();
        setStudents(fbStudents);
        return;
      }
      const result = await apiFetchSupervisorStudents(token);
      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }
      setStudents(result.students);
    } catch {
      setErrorMsg('تعذر تحميل بيانات الطلاب من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const matchesStage = stageFilter === 'جميع المراحل' || s.stage === stageFilter;
      const matchesQuery =
        !q ||
        s.studentName.toLowerCase().includes(q) ||
        s.studentPhone.includes(q) ||
        s.parentName.toLowerCase().includes(q) ||
        s.parentPhone.includes(q) ||
        s.motherName.toLowerCase().includes(q) ||
        s.specialization.toLowerCase().includes(q);
      return matchesStage && matchesQuery;
    });
  }, [students, searchQuery, stageFilter]);

  const openStudentFollowUp = (student: StudentRecord) => {
    setSelectedStudent(student);
    setEditNotes(student.supervisorNotes);
    setEditAttendance(student.attendanceRate);
    setEditCourses(student.unlockedCourseIds);
    setSavedNotice(false);
  };

  const toggleCourseForStudent = (courseId: string) => {
    setEditCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    setSavedNotice(false);
    try {
      if (token === 'firebase-google-session') {
        const updated = await updateFirebaseStudentBySupervisor(selectedStudent.id, {
          supervisorNotes: editNotes,
          attendanceRate: editAttendance,
          unlockedCourseIds: editCourses,
        });
        setStudents((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        setSelectedStudent(updated);
        setSavedNotice(true);
        return;
      }

      const result = await apiUpdateSupervisorStudent(selectedStudent.id, token, {
        supervisorNotes: editNotes,
        attendanceRate: editAttendance,
        unlockedCourseIds: editCourses,
      });
      if (result.ok) {
        setStudents((prev) =>
          prev.map((s) => (s.id === result.student.id ? result.student : s))
        );
        setSelectedStudent(result.student);
        setSavedNotice(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTeacherFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setTeacherImage(compressed);
    } catch {
      setTeacherFeedback('تعذر معالجة الصورة المختارة. جرّب صورة أخرى.');
    }
  };

  const toggleTeacherGrade = (stage: EducationalStage) => {
    setTeacherGrades((prev) =>
      prev.includes(stage) ? prev.filter((g) => g !== stage) : [...prev, stage]
    );
  };

  const handleAddTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherFeedback('');
    setTeacherSaving(true);
    try {
      const res = await apiAddTeacher(token, {
        name: teacherName,
        subject: teacherSubject,
        grades: teacherGrades,
        image: teacherImage,
      });
      if (!res.ok) {
        setTeacherFeedback(res.error);
        return;
      }
      setTeacherName('');
      setTeacherSubject('');
      setTeacherImage('');
      setTeacherGrades(['الصف الثالث الثانوي']);
      setTeacherFeedback('تمت إضافة المدرس بنجاح وظهوره في الصفحة الأولى.');
      await onCatalogUpdated();
    } finally {
      setTeacherSaving(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    const ok = await apiDeleteTeacher(token, teacherId);
    if (ok) {
      await onCatalogUpdated();
    }
  };

  const handleAddCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseFeedback('');
    if (!courseTeacherId && teachers.length === 0) {
      setCourseFeedback('أضف مدرسًا أولًا من تبويب إدارة المدرسين لربط الكورس به.');
      return;
    }
    const chosenTeacher = teachers.find((t) => t.id === courseTeacherId);
    setCourseSaving(true);
    try {
      const lessonTitles = courseLessonsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await apiAddCourse(token, {
        title: courseTitle,
        subtitle: courseSubtitle,
        grade: courseGrade,
        category: chosenTeacher?.subject || 'محتوى المنهج',
        instructorId: chosenTeacher?.id || courseTeacherId || 'inst-custom',
        studyMode: courseMode,
        priceEgp: Number(coursePrice) || 250,
        image: chosenTeacher?.image || '',
        lessonTitles,
      });
      if (!res.ok) {
        setCourseFeedback(res.error);
        return;
      }
      setCourseTitle('');
      setCourseSubtitle('');
      setCourseLessonsText('');
      setCourseFeedback(`تمت إضافة الكورس بنجاح لطلاب ${courseGrade}.`);
      await onCatalogUpdated();
    } finally {
      setCourseSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    const ok = await apiDeleteCourse(token, courseId);
    if (ok) {
      await onCatalogUpdated();
    }
  };

  const bacCount = students.filter((s) => s.stage === 'البكالوريا').length;
  const secCount = students.filter((s) => s.stage !== 'البكالوريا').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>إدارة المنصة · {supervisorPhone}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            إدارة المدرسين والكورسات ومتابعة الطلاب
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            مرحباً {supervisorName} — أضف المدرسين بصورهم وموادهم، خصص الكورسات لكل مرحلة دراسية، وتابع بيانات الطلاب.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-1.5">إجمالي الطلاب المسجلين</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{students.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-1.5">طلاب الثانوي / البكالوريا</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {secCount} / {bacCount}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-1.5">المدرسون المضافون</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{teachers.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-1.5">الكورسات المضافة</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {customCourses.length}
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="أقسام الإدارة"
        className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-lg overflow-x-auto w-fit"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'students'}
          onClick={() => setActiveTab('students')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'students'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>بيانات ومتابعة الطلاب</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'teachers'}
          onClick={() => setActiveTab('teachers')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'teachers'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>إدارة المدرسين</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'courses'}
          onClick={() => setActiveTab('courses')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'courses'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>إدارة كورسات المراحل</span>
        </button>
      </div>

      {activeTab === 'teachers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleAddTeacherSubmit}
            className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">إضافة مدرس جديد</h2>
            <p className="text-xs text-slate-500">
              يظهر المدرس مباشرة في شريط التمرير بالصفحة الأولى للمنصة.
            </p>

            <div>
              <label
                htmlFor="teacher-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                اسم المدرس
              </label>
              <input
                id="teacher-name-input"
                type="text"
                required
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="مثال: أ. أحمد محمود"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="teacher-subject-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                المادة الدراسية
              </label>
              <input
                id="teacher-subject-input"
                type="text"
                required
                value={teacherSubject}
                onChange={(e) => setTeacherSubject(e.target.value)}
                placeholder="مثال: الرياضيات، الفيزياء، الكيمياء..."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                صورة المدرس
              </span>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer">
                  <ImagePlus className="w-4 h-4 text-blue-700" />
                  <span>رفع صورة من الجهاز</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTeacherFileChange}
                    className="hidden"
                  />
                </label>
                {teacherImage && (
                  <button
                    type="button"
                    onClick={() => setTeacherImage('')}
                    className="text-xs text-red-700 hover:underline"
                  >
                    إزالة الصورة
                  </button>
                )}
              </div>
              <input
                type="url"
                dir="ltr"
                value={teacherImage.startsWith('data:') ? '' : teacherImage}
                onChange={(e) => setTeacherImage(e.target.value)}
                placeholder="أو الصق رابط الصورة مباشرة (https://...)"
                className="mt-2 w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              {teacherImage && (
                <div className="mt-3 w-28 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={teacherImage}
                    alt="معاينة صورة المدرس"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              )}
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-2">
                المراحل التي يدرسها
              </span>
              <div className="grid grid-cols-2 gap-2">
                {EDUCATIONAL_STAGES.map((stage) => {
                  const selected = teacherGrades.includes(stage);
                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => toggleTeacherGrade(stage)}
                      className={`px-3 py-2 text-xs rounded-lg border text-right transition-colors cursor-pointer ${
                        selected
                          ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {stage}
                    </button>
                  );
                })}
              </div>
            </div>

            {teacherFeedback && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-900">
                {teacherFeedback}
              </div>
            )}

            <button
              type="submit"
              disabled={teacherSaving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{teacherSaving ? 'جاري الإضافة...' : 'إضافة المدرس للمنصة'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                المدرسون الحاليون في الصفحة الأولى
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                {teachers.length} مدرس
              </span>
            </div>

            {teachers.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                لم تقم بإضافة مدرسين بعد. استخدم النموذج لإضافة أول مدرس بصورته واسمه ومادته.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {teachers.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between bg-slate-50/40"
                  >
                    <div>
                      <div className="aspect-[4/3] bg-slate-100 border-b border-slate-200 overflow-hidden">
                        <ResilientImage
                          src={t.image}
                          alt={t.name}
                          fallbackTitle={t.name}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      <div className="p-4 space-y-1.5">
                        <h3 className="text-base font-bold text-slate-900">{t.name}</h3>
                        <div className="text-xs font-semibold text-blue-700">
                          مدرس مادة: {t.subject}
                        </div>
                        <div className="text-xs text-slate-500">{t.grades.join(' · ')}</div>
                      </div>
                    </div>
                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        onClick={() => handleDeleteTeacher(t.id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف المدرس</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleAddCourseSubmit}
            className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">إضافة كورس لمرحلة دراسية</h2>
            <p className="text-xs text-slate-500">
              يظهر الكورس تلقائيًا لطلاب المرحلة (السنة) المحددة فقط عند تسجيل دخولهم.
            </p>

            <div>
              <label
                htmlFor="course-grade-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                المرحلة الدراسية (السنة)
              </label>
              <select
                id="course-grade-select"
                value={courseGrade}
                onChange={(e) => setCourseGrade(e.target.value as EducationalStage)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {EDUCATIONAL_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="course-teacher-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                المدرس المسؤول عن الكورس
              </label>
              <select
                id="course-teacher-select"
                value={courseTeacherId}
                onChange={(e) => setCourseTeacherId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {teachers.length === 0 ? (
                  <option value="">أضف مدرسًا أولًا من تبويب إدارة المدرسين</option>
                ) : (
                  teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="course-title-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                اسم الكورس
              </label>
              <input
                id="course-title-input"
                type="text"
                required
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="مثال: الباب الأول — التفاضل وتطبيقاته"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="course-subtitle-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                وصف مختصر للكورس
              </label>
              <input
                id="course-subtitle-input"
                type="text"
                value={courseSubtitle}
                onChange={(e) => setCourseSubtitle(e.target.value)}
                placeholder="محتوى الكورس وأبرز النقاط المغطاة"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="course-mode-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  نظام الحضور
                </label>
                <select
                  id="course-mode-select"
                  value={courseMode}
                  onChange={(e) =>
                    setCourseMode(e.target.value as 'أونلاين' | 'سنتر وأونلاين')
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  <option value="سنتر وأونلاين">سنتر وأونلاين</option>
                  <option value="أونلاين">أونلاين</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="course-price-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  السعر الشهري (ج.م)
                </label>
                <input
                  id="course-price-input"
                  type="number"
                  min={0}
                  value={coursePrice}
                  onChange={(e) => setCoursePrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="course-lessons-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                عناوين الحصص (كل حصة في سطر)
              </label>
              <textarea
                id="course-lessons-input"
                rows={4}
                value={courseLessonsText}
                onChange={(e) => setCourseLessonsText(e.target.value)}
                placeholder={'الحصة 1: الأساسيات\nالحصة 2: حل تمارين شاملة\nالحصة 3: امتحان تطبيقي'}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            {courseFeedback && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-900">
                {courseFeedback}
              </div>
            )}

            <button
              type="submit"
              disabled={courseSaving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{courseSaving ? 'جاري الحفظ...' : 'إضافة الكورس للمرحلة'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">الكورسات المضافة حسب المرحلة</h2>
              <span className="text-xs text-slate-500 tabular-nums">
                {customCourses.length} كورس مضاف
              </span>
            </div>

            {customCourses.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                لم تقم بإضافة كورسات خاصة بعد. عند إضافة كورس لأي مرحلة، سيظهر لطلاب تلك السنة فقط.
              </div>
            ) : (
              <div className="space-y-3">
                {customCourses.map((c) => {
                  const teacher = teachers.find((t) => t.id === c.instructorId);
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-blue-700">
                          {c.grade} · {teacher ? teacher.name : c.category}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{c.title}</h3>
                        <p className="text-xs text-slate-500">{c.subtitle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCourse(c.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الطالب، رقم الطالب، رقم ولي الأمر، أو اسم الأم..."
                aria-label="بحث في الطلاب"
                className="w-full pr-10 pl-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <select
              aria-label="تصفية حسب المرحلة"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <option value="جميع المراحل">جميع المراحل</option>
              {EDUCATIONAL_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-900">
              {errorMsg}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">سجل بيانات الطلاب الكامل</h2>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {filteredStudents.length} طالب
              </span>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">
                جاري تحميل بيانات الطلاب...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                لا يوجد طلاب مطابقون لبحثك الحالي.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        اسم الطالب ورقمه
                      </th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        ولي الأمر ورقمه
                      </th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">اسم الأم</th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        المرحلة والشعبة/المسار
                      </th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        الحضور والإنجاز
                      </th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((stu) => (
                      <tr key={stu.id} className="hover:bg-slate-50/70">
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-900">{stu.studentName}</div>
                          <div
                            className="font-mono text-xs text-slate-500 mt-0.5 tabular-nums"
                            dir="ltr"
                          >
                            {stu.studentPhone}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-slate-800">{stu.parentName}</div>
                          <div
                            className="font-mono text-xs text-slate-500 mt-0.5 tabular-nums"
                            dir="ltr"
                          >
                            {stu.parentPhone}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-700">{stu.motherName}</td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-slate-900">{stu.stage}</div>
                          <div className="text-xs text-blue-700 mt-0.5">
                            {stu.specializationType}: {stu.specialization}
                          </div>
                        </td>
                        <td className="py-4 px-4 tabular-nums">
                          <div className="font-semibold text-slate-900">
                            حضور {stu.attendanceRate}%
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {stu.completedLessonIds.length} حصص · {stu.unlockedCourseIds.length}{' '}
                            كورسات
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <button
                            type="button"
                            onClick={() => openStudentFollowUp(stu)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            متابعة وتعديل
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sup-student-detail-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 id="sup-student-detail-title" className="text-lg font-bold text-slate-900">
                  ملف متابعة الطالب: {selectedStudent.studentName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedStudent.stage} · {selectedStudent.specializationType}:{' '}
                  {selectedStudent.specialization}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                aria-label="إغلاق"
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-lg border border-slate-200 p-4 text-xs">
              <div>
                <span className="text-slate-500">رقم الطالب:</span>
                <div className="font-mono font-semibold text-slate-900 mt-0.5" dir="ltr">
                  {selectedStudent.studentPhone}
                </div>
              </div>
              <div>
                <span className="text-slate-500">اسم ولي الأمر ورقمه:</span>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {selectedStudent.parentName} —{' '}
                  <span className="font-mono" dir="ltr">
                    {selectedStudent.parentPhone}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-500">اسم الأم:</span>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {selectedStudent.motherName}
                </div>
              </div>
              <div>
                <span className="text-slate-500">تاريخ التسجيل:</span>
                <div className="font-mono text-slate-900 mt-0.5 tabular-nums">
                  {new Date(selectedStudent.createdAt).toLocaleDateString('ar-EG')}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveFollowUp} className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <label htmlFor="sup-attendance-slider">نسبة الحضور والالتزام</label>
                  <span className="font-mono text-blue-700 tabular-nums">{editAttendance}%</span>
                </div>
                <input
                  id="sup-attendance-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={editAttendance}
                  onChange={(e) => setEditAttendance(Number(e.target.value))}
                  className="w-full accent-blue-700 cursor-pointer"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  الكورسات المفعلة للطالب ({selectedStudent.stage})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {allCourses
                    .filter((c) => c.grade === selectedStudent.stage)
                    .map((c) => {
                      const active = editCourses.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCourseForStudent(c.id)}
                          className={`p-2.5 text-right rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 ${
                            active
                              ? 'bg-blue-50 border-blue-300 text-blue-950 font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{c.title}</span>
                          {active && <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="sup-notes-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  ملاحظات المتابعة
                </label>
                <textarea
                  id="sup-notes-input"
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              {savedNotice && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>تم حفظ التعديلات وتحديث ملف الطالب بنجاح.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'جاري الحفظ...' : 'حفظ المتابعة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
