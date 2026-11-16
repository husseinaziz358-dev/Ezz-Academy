import { Award, Printer, X } from 'lucide-react';
import { Course, getInstructorById } from '../data/academyData';

interface CertificateModalProps {
  course: Course;
  lessonId?: string;
  lessonTitle?: string;
  examScorePercent?: number;
  submittedAt?: string;
  studentName: string;
  instructorName?: string;
  onUpdateStudentName: (name: string) => void;
  onClose: () => void;
}

export function CertificateModal({
  course,
  lessonId,
  lessonTitle,
  examScorePercent,
  submittedAt,
  studentName,
  instructorName,
  onUpdateStudentName,
  onClose,
}: CertificateModalProps) {
  const resolvedInstructorName = instructorName || getInstructorById(course.instructorId).name;
  const parsedDate = submittedAt ? new Date(submittedAt) : new Date();
  const issueDate = new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate);

  const codeSuffix = (lessonId || course.id).slice(-4).toUpperCase();
  const certificateCode = `EZZ-${codeSuffix}-2026`;
  const isLessonExamCert = Boolean(lessonTitle);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-3 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="certificate-title"
    >
      <div className="min-h-full flex items-start sm:items-center justify-center py-3 sm:py-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-4 sm:p-8 shadow-2xl overflow-x-hidden">
          <div className="flex items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-200 dark:border-slate-800 no-print">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white min-w-0">
              <Award className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0" />
              <h3 id="certificate-title" className="text-base sm:text-lg font-bold truncate">
                {isLessonExamCert ? 'شهادة اجتياز امتحان الحصة' : 'شهادة إتمام رسمية'}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة الشهادة"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6 no-print">
            <label htmlFor="cert-student-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              الاسم الظاهر على الشهادة
            </label>
            <input
              id="cert-student-name"
              type="text"
              value={studentName}
              onChange={(e) => onUpdateStudentName(e.target.value)}
              placeholder="أدخل اسمك الكامل"
              className="w-full sm:w-80 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="border-2 border-slate-900 dark:border-slate-700 rounded-lg p-5 sm:p-10 bg-slate-50 dark:bg-slate-950 text-center">
            <div className="text-xs font-mono tracking-widest text-blue-700 dark:text-blue-400 uppercase mb-3">
              EZZ ACADEMY · {isLessonExamCert ? 'LESSON EXAM CERTIFICATE' : 'CERTIFICATE OF COMPLETION'}
            </div>
            <h4 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">
              {isLessonExamCert ? 'شهادة اجتياز امتحان الحصة' : 'شهادة إتمام مسار تدريبي'}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">تشهد منصة Ezz Academy بأن الطالب</p>
            <div className="text-xl sm:text-2xl font-bold text-blue-800 dark:text-blue-300 mb-4">
              {studentName.trim() || 'طالب Ezz Academy'}
            </div>
            {isLessonExamCert ? (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  قد اجتاز بنجاح امتحان حصة
                </p>
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1">
                  {lessonTitle}
                </div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-4">
                  ضمن كورس: {course.title}
                </div>
                {typeof examScorePercent === 'number' && (
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-bold mb-6 tabular-nums">
                    <span>درجة النجاح في الامتحان: {examScorePercent}%</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">قد أتم بنجاح جميع متطلبات ومختبرات دورة</p>
                <div className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-6">{course.title}</div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-300 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <div>
                <div className="text-slate-400 dark:text-slate-500 mb-1">مدرس المادة</div>
                <div className="font-semibold text-slate-900 dark:text-white">{resolvedInstructorName}</div>
              </div>
              <div>
                <div className="text-slate-400 dark:text-slate-500 mb-1">تاريخ الإصدار</div>
                <div className="font-semibold text-slate-900 dark:text-white tabular-nums">{issueDate}</div>
              </div>
              <div>
                <div className="text-slate-400 dark:text-slate-500 mb-1">رقم التحقق</div>
                <div className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">{certificateCode}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 mt-6 no-print">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ كـ PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
