/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  KeyRound,
  Lock,
  Menu,
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
  INSTRUCTORS,
} from './data/academyData';
import { StudentRecord } from './types/student';
import { ResilientImage } from './components/ResilientImage';
import { ClassroomView } from './components/ClassroomView';
import { ProgressDashboard } from './components/ProgressDashboard';
import { CodeActivationModal } from './components/CodeActivationModal';
import { StudentAuthModal } from './components/StudentAuthModal';
import { ParentPortalView } from './components/ParentPortalView';
import { BooksStoreSection } from './components/BooksStoreSection';
import { SupervisorDashboard } from './components/SupervisorDashboard';

type AppView =
  | 'home'
  | 'courses'
  | 'books'
  | 'classroom'
  | 'dashboard'
  | 'parent'
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
  'الصف الثالث الثانوي',
  'الصف الثاني الثانوي',
  'الصف الأول الثانوي',
];

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [activeCourseId, setActiveCourseId] = useState<string>(COURSES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<'كل المراحل' | GradeStage>('كل المراحل');
  const [selectedCategory, setSelectedCategory] = useState<'الكل' | CourseCategory>('الكل');
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('الكل');
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [showActivationModal, setShowActivationModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

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

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore quota errors
    }
  }, [session]);

  const syncStudentProgressToServer = async (nextSession: SessionState) => {
    if (nextSession.role !== 'student' || !nextSession.studentId || !nextSession.token) {
      return;
    }
    try {
      await fetch(`/api/students/${nextSession.studentId}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nextSession.token}`,
        },
        body: JSON.stringify({
          unlockedCourseIds: nextSession.unlockedCourseIds,
          completedLessonIds: nextSession.completedLessonIds,
          notesByLesson: nextSession.notesByLesson,
          quizAnswers: nextSession.quizAnswers,
        }),
      });
    } catch {
      // Ignore offline sync errors
    }
  };

  const activeCourse: Course =
    COURSES.find((c) => c.id === activeCourseId) ?? COURSES[0];

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return COURSES.filter((course) => {
      const matchesGrade =
        selectedGrade === 'كل المراحل' || course.grade === selectedGrade;
      const matchesCat =
        selectedCategory === 'الكل' || course.category === selectedCategory;
      const matchesInstructor =
        selectedInstructorId === 'الكل' || course.instructorId === selectedInstructorId;
      const instructor = getInstructorById(course.instructorId);
      const matchesQuery =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.subtitle.toLowerCase().includes(query) ||
        course.grade.toLowerCase().includes(query) ||
        instructor.name.toLowerCase().includes(query);
      return matchesGrade && matchesCat && matchesInstructor && matchesQuery;
    });
  }, [searchQuery, selectedGrade, selectedCategory, selectedInstructorId]);

  const navigateTo = (nextView: AppView) => {
    setView(nextView);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    navigateTo('classroom');
  };

  const openInstructorCourses = (instructorId: string) => {
    setSelectedInstructorId(instructorId);
    setSelectedGrade('كل المراحل');
    setSelectedCategory('الكل');
    setSearchQuery('');
    navigateTo('courses');
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

  const handleActivateCourses = (courseIds: string[]) => {
    setSession((prev) => {
      const next: SessionState = {
        ...prev,
        unlockedCourseIds: Array.from(new Set([...prev.unlockedCourseIds, ...courseIds])),
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
    navigateTo('supervisor');
  };

  const handleLogout = () => {
    setSession(DEFAULT_SESSION);
    navigateTo('home');
  };

  const headerPrimaryLabel =
    session.role === 'supervisor'
      ? 'لوحة المشرف'
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
              onClick={() => navigateTo('home')}
              className={`hover:text-slate-900 hover:underline underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'home' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              المدرسين
            </button>
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
            <button
              type="button"
              onClick={() => navigateTo('books')}
              className={`hover:text-slate-900 hover:underline underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'books' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              الكتب والملازم
            </button>
            <button
              type="button"
              onClick={() => navigateTo('parent')}
              className={`hover:text-slate-900 hover:underline underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'parent' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              بوابة ولي الأمر
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
              onClick={() => navigateTo('home')}
              className="block w-full text-right px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-100"
            >
              المدرسين
            </button>
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
              onClick={() => navigateTo('books')}
              className="block w-full text-right px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-100"
            >
              الكتب والملازم
            </button>
            <button
              type="button"
              onClick={() => navigateTo('parent')}
              className="block w-full text-right px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-100"
            >
              بوابة ولي الأمر
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
            onOpenActivationModal={() => setShowActivationModal(true)}
            onBackToCatalog={() => navigateTo('courses')}
          />
        ) : view === 'dashboard' ? (
          <ProgressDashboard
            studentName={session.studentName}
            studentGrade={session.studentGrade}
            studentSpecialization={session.studentSpecialization}
            unlockedCourseIds={session.unlockedCourseIds}
            onUpdateStudentName={(name) =>
              setSession((prev) => ({ ...prev, studentName: name }))
            }
            completedLessonIds={session.completedLessonIds}
            notesByLesson={session.notesByLesson}
            quizAnswers={session.quizAnswers}
            onOpenCourse={openCourse}
            onOpenActivationModal={() => setShowActivationModal(true)}
            onLogout={handleLogout}
          />
        ) : view === 'parent' ? (
          <ParentPortalView
            defaultPhone={session.studentPhone}
            onBackHome={() => navigateTo('home')}
          />
        ) : view === 'books' ? (
          <div>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
              <button
                type="button"
                onClick={() => navigateTo('home')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة للرئيسية</span>
              </button>
            </div>
            <BooksStoreSection />
          </div>
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
                    <span>العودة لصفحة المدرسين</span>
                  </button>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    {selectedInstructorId === 'الكل'
                      ? 'جميع كورسات المنصة'
                      : `كورسات ${getInstructorById(selectedInstructorId).name}`}
                  </h1>
                  <p className="text-sm text-slate-600">
                    اختر المرحلة والشعبة أو فعّل كود اشتراكك للدخول إلى قاعة الشرح.
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

                  <select
                    aria-label="تصفية حسب المدرس"
                    value={selectedInstructorId}
                    onChange={(e) => setSelectedInstructorId(e.target.value)}
                    className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  >
                    <option value="الكل">جميع المدرسين</option>
                    {INSTRUCTORS.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
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
                    لا توجد كورسات مطابقة لبحثك
                  </h3>
                  <p className="text-sm text-slate-600">
                    جرّب تغيير المدرس أو المرحلة الدراسية أو إعادة تعيين الفلاتر.
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
                    عرض جميع الكورسات
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  {filteredCourses.map((course) => {
                    const instructor = getInstructorById(course.instructorId);
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
                            <span className="text-slate-600 font-medium">{instructor.name}</span>
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

                            {!isUnlocked && (
                              <button
                                type="button"
                                onClick={() => setShowActivationModal(true)}
                                className="px-3.5 py-2.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                فعّل بالكود
                              </button>
                            )}
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
                      منصة متخصصة لطلاب المرحلة الثانوية والبكالوريا؛ نخبة من المدرسين، شرح منهجي، متجر كتب وملازم، ومتابعة مباشرة لولي الأمر.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          document
                            .getElementById('instructors-section')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>تعرّف على المدرسين</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowActivationModal(true)}
                        className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4 text-blue-700" />
                        <span>الاشتراك عن طريق الكود</span>
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

            <section id="instructors-section" className="py-16 lg:py-20 bg-slate-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                <div className="max-w-2xl">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                    نخبة المدرسين في Ezz Academy
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                    اختر المدرس للاطلاع على جميع كورساته، مواعيد السنتر والأونلاين، والبدء في المنهج مباشرة.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                  {INSTRUCTORS.map((inst) => {
                    const teacherCoursesCount = COURSES.filter(
                      (c) => c.instructorId === inst.id
                    ).length;

                    return (
                      <article
                        key={inst.id}
                        className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between transition-colors hover:border-slate-300"
                      >
                        <div>
                          <div className="aspect-[4/3] bg-slate-100 border-b border-slate-200 overflow-hidden">
                            <ResilientImage
                              src={inst.image}
                              alt={inst.name}
                              fallbackTitle={inst.name}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>

                          <div className="p-6 space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-medium text-blue-700">{inst.gradesLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{teacherCoursesCount} كورسات متاحة</span>
                            </div>

                            <div>
                              <h3 className="text-xl font-bold text-slate-900">{inst.name}</h3>
                              <div className="text-xs font-medium text-slate-600 mt-1">
                                {inst.role}
                              </div>
                            </div>

                            <div className="text-xs font-medium text-slate-800">
                              التخصص: {inst.specialty}
                            </div>

                            <p className="text-sm text-slate-600 leading-relaxed">{inst.bio}</p>
                          </div>
                        </div>

                        <div className="px-6 pb-6 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => openInstructorCourses(inst.id)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            <span>عرض كورسات {inst.name}</span>
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
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
              المدرسين
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
            <button
              type="button"
              onClick={() => navigateTo('books')}
              className="hover:text-slate-900 transition-colors"
            >
              الكتب والملازم
            </button>
            <button
              type="button"
              onClick={() => navigateTo('parent')}
              className="hover:text-slate-900 transition-colors"
            >
              بوابة ولي الأمر
            </button>
          </div>
          <div className="tabular-nums">© 2026 Ezz Academy. جميع الحقوق محفوظة.</div>
        </div>
      </footer>

      {showActivationModal && (
        <CodeActivationModal
          onActivateCourses={handleActivateCourses}
          onClose={() => setShowActivationModal(false)}
        />
      )}

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
