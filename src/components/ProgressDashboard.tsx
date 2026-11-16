import {
  Award,
  Bell,
  BookOpen,
  Camera,
  CheckCircle2,
  FileText,
  MonitorSmartphone,
  Trash2,
  User,
} from 'lucide-react';
import { ChangeEvent, useState } from 'react';
import {
  Course,
  COURSES,
  getCourseAllLessons,
  getInstructorById,
} from '../data/academyData';
import { CertificateModal } from './CertificateModal';
import {
  DynamicTeacher,
  LessonExamResult,
  StudentNotification,
} from '../types/student';
import {
  computeStudentAttendance,
  formatAttendanceDateArabic,
  getDistinctAttendanceDays,
} from '../utils/attendance';

interface ProgressDashboardProps {
  studentName: string;
  studentAvatar?: string;
  studentPhone?: string;
  studentGrade: string;
  studentSpecialization?: string;
  activeDeviceCount?: number;
  courses?: Course[];
  teachers?: DynamicTeacher[];
  unlockedCourseIds: string[];
  onUpdateStudentName: (name: string) => void;
  onUpdateStudentAvatar?: (avatarUrl: string) => void;
  completedLessonIds: string[];
  attendanceDates?: Record<string, string>;
  notesByLesson: Record<string, string>;
  quizAnswers: Record<string, number>;
  examResults?: Record<string, LessonExamResult>;
  notifications?: StudentNotification[];
  onMarkNotificationsRead?: (notificationIds?: string[]) => void;
  onOpenCourse: (courseId: string) => void;
  onLogout?: () => void;
}

function compressStudentAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 320;
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round((img.width || maxDim) * scale));
          const h = Math.max(1, Math.round((img.height || maxDim) * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          resolve(result);
        }
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.readAsDataURL(file);
  });
}

export function ProgressDashboard({
  studentName,
  studentAvatar,
  studentPhone,
  studentGrade,
  studentSpecialization,
  activeDeviceCount = 1,
  courses,
  teachers = [],
  unlockedCourseIds,
  onUpdateStudentName,
  onUpdateStudentAvatar,
  completedLessonIds,
  attendanceDates = {},
  notesByLesson,
  quizAnswers,
  examResults = {},
  notifications = [],
  onMarkNotificationsRead,
  onOpenCourse,
  onLogout,
}: ProgressDashboardProps) {
  const [certTarget, setCertTarget] = useState<{
    course: Course;
    lessonId: string;
    lessonTitle: string;
    scorePercent: number;
    submittedAt: string;
  } | null>(null);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);

  const allCatalogCourses = courses && courses.length > 0 ? courses : COURSES;
  const stageCourses = allCatalogCourses.filter((c) => c.grade === studentGrade);
  const visibleCourses = stageCourses.length > 0 ? stageCourses : allCatalogCourses;

  const totalLessonsAcrossAcademy = visibleCourses.reduce(
    (sum, c) => sum + getCourseAllLessons(c).length,
    0
  );

  const allLessonsMap = new Map(
    allCatalogCourses.flatMap((c) =>
      getCourseAllLessons(c).map((l) => [l.id, { lesson: l, course: c }])
    )
  );

  const answeredCount = Object.keys(quizAnswers).length;
  const correctAnswersCount = Object.entries(quizAnswers).filter(([answerKey, opt]) => {
    const [rawLessonId, qSuffix] = answerKey.split('__q');
    const qIdx = qSuffix !== undefined ? Number(qSuffix) : 0;
    const entry = allLessonsMap.get(rawLessonId);
    if (!entry) return false;
    const questions =
      entry.lesson.examQuestions && entry.lesson.examQuestions.length > 0
        ? entry.lesson.examQuestions
        : [entry.lesson.quiz];
    const targetQuestion = questions[qIdx];
    return targetQuestion ? targetQuestion.correctIndex === opt : false;
  }).length;

  const savedNotesEntries = Object.entries(notesByLesson).filter(
    ([, text]) => text.trim().length > 0
  );

  const completedCourses = visibleCourses.filter((course) => {
    const lessons = getCourseAllLessons(course);
    return lessons.length > 0 && lessons.every((l) => completedLessonIds.includes(l.id));
  });

  const autoAttendance = computeStudentAttendance(
    { unlockedCourseIds, completedLessonIds, stage: studentGrade },
    allCatalogCourses
  );
  const attendanceDays = getDistinctAttendanceDays(attendanceDates);

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUpdateStudentAvatar) return;
    try {
      const compressed = await compressStudentAvatar(file);
      onUpdateStudentAvatar(compressed);
      setProfileSavedMsg('تم تحديث صورتك الشخصية وحفظها في ملفك وشهادة الحصة بنجاح.');
      window.setTimeout(() => setProfileSavedMsg(null), 4000);
    } catch {
      // ignore invalid image
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Student Profile Control Panel (لوحة تحكم الطالب وتعديل الاسم والصورة الشخصية) */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-blue-700 dark:border-blue-400 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                {studentAvatar ? (
                  <img
                    src={studentAvatar}
                    alt={studentName || 'صورة الطالب'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-blue-700 dark:text-blue-400" />
                )}
              </div>
              {onUpdateStudentAvatar && (
                <label
                  title="إضافة أو تغيير الصورة الشخصية"
                  className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center shadow-md cursor-pointer transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>لوحة تحكم الطالب</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-lg tabular-nums">
                  <MonitorSmartphone className="w-3.5 h-3.5" />
                  <span>
                    الأجهزة المتصلة: {Math.min(2, Math.max(1, activeDeviceCount))} / 2 جهاز مسموح
                  </span>
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                {studentName || 'طالب Ezz Academy'}
              </h1>
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-blue-700 dark:text-blue-400">
                  {studentGrade}
                  {studentSpecialization ? ` · ${studentSpecialization}` : ''}
                </span>
                {studentPhone && (
                  <>
                    <span>·</span>
                    <span className="font-mono tabular-nums" dir="ltr">
                      {studentPhone}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                يمكنك تعديل اسمك وإضافة أو تغيير صورتك الشخصية من هنا، وستظهر تلقائيًا في شهادة اجتياز امتحان الحصة.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-200 dark:border-slate-800">
            <div className="w-full sm:w-64">
              <label
                htmlFor="dashboard-student-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                تعديل اسم الطالب (يظهر في البروفيل والشهادة)
              </label>
              <input
                id="dashboard-student-name"
                type="text"
                value={studentName}
                onChange={(e) => {
                  onUpdateStudentName(e.target.value);
                  setProfileSavedMsg('تم حفظ الاسم الجديد تلقائيًا.');
                }}
                placeholder="أدخل اسمك الكامل"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            {onUpdateStudentAvatar && (
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors h-[38px] cursor-pointer">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{studentAvatar ? 'تغيير الصورة' : 'إضافة صورة شخصية'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </label>
                {studentAvatar && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateStudentAvatar('');
                      setProfileSavedMsg('تم حذف الصورة الشخصية.');
                    }}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors h-[38px] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                )}
              </div>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors h-[38px] cursor-pointer"
              >
                تسجيل الخروج
              </button>
            )}
          </div>
        </div>

        {profileSavedMsg && (
          <div className="mt-4 px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{profileSavedMsg}</span>
          </div>
        )}
      </section>

      {notifications.some((n) => !n.read) && (
        <section className="space-y-3">
          {notifications
            .filter((n) => !n.read)
            .map((notif) => (
              <div
                key={notif.id}
                className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 shrink-0 mt-0.5">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        {notif.title}
                      </h2>
                      <span className="text-[11px] text-amber-800 dark:text-amber-300 tabular-nums">
                        {new Date(notif.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </div>
                {onMarkNotificationsRead && (
                  <button
                    type="button"
                    onClick={() => onMarkNotificationsRead([notif.id])}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-950 dark:text-amber-200 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                    <span>تم الاطلاع</span>
                  </button>
                )}
              </div>
            ))}
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">نسبة الحضور التلقائية</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
            {autoAttendance.rate}%
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            سمعت {autoAttendance.watchedCount} من {autoAttendance.totalLessons} حصة في كورساتك
          </div>
          {attendanceDays.length > 0 && (
            <div className="text-[11px] text-blue-700 dark:text-blue-400 font-medium mt-1.5 tabular-nums">
              أيام الحضور: {attendanceDays.length} · آخر حضور {formatAttendanceDateArabic(attendanceDays[0])}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">الحصص المكتملة</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {completedLessonIds.length} / {totalLessonsAcrossAcademy}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">عبر كورسات مرحلتك</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">دقة الامتحانات الجزئية</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {answeredCount > 0
              ? `${Math.round((correctAnswersCount / answeredCount) * 100)}%`
              : '—'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {correctAnswersCount} إجابة صحيحة من {answeredCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">الكورسات المفعلة ({studentGrade})</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {unlockedCourseIds.filter((id) => visibleCourses.some((c) => c.id === id)).length} /{' '}
            {visibleCourses.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {completedCourses.length} كورس مكتمل بالكامل
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          كورسات {studentGrade}
        </h2>
        {visibleCourses.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-blue-700 dark:text-blue-400 mx-auto" />
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              حسابك مسجّل ومفعّل بنجاح في {studentGrade}
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
              لا توجد كورسات منشورة لهذه المرحلة على المنصة حاليًا. فور إضافة الكورسات من قِبل الإدارة ستظهر هنا مباشرة.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleCourses.map((course) => {
              const lessons = getCourseAllLessons(course);
              const doneCount = lessons.filter((l) => completedLessonIds.includes(l.id)).length;
              const pct = lessons.length > 0 ? Math.round((doneCount / lessons.length) * 100) : 0;
              const dynamicTeacher = teachers.find((t) => t.id === course.instructorId);
              const instructorName = dynamicTeacher
                ? dynamicTeacher.name
                : getInstructorById(course.instructorId).name;
              const isUnlocked = unlockedCourseIds.includes(course.id);

              return (
                <div
                  key={course.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                      <span>
                        {course.grade} · {instructorName}
                      </span>
                      <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300 font-semibold">
                        {isUnlocked ? `${pct}%` : 'غير مفعل'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">{course.title}</h3>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          pct === 100 ? 'bg-emerald-600' : 'bg-blue-700 dark:bg-blue-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {doneCount} من {lessons.length} حصص مكتملة
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {lessons
                        .filter((les) => examResults[les.id]?.passed)
                        .map((les) => {
                          const res = examResults[les.id];
                          return (
                            <button
                              key={les.id}
                              type="button"
                              onClick={() =>
                                setCertTarget({
                                  course,
                                  lessonId: les.id,
                                  lessonTitle: les.title,
                                  scorePercent: res.scorePercent,
                                  submittedAt: res.submittedAt,
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>شهادة: {les.title}</span>
                            </button>
                          );
                        })}
                      <button
                        type="button"
                        onClick={() => onOpenCourse(course.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{isUnlocked ? 'استكمال الحصص' : 'معاينة الكورس'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">أرشيف الملاحظات الدراسية</h2>
        {savedNotesEntries.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
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
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">{info.course.title}</span>
                    <CheckCircle2 className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{info.lesson.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {noteText}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {certTarget && (
        <CertificateModal
          course={certTarget.course}
          lessonId={certTarget.lessonId}
          lessonTitle={certTarget.lessonTitle}
          examScorePercent={certTarget.scorePercent}
          submittedAt={certTarget.submittedAt}
          studentName={studentName}
          studentAvatar={studentAvatar}
          instructorName={
            teachers.find((t) => t.id === certTarget.course.instructorId)?.name
          }
          onUpdateStudentName={onUpdateStudentName}
          onUpdateStudentAvatar={onUpdateStudentAvatar}
          onClose={() => setCertTarget(null)}
        />
      )}
    </div>
  );
}
