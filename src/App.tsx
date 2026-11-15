/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  KeyRound,
  Lock,
  Menu,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Course,
  CourseCategory,
  COURSES,
  getCourseAllLessons,
  getCourseTotalLessons,
  getInstructorById,
  GRADE_STAGES,
  GradeStage,
  HERO_IMAGE,
  INSTRUCTORS,
  TESTIMONIALS,
} from './data/academyData';
import { ResilientImage } from './components/ResilientImage';
import { ClassroomView } from './components/ClassroomView';
import { ProgressDashboard } from './components/ProgressDashboard';
import { CodeActivationModal } from './components/CodeActivationModal';
import { StudentAuthModal } from './components/StudentAuthModal';
import { ParentPortalView } from './components/ParentPortalView';
import { BooksStoreSection } from './components/BooksStoreSection';

type AppView = 'home' | 'classroom' | 'dashboard' | 'parent';

interface PersistedState {
  isLoggedIn: boolean;
  studentName: string;
  studentPhone: string;
  studentGrade: GradeStage;
  unlockedCourseIds: string[];
  completedLessonIds: string[];
  notesByLesson: Record<string, string>;
  quizAnswers: Record<string, number>;
}

const STORAGE_KEY = 'ezz_academy_jaw_v2';

const DEFAULT_PERSISTED_STATE: PersistedState = {
  isLoggedIn: false,
  studentName: 'عمر خالد محمود',
  studentPhone: '01012345678',
  studentGrade: 'الصف الثالث الثانوي',
  unlockedCourseIds: ['course-sec3-pure-applied', 'course-sec1-math'],
  completedLessonIds: ['les-sec3-1'],
  notesByLesson: {
    'les-sec3-1': 'ميل العمودي يساوي سالب مقلوب ميل المماس، وعند النقط الحرجة يكون المماس أفقيًا.',
  },
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
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [showActivationModal, setShowActivationModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  const [persisted, setPersisted] = useState<PersistedState>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        return {
          isLoggedIn: Boolean(parsed.isLoggedIn),
          studentName: parsed.studentName ?? DEFAULT_PERSISTED_STATE.studentName,
          studentPhone: parsed.studentPhone ?? DEFAULT_PERSISTED_STATE.studentPhone,
          studentGrade: parsed.studentGrade ?? DEFAULT_PERSISTED_STATE.studentGrade,
          unlockedCourseIds: Array.isArray(parsed.unlockedCourseIds)
            ? parsed.unlockedCourseIds
            : DEFAULT_PERSISTED_STATE.unlockedCourseIds,
          completedLessonIds: Array.isArray(parsed.completedLessonIds)
            ? parsed.completedLessonIds
            : DEFAULT_PERSISTED_STATE.completedLessonIds,
          notesByLesson: parsed.notesByLesson ?? DEFAULT_PERSISTED_STATE.notesByLesson,
          quizAnswers: parsed.quizAnswers ?? DEFAULT_PERSISTED_STATE.quizAnswers,
        };
      }
    } catch {
      // Fallback to default state
    }
    return DEFAULT_PERSISTED_STATE;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Ignore quota errors
    }
  }, [persisted]);

  const activeCourse: Course =
    COURSES.find((c) => c.id === activeCourseId) ?? COURSES[0];

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return COURSES.filter((course) => {
      const matchesGrade =
        selectedGrade === 'كل المراحل' || course.grade === selectedGrade;
      const matchesCat =
        selectedCategory === 'الكل' || course.category === selectedCategory;
      const instructor = getInstructorById(course.instructorId);
      const matchesQuery =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.subtitle.toLowerCase().includes(query) ||
        course.grade.toLowerCase().includes(query) ||
        instructor.name.toLowerCase().includes(query);
      return matchesGrade && matchesCat && matchesQuery;
    });
  }, [searchQuery, selectedGrade, selectedCategory]);

  const openCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    setView('classroom');
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateHomeSection = (sectionId?: string) => {
    setView('home');
    setMobileNavOpen(false);
    if (sectionId) {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const selectGradeAndJump = (grade: GradeStage) => {
    setSelectedGrade(grade);
    setSelectedCategory('الكل');
    navigateHomeSection('courses-section');
  };

  const handleToggleLessonComplete = (lessonId: string) => {
    setPersisted((prev) => {
      const exists = prev.completedLessonIds.includes(lessonId);
      return {
        ...prev,
        completedLessonIds: exists
          ? prev.completedLessonIds.filter((id) => id !== lessonId)
          : [...prev.completedLessonIds, lessonId],
      };
    });
  };

  const handleSaveNote = (lessonId: string, note: string) => {
    setPersisted((prev) => ({
      ...prev,
      notesByLesson: {
        ...prev.notesByLesson,
        [lessonId]: note,
      },
    }));
  };

  const handleRecordQuizAnswer = (lessonId: string, optionIndex: number) => {
    setPersisted((prev) => ({
      ...prev,
      quizAnswers: {
        ...prev.quizAnswers,
        [lessonId]: optionIndex,
      },
    }));
  };

  const handleActivateCourses = (courseIds: string[]) => {
    setPersisted((prev) => ({
      ...prev,
      unlockedCourseIds: Array.from(new Set([...prev.unlockedCourseIds, ...courseIds])),
    }));
  };

  const handleSaveProfile = (profile: {
    name: string;
    phone: string;
    grade: GradeStage;
  }) => {
    setPersisted((prev) => ({
      ...prev,
      isLoggedIn: true,
      studentName: profile.name,
      studentPhone: profile.phone,
      studentGrade: profile.grade,
    }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => navigateHomeSection()}
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
              onClick={() => navigateHomeSection('grades-section')}
              className="hover:text-slate-900 hover:underline underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              المراحل الدراسية
            </button>
            <button
              type="button"
              onClick={() => navigateHomeSection('courses-section')}
              className="hover:text-slate-900 hover:underline underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              الكورسات
            </button>
            <button
              type="button"
              onClick={() => navigateHomeSection('books-section')}
              className="hover:text-slate-900 hover:underline underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              الكتب والملازم
            </button>
            <button
              type="button"
              onClick={() => {
                setView('parent');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`hover:text-slate-900 hover:underline underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'parent' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              بوابة ولي الأمر
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {persisted.isLoggedIn ? (
              <button
                type="button"
                onClick={() => {
                  setView('dashboard');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                حساب الطالب
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                تسجيل الدخول
              </button>
            )}

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
              onClick={() => navigateHomeSection('grades-section')}
              className="block w-full text-right px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-100"
            >
              المراحل الدراسية
            </button>
            <button
              type="button"
              onClick={() => navigateHomeSection('courses-section')}
              className="block w-full text-right px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-100"
            >
              الكورسات
            </button>
            <button
              type="button"
              onClick={() => navigateHomeSection('books-section')}
              className="block w-full text-right px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-100"
            >
              الكتب والملازم
            </button>
            <button
              type="button"
              onClick={() => {
                setView('parent');
                setMobileNavOpen(false);
              }}
              className="block w-full text-right px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-100"
            >
              بوابة ولي الأمر
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                if (persisted.isLoggedIn) {
                  setView('dashboard');
                } else {
                  setShowAuthModal(true);
                }
              }}
              className="block w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              {persisted.isLoggedIn ? 'حساب الطالب' : 'تسجيل الدخول'}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">
        {view === 'classroom' ? (
          <ClassroomView
            course={activeCourse}
            isUnlocked={persisted.unlockedCourseIds.includes(activeCourse.id)}
            completedLessonIds={persisted.completedLessonIds}
            notesByLesson={persisted.notesByLesson}
            quizAnswers={persisted.quizAnswers}
            studentName={persisted.studentName}
            onUpdateStudentName={(name) =>
              setPersisted((prev) => ({ ...prev, studentName: name }))
            }
            onToggleLessonComplete={handleToggleLessonComplete}
            onSaveNote={handleSaveNote}
            onRecordQuizAnswer={handleRecordQuizAnswer}
            onOpenActivationModal={() => setShowActivationModal(true)}
            onBackToCatalog={() => navigateHomeSection('courses-section')}
          />
        ) : view === 'dashboard' ? (
          <ProgressDashboard
            studentName={persisted.studentName}
            studentGrade={persisted.studentGrade}
            unlockedCourseIds={persisted.unlockedCourseIds}
            onUpdateStudentName={(name) =>
              setPersisted((prev) => ({ ...prev, studentName: name }))
            }
            completedLessonIds={persisted.completedLessonIds}
            notesByLesson={persisted.notesByLesson}
            quizAnswers={persisted.quizAnswers}
            onOpenCourse={openCourse}
            onOpenActivationModal={() => setShowActivationModal(true)}
          />
        ) : view === 'parent' ? (
          <ParentPortalView
            studentName={persisted.studentName}
            studentPhone={persisted.studentPhone}
            studentGrade={persisted.studentGrade}
            completedLessonIds={persisted.completedLessonIds}
            quizAnswers={persisted.quizAnswers}
            onBackHome={() => navigateHomeSection()}
          />
        ) : (
          <>
            <section className="bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
                  <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                    <div className="text-xs font-medium text-blue-700">
                      منصة الثانوية العامة واللغات · أونلاين وسنتر
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight text-balance max-w-2xl">
                      طريقك للتفوق في رياضيات الثانوية العامة والبرمجة
                    </h1>

                    <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                      شرح منهج الصف الأول والثاني والثالث الثانوي (عربي ولغات)، معسكرات مراجعات الإنقاذ وشوامل الأوائل، امتحانات أسبوعية، متجر للكتب والملازم، وبوابة متابعة فورية لولي الأمر.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => navigateHomeSection('courses-section')}
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>تصفح كورسات مرحلتك</span>
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

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-12 mt-12 border-t border-slate-200">
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                      180+
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600 mt-1">
                      حصة شرح ومراجعة إنقاذ مسجلة
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                      25,000+
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600 mt-1">
                      طالب أونلاين وسنتر على المنصة
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                      30 نموذج
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600 mt-1">
                      امتحانات شوامل الأوائل بالحل التفصيلي
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                      27 محافظة
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600 mt-1">
                      شحن مباشر للكتب والملازم والأكواد
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section id="grades-section" className="py-16 lg:py-20 border-b border-slate-200 bg-slate-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mb-10">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 text-balance">
                    اختار مرحلتك الدراسية
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                    مناهج متدرجة تغطي المرحلة الثانوية كاملة للشعبة العلمية والأدبية ومدارس اللغات.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                  {GRADE_STAGES.map((stage) => (
                    <article
                      key={stage.grade}
                      className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between gap-6"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-mono font-semibold text-blue-700 tabular-nums">
                            {stage.number}. {stage.grade}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900">{stage.headline}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {stage.description}
                        </p>

                        <ul className="pt-3 border-t border-slate-100 space-y-1.5">
                          {stage.branches.map((branch, idx) => (
                            <li
                              key={idx}
                              className="text-xs text-slate-700 flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                              <span>{branch}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={() => selectGradeAndJump(stage.grade)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-blue-700 hover:text-white transition-colors cursor-pointer"
                      >
                        <span>عرض كورسات {stage.grade}</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section id="courses-section" className="py-16 lg:py-20 bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                      الكورسات ومراجعات الإنقاذ
                    </h2>
                    <p className="text-sm sm:text-base text-slate-600">
                      تصفح الحصص التأسيسية، منهج الرياضيات (عربي ولغات)، أو فعّل اشتراكك بالكود.
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
                      جرّب تعديل المرحلة الدراسية أو إعادة تعيين الفلاتر.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('الكل');
                        setSelectedGrade('كل المراحل');
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
                        persisted.completedLessonIds.includes(l.id)
                      ).length;
                      const isUnlocked = persisted.unlockedCourseIds.includes(course.id);

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
                              <span className="text-slate-600 font-medium">
                                {instructor.name}
                              </span>
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

            <BooksStoreSection />

            <section className="py-16 lg:py-20 bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
                <div className="bg-slate-900 text-white rounded-xl p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  <div className="lg:col-span-8 space-y-3">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-sky-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span>نظام متابعة ولي الأمر والأداء الأسبوعي</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white text-balance">
                      تابع مستوى ابنك وحضوره في السنتر والأونلاين لحظة بلحظة
                    </h2>
                    <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                      سجّل الدخول إلى بوابة ولي الأمر برقم هاتف الطالب للاطلاع على تقارير الحضور، درجات الامتحانات الشاملة، وملاحظات المشرف الأكاديمي.
                    </p>
                  </div>
                  <div className="lg:col-span-4 flex lg:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setView('parent');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-900 bg-white rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <span>دخول ولي الأمر</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="max-w-2xl mb-8">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                      نخبة المحاضرين
                    </h2>
                    <p className="text-sm sm:text-base text-slate-600">
                      أساتذة متخصصون في مناهج الثانوية العامة المصرية واللغات والبرمجة.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {INSTRUCTORS.map((inst) => (
                      <div
                        key={inst.id}
                        className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-3"
                      >
                        <div>
                          <h3 className="text-base font-bold text-slate-900">{inst.name}</h3>
                          <div className="text-xs text-blue-700 font-medium mt-0.5">
                            {inst.role}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{inst.specialty}</div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{inst.bio}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="max-w-2xl mb-8">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                      نتائج طلابنا وأولياء الأمور
                    </h2>
                    <p className="text-sm sm:text-base text-slate-600">
                      تجارب حقيقية لطلاب الثانوية العامة واللغات مع شرح Ezz Academy ونظام المتابعة.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {TESTIMONIALS.map((item) => (
                      <blockquote
                        key={item.id}
                        className="bg-slate-50 rounded-xl border border-slate-200 p-6 flex flex-col justify-between gap-5"
                      >
                        <div className="space-y-3 text-sm leading-relaxed">
                          <div className="text-xs font-semibold text-blue-700 tabular-nums">
                            {item.score}
                          </div>
                          <p className="text-slate-500">{item.before}</p>
                          <p className="text-slate-900 font-medium">{item.outcome}</p>
                        </div>

                        <footer className="pt-4 border-t border-slate-200">
                          <div className="text-sm font-bold text-slate-900">
                            {item.studentName}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{item.gradeInfo}</div>
                        </footer>
                      </blockquote>
                    ))}
                  </div>
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
              onClick={() => navigateHomeSection('grades-section')}
              className="hover:text-slate-900 transition-colors"
            >
              المراحل الدراسية
            </button>
            <button
              type="button"
              onClick={() => navigateHomeSection('courses-section')}
              className="hover:text-slate-900 transition-colors"
            >
              الكورسات
            </button>
            <button
              type="button"
              onClick={() => navigateHomeSection('books-section')}
              className="hover:text-slate-900 transition-colors"
            >
              الكتب والملازم
            </button>
            <button
              type="button"
              onClick={() => {
                setView('parent');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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
          studentName={persisted.studentName}
          studentPhone={persisted.studentPhone}
          studentGrade={persisted.studentGrade}
          onSaveProfile={handleSaveProfile}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
