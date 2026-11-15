import { Award, BookOpen, CheckCircle2, FileText, KeyRound } from 'lucide-react';
import { useState } from 'react';
import {
  Course,
  COURSES,
  getCourseAllLessons,
  getInstructorById,
} from '../data/academyData';
import { CertificateModal } from './CertificateModal';

interface ProgressDashboardProps {
  studentName: string;
  studentGrade: string;
  studentSpecialization?: string;
  unlockedCourseIds: string[];
  onUpdateStudentName: (name: string) => void;
  completedLessonIds: string[];
  notesByLesson: Record<string, string>;
  quizAnswers: Record<string, number>;
  onOpenCourse: (courseId: string) => void;
  onOpenActivationModal: () => void;
  onLogout?: () => void;
}

export function ProgressDashboard({
  studentName,
  studentGrade,
  studentSpecialization,
  unlockedCourseIds,
  onUpdateStudentName,
  completedLessonIds,
  notesByLesson,
  quizAnswers,
  onOpenCourse,
  onOpenActivationModal,
  onLogout,
}: ProgressDashboardProps) {
  const [certCourse, setCertCourse] = useState<Course | null>(null);

  const totalLessonsAcrossAcademy = COURSES.reduce(
    (sum, c) => sum + getCourseAllLessons(c).length,
    0
  );

  const allLessonsMap = new Map(
    COURSES.flatMap((c) =>
      getCourseAllLessons(c).map((l) => [l.id, { lesson: l, course: c }])
    )
  );

  const answeredCount = Object.keys(quizAnswers).length;
  const correctAnswersCount = Object.entries(quizAnswers).filter(([lessonId, opt]) => {
    const entry = allLessonsMap.get(lessonId);
    return entry && entry.lesson.quiz.correctIndex === opt;
  }).length;

  const savedNotesEntries = Object.entries(notesByLesson).filter(
    ([, text]) => text.trim().length > 0
  );

  const completedCourses = COURSES.filter((course) => {
    const lessons = getCourseAllLessons(course);
    return lessons.length > 0 && lessons.every((l) => completedLessonIds.includes(l.id));
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6 pb-8 border-b border-slate-200">
        <div>
          <div className="text-xs font-medium text-blue-700 mb-1">
            {studentGrade}
            {studentSpecialization ? ` · ${studentSpecialization}` : ''}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            حساب الطالب ولوحة التقدم
          </h1>
          <p className="text-sm text-slate-600">
            تابع كورساتك المفعلة، درجات الاختبارات الجزئية، الملاحظات، والشهادات المستحقة.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <label
              htmlFor="dashboard-student-name"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              اسم الطالب في الشهادات
            </label>
            <input
              id="dashboard-student-name"
              type="text"
              value={studentName}
              onChange={(e) => onUpdateStudentName(e.target.value)}
              placeholder="أدخل اسمك الكامل"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <button
            type="button"
            onClick={onOpenActivationModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors h-[38px] cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>تفعيل كورس بكود</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors h-[38px] cursor-pointer"
            >
              تسجيل الخروج
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-2">الحصص المكتملة</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {completedLessonIds.length} / {totalLessonsAcrossAcademy}
          </div>
          <div className="text-xs text-slate-500 mt-1">عبر جميع كورسات المنصة</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-2">دقة الامتحانات الجزئية</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {answeredCount > 0
              ? `${Math.round((correctAnswersCount / answeredCount) * 100)}%`
              : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {correctAnswersCount} إجابة صحيحة من {answeredCount}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-2">الكورسات المفعلة</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {unlockedCourseIds.length} / {COURSES.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {completedCourses.length} كورس مكتمل بالكامل
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-2">الملاحظات الدراسية</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {savedNotesEntries.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">ملاحظة محفوظة</div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">حالة الكورسات والاشتراكات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {COURSES.map((course) => {
            const lessons = getCourseAllLessons(course);
            const doneCount = lessons.filter((l) => completedLessonIds.includes(l.id)).length;
            const pct = Math.round((doneCount / lessons.length) * 100);
            const instructor = getInstructorById(course.instructorId);
            const isUnlocked = unlockedCourseIds.includes(course.id);

            return (
              <div
                key={course.id}
                className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-2">
                    <span>
                      {course.grade} · {instructor.name}
                    </span>
                    <span className="font-mono tabular-nums text-slate-700 font-semibold">
                      {isUnlocked ? `${pct}%` : 'غير مفعل'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-3">{course.title}</h3>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        pct === 100 ? 'bg-emerald-600' : 'bg-blue-700'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {doneCount} من {lessons.length} حصص مكتملة
                  </span>
                  <div className="flex items-center gap-2">
                    {pct === 100 && (
                      <button
                        type="button"
                        onClick={() => setCertCourse(course)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>الشهادة</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenCourse(course.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{isUnlocked ? 'استكمال الحصص' : 'معاينة الحصة الأولى'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">أرشيف الملاحظات الدراسية</h2>
        {savedNotesEntries.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">
              لم تدون أي ملاحظات بعد. افتح أي حصة واكتب ملاحظاتك في تبويب «ملاحظاتي».
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedNotesEntries.map(([lessonId, noteText]) => {
              const info = allLessonsMap.get(lessonId);
              if (!info) return null;
              return (
                <div
                  key={lessonId}
                  className="bg-white rounded-xl border border-slate-200 p-5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-blue-700">{info.course.title}</span>
                    <CheckCircle2 className="w-4 h-4 text-slate-300 shrink-0" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{info.lesson.title}</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                    {noteText}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {certCourse && (
        <CertificateModal
          course={certCourse}
          studentName={studentName}
          onUpdateStudentName={onUpdateStudentName}
          onClose={() => setCertCourse(null)}
        />
      )}
    </div>
  );
}
