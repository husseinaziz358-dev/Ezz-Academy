/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Lock,
  Menu,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  Course,
  CourseCategory,
  COURSES,
  getCourseAllLessons,
  getCourseTotalLessons,
  getInstructorById,
  GradeStage,
  HERO_IMAGE,
} from './data/academyData';
import {
  DynamicTeacher,
  EDUCATIONAL_STAGES,
  StudentRecord,
} from './types/student';
import { ResilientImage } from './components/ResilientImage';
import { ClassroomView } from './components/ClassroomView';
import { ProgressDashboard } from './components/ProgressDashboard';
import { StudentAuthModal } from './components/StudentAuthModal';
import { AdminTab, SupervisorDashboard } from './components/SupervisorDashboard';
import {
  apiFetchAcademyCatalog,
  apiSyncStudentProgress,
} from './utils/apiClient';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import {
  signOutFirebase,
  syncFirebaseStudentProgress,
} from './services/firebaseStudents';

type AppView =
  | 'home'
  | 'courses'
  | 'classroom'
  | 'dashboard'
  | 'supervisor';

interface SessionState {
  role: 'guest' | 'student' | 'supervisor';
  token: string;
  studentId: string | null;
  studentName: string;
  studentPhone: string;
  studentGrade: string;
  studentSpecialization: string;
  supervisorName: string;
  supervisorPhone: string;
  unlockedCourseIds: string[];
  completedLessonIds: string[];
  notesByLesson: Record<string, string>;
  quizAnswers: Record<string, number>;
}

const STORAGE_KEY = 'ezz_academy_session_v3';

const DEFAULT_SESSION: SessionState = {
  role: 'guest',
  token: '',
  studentId: null,
  studentName: 'طالب Ezz Academy',
  studentPhone: '',
  studentGrade: 'الصف الثالث الثانوي',
  studentSpecialization: 'علمي رياضة',
  supervisorName: '',
  supervisorPhone: '',
  unlockedCourseIds: ['course-sec3-pure-applied', 'course-sec1-math'],
  completedLessonIds: [],
  notesByLesson: {},
  quizAnswers: {},
};

const CATEGORIES: ('الكل' | CourseCategory)[] = [
  'الكل',
  'رياضيات (عربي)',
  'Mathematics (لغات)',
  'مراجعات الإنقاذ والشوامل',
  'البرمجة والذكاء الاصطناعي',
];

const GRADE_FILTERS: ('كل المراحل' | GradeStage)[] = [
  'كل المراحل',
  ...EDUCATIONAL_STAGES,
];

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [adminTab, setAdminTab] = useState<AdminTab>('students');
  const [activeCourseId, setActiveCourseId] = useState<string>(COURSES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<'كل المراحل' | GradeStage>('كل المراحل');
  const [selectedCategory, setSelectedCategory] = useState<'الكل' | CourseCategory>('الكل');
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('الكل');
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  const [teachers, setTeachers] = useState<DynamicTeacher[]>([]);
  const [customCourses, setCustomCourses] = useState<Course[]>([]);
  const teachersScrollRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<SessionState>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SessionState>;
        return {
          ...DEFAULT_SESSION,
          ...parsed,
          unlockedCourseIds: Array.isArray(parsed.unlockedCourseIds)
            ? parsed.unlockedCourseIds
            : DEFAULT_SESSION.unlockedCourseIds,
          completedLessonIds: Array.isArray(parsed.completedLessonIds)
            ? parsed.completedLessonIds
            : DEFAULT_SESSION.completedLessonIds,
          notesByLesson: parsed.notesByLesson ?? DEFAULT_SESSION.notesByLesson,
          quizAnswers: parsed.quizAnswers ?? DEFAULT_SESSION.quizAnswers,
        };
      }
    } catch {
      // Fallback to default session
    }
    return DEFAULT_SESSION;
  });

  const loadCatalog = async () => {
    const catalog = await apiFetchAcademyCatalog();
    setTeachers(catalog.teachers);
    setCustomCourses(catalog.customCourses);
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore quota errors
    }
  }, [session]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      // Keep Firebase Auth session synchronized with client state
    });
    return () => unsubscribe();
  }, []);

  const allCourses = useMemo(
    () => [...customCourses, ...COURSES],
    [customCourses]
  );

  const resolveInstructorName = (instructorId: string): string => {
    const dynamic = teachers.find((t) => t.id === instructorId);
    if (dynamic) return dynamic.name;
    return getInstructorById(instructorId).name;
  };

  const syncStudentProgressToServer = async (nextSession: SessionState) => {
    if (nextSession.role !== 'student' || !nextSession.studentId || !nextSession.token) {
      return;
    }
    const payload = {
      unlockedCourseIds: nextSession.unlockedCourseIds,
      completedLessonIds: nextSession.completedLessonIds,
      notesByLesson: nextSession.notesByLesson,
      quizAnswers: nextSession.quizAnswers,
    };
    if (nextSession.token === 'firebase-google-session') {
      await syncFirebaseStudentProgress(nextSession.studentId, payload);
      return;
    }
    await apiSyncStudentProgress(nextSession.studentId, nextSession.token, payload);
  };

  const activeCourse: Course =
    allCourses.find((c) => c.id === activeCourseId) ?? allCourses[0];

  const isStudentLoggedIn = session.role === 'student';

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allCourses.filter((course) => {
      const matchesGrade = isStudentLoggedIn
        ? course.grade === session.studentGrade
        : selectedGrade === 'كل المراحل' || course.grade === selectedGrade;
      const matchesCat =
        selectedCategory === 'الكل' || course.category === selectedCategory;
      const matchesInstructor =
        selectedInstructorId === 'الكل' || course.instructorId === selectedInstructorId;
      const instructorName = resolveInstructorName(course.instructorId);
      const matchesQuery =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.subtitle.toLowerCase().includes(query) ||
        course.grade.toLowerCase().includes(query) ||
        instructorName.toLowerCase().includes(query);
      return matchesGrade && matchesCat && matchesInstructor && matchesQuery;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allCourses,
    searchQuery,
    selectedGrade,
    selectedCategory,
    selectedInstructorId,
    isStudentLoggedIn,
    session.studentGrade,
    teachers,
  ]);

  const navigateTo = (nextView: AppView) => {
    setView(nextView);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    navigateTo('classroom');
  };

  const openTeacherCourses = (teacherId: string) => {
    setSelectedInstructorId(teacherId);
    setSelectedCategory('الكل');
    setSearchQuery('');
    navigateTo('courses');
  };

  const scrollTeachers = (direction: 'right' | 'left') => {
    const el = teachersScrollRef.current;
    if (!el) return;
    const distance = direction === 'right' ? 320 : -320;
    el.scrollBy({ left: distance, behavior: 'smooth' });
  };

  const handleToggleLessonComplete = (lessonId: string) => {
    setSession((prev) => {
      const exists = prev.completedLessonIds.includes(lessonId);
      const next: SessionState = {
        ...prev,
        completedLessonIds: exists
          ? prev.completedLessonIds.filter((id) => id !== lessonId)
          : [...prev.completedLessonIds, lessonId],
      };
      syncStudentProgressToServer(next);
      return next;
    });
  };

  const handleSaveNote = (lessonId: string, note: string) => {
    setSession((prev) => {
      const next: SessionState = {
        ...prev,
        notesByLesson: {
          ...prev.notesByLesson,
          [lessonId]: note,
        },
      };
      syncStudentProgressToServer(next);
      return next;
    });
  };

  const handleRecordQuizAnswer = (lessonId: string, optionIndex: number) => {
    setSession((prev) => {
      const next: SessionState = {
        ...prev,
        quizAnswers: {
          ...prev.quizAnswers,
          [lessonId]: optionIndex,
        },
      };
      syncStudentProgressToServer(next);
      return next;
    });
  };

  const handleStudentAuthenticated = (student: StudentRecord, token: string) => {
    setSession({
      role: 'student',
      token,
      studentId: student.id,
      studentName: student.studentName,
      studentPhone: student.studentPhone,
      studentGrade: student.stage,
      studentSpecialization: `${student.specializationType}: ${student.specialization}`,
      supervisorName: '',
      supervisorPhone: '',
      unlockedCourseIds: student.unlockedCourseIds,
      completedLessonIds: student.completedLessonIds,
      notesByLesson: student.notesByLesson,
      quizAnswers: student.quizAnswers,
    });
    navigateTo('dashboard');
  };

  const handleSupervisorAuthenticated = (info: {
    name: string;
    phone: string;
    token: string;
  }) => {
    setSession((prev) => ({
      ...prev,
      role: 'supervisor',
      token: info.token,
      supervisorName: info.name,
      supervisorPhone: info.phone,
    }));
    setAdminTab('students');
    navigateTo('supervisor');
  };

  const handleLogout = () => {
    void signOutFirebase();
    setSession(DEFAULT_SESSION);
    navigateTo('home');
  };

  const headerPrimaryLabel =
    session.role === 'supervisor'
      ? 'حسابي'
      : session.role === 'student'
        ? 'حساب الطالب'
        : 'تسجيل الدخول';

  const handleHeaderPrimaryClick = () => {
    setMobileNavOpen(false);
    if (session.role === 'supervisor') {
      navigateTo('supervisor');
    } else if (session.role === 'student') {
      navigateTo('dashboard');
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ezz Academy
          </button>

          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedInstructorId('الكل');
                navigateTo('courses');
              }}
              className={`hover:text-slate-900 hover:underline underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'courses' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              الكورسات
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleHeaderPrimaryClick}
              className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {headerPrimaryLabel}
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label={mobileNavOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                setSelectedInstructorId('الكل');
                navigateTo('courses');
              }}
              className="block w-full text-right px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-100"
            >
              الكورسات
            </button>
            <button
              type="button"
              onClick={handleHeaderPrimaryClick}
              className="block w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              {headerPrimaryLabel}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">
        {view === 'supervisor' && session.role === 'supervisor' ? (
          <SupervisorDashboard
            supervisorName={session.supervisorName}
            supervisorPhone={session.supervisorPhone}
            token={session.token}
            initialTab={adminTab}
            teachers={teachers}
            customCourses={customCourses}
            onCatalogUpdated={loadCatalog}
            onLogout={handleLogout}
          />
        ) : view === 'classroom' ? (
          <ClassroomView
            course={activeCourse}
            isUnlocked={session.unlockedCourseIds.includes(activeCourse.id)}
            completedLessonIds={session.completedLessonIds}
            notesByLesson={session.notesByLesson}
            quizAnswers={session.quizAnswers}
            studentName={session.studentName}
            onUpdateStudentName={(name) =>
              setSession((prev) => ({ ...prev, studentName: name }))
            }
            onToggleLessonComplete={handleToggleLessonComplete}
            onSaveNote={handleSaveNote}
            onRecordQuizAnswer={handleRecordQuizAnswer}
            onBackToCatalog={() => navigateTo('courses')}
          />
        ) : view === 'dashboard' ? (
          <ProgressDashboard
            studentName={session.studentName}
            studentGrade={session.studentGrade}
            studentSpecialization={session.studentSpecialization}
            courses={allCourses}
            unlockedCourseIds={session.unlockedCourseIds}
            onUpdateStudentName={(name) =>
              setSession((prev) => ({ ...prev, studentName: name }))
            }
            completedLessonIds={session.completedLessonIds}
            notesByLesson={session.notesByLesson}
            quizAnswers={session.quizAnswers}
            onOpenCourse={openCourse}
            onLogout={handleLogout}
          />
        ) : view === 'courses' ? (
          <section className="py-12 lg:py-16 bg-white min-h-[75vh]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => navigateTo('home')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>العودة للرئيسية</span>
                  </button>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    {isStudentLoggedIn
                      ? `كورسات ${session.studentGrade}`
                      : selectedInstructorId === 'الكل'
                        ? 'جميع كورسات المنصة'
                        : `كورسات ${resolveInstructorName(selectedInstructorId)}`}
                  </h1>
                  <p className="text-sm text-slate-600">
                    {isStudentLoggedIn
                      ? `تظهر هنا الكورسات المخصصة لمرحلتك الدراسية (${session.studentGrade}) فقط.`
                      : 'اختر المرحلة الدراسية أو المدرس لتصفح الكورسات المتاحة.'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث عن كورس أو مادة..."
                      aria-label="ابحث عن كورس"
                      className="w-full sm:w-64 pr-10 pl-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>

                  {!isStudentLoggedIn && (
                    <select
                      aria-label="تصفية حسب الصف الدراسي"
                      value={selectedGrade}
                      onChange={(e) =>
                        setSelectedGrade(e.target.value as 'كل المراحل' | GradeStage)
                      }
                      className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    >
                      {GRADE_FILTERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  )}

                  {teachers.length > 0 && (
                    <select
                      aria-label="تصفية حسب المدرس"
                      value={selectedInstructorId}
                      onChange={(e) => setSelectedInstructorId(e.target.value)}
                      className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    >
                      <option value="الكل">جميع المدرسين</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div
                role="tablist"
                aria-label="تصفية الكورسات حسب المسار"
                className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg overflow-x-auto"
              >
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedCategory === category
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {filteredCourses.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-10 text-center space-y-3">
                  <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900">
                    لا توجد كورسات مضافة لهذه المرحلة حاليًا
                  </h3>
                  <p className="text-sm text-slate-600">
                    {isStudentLoggedIn
                      ? `لم يتم نشر كورسات إضافية لـ ${session.studentGrade} بهذه التصفية بعد.`
                      : 'جرّب تغيير المدرس أو المرحلة الدراسية أو إعادة تعيين الفلاتر.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('الكل');
                      setSelectedGrade('كل المراحل');
                      setSelectedInstructorId('الكل');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
                  >
                    إعادة تعيين التصفية
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  {filteredCourses.map((course) => {
                    const instructorName = resolveInstructorName(course.instructorId);
                    const lessons = getCourseAllLessons(course);
                    const totalLessons = getCourseTotalLessons(course);
                    const doneCount = lessons.filter((l) =>
                      session.completedLessonIds.includes(l.id)
                    ).length;
                    const isUnlocked = session.unlockedCourseIds.includes(course.id);

                    return (
                      <article
                        key={course.id}
                        className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between transition-colors hover:border-slate-300"
                      >
                        <div>
                          <div className="aspect-[4/3] bg-slate-100 border-b border-slate-200 overflow-hidden">
                            <ResilientImage
                              src={course.image}
                              alt={course.title}
                              fallbackTitle={course.fallbackTitle}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="p-6 space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-medium text-blue-700">{course.grade}</span>
                              <span aria-hidden="true">·</span>
                              <span>{course.studyMode}</span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{course.totalHours} ساعة</span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{totalLessons} حصص</span>
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 leading-snug">
                              {course.title}
                            </h3>

                            <p className="text-sm text-slate-600 leading-relaxed">
                              {course.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="px-6 pb-6 pt-2 space-y-4">
                          <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                            <span className="text-slate-600 font-medium">{instructorName}</span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              {course.priceEgp} ج.م / الشهر
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openCourse(course.id)}
                              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                isUnlocked
                                  ? 'bg-blue-700 text-white hover:bg-blue-800'
                                  : 'bg-slate-900 text-white hover:bg-slate-800'
                              }`}
                            >
                              {!isUnlocked && <Lock className="w-3.5 h-3.5" />}
                              <span>
                                {isUnlocked
                                  ? doneCount > 0
                                    ? 'متابعة الحصص'
                                    : 'دخول القاعة'
                                  : 'معاينة الحصة الأولى'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
                  <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                    <div className="text-xs font-medium text-blue-700">
                      منصة التعليم الثانوي المتكاملة · أونلاين وسنتر
                    </div>

                    <h1
                      dir="ltr"
                      className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-tight w-fit"
                    >
                      Ezz <span className="text-blue-700">Academy</span>
                    </h1>

                    <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                      منصة متخصصة لطلاب المرحلة الثانوية والبكالوريا؛ شرح منهجي، حصص تفاعلية، وكورسات مخصصة لكل مرحلة دراسية.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInstructorId('الكل');
                          navigateTo('courses');
                        }}
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>
                          {isStudentLoggedIn
                            ? `كورسات ${session.studentGrade}`
                            : 'استعرض الكورسات'}
                        </span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleHeaderPrimaryClick}
                        className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>{headerPrimaryLabel}</span>
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    <div className="h-full min-h-[280px] lg:min-h-[380px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                      <ResilientImage
                        src={HERO_IMAGE}
                        alt="قاعة دراسة حديثة لمنصة Ezz Academy"
                        fallbackTitle="Ezz Academy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="py-14 lg:py-16 bg-slate-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                      الهيئة التدريسية في Ezz Academy
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1">
                      تصفح المدرسين يمينًا ويسارًا واختر المدرس لعرض كورسات مرحلتك الدراسية.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {session.role === 'supervisor' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminTab('teachers');
                          navigateTo('supervisor');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة مدرس</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => scrollTeachers('right')}
                      aria-label="تمرير لليمين"
                      className="p-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollTeachers('left')}
                      aria-label="تمرير لليسار"
                      className="p-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {teachers.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
                    <p className="text-sm text-slate-600">
                      سيتم عرض المدرسين وموادهم الدراسية هنا فور إضافتهم.
                    </p>
                    {session.role === 'supervisor' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminTab('teachers');
                          navigateTo('supervisor');
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>أضف أول مدرس الآن</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    ref={teachersScrollRef}
                    className="flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth"
                  >
                    {teachers.map((teacher) => (
                      <article
                        key={teacher.id}
                        className="min-w-[270px] sm:min-w-[300px] max-w-[300px] shrink-0 snap-start bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between transition-colors hover:border-slate-300"
                      >
                        <div>
                          <div className="aspect-[4/3] bg-slate-100 border-b border-slate-200 overflow-hidden">
                            <ResilientImage
                              src={teacher.image}
                              alt={teacher.name}
                              fallbackTitle={teacher.name}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>

                          <div className="p-5 space-y-2">
                            <div className="text-xs font-semibold text-blue-700">
                              مدرس مادة: {teacher.subject}
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">{teacher.name}</h3>
                            <p className="text-xs text-slate-500">
                              {teacher.grades.join(' · ')}
                            </p>
                          </div>
                        </div>

                        <div className="px-5 pb-5 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => openTeacherCourses(teacher.id)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            <span>
                              {isStudentLoggedIn
                                ? `كورسات ${session.studentGrade}`
                                : 'عرض الكورسات'}
                            </span>
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="font-display font-bold text-sm text-slate-900">Ezz Academy</div>
          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="hover:text-slate-900 transition-colors"
            >
              الرئيسية
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedInstructorId('الكل');
                navigateTo('courses');
              }}
              className="hover:text-slate-900 transition-colors"
            >
              الكورسات
            </button>
          </div>
          <div className="tabular-nums">© 2026 Ezz Academy. جميع الحقوق محفوظة.</div>
        </div>
      </footer>

      {showAuthModal && (
        <StudentAuthModal
          onStudentAuthenticated={handleStudentAuthenticated}
          onSupervisorAuthenticated={handleSupervisorAuthenticated}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
