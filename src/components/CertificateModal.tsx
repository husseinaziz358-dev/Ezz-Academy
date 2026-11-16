import { Award, Camera, Printer, Trash2, User, X } from 'lucide-react';
import { ChangeEvent } from 'react';
import { Course, getInstructorById } from '../data/academyData';

interface CertificateModalProps {
  course: Course;
  lessonId?: string;
  lessonTitle?: string;
  examScorePercent?: number;
  submittedAt?: string;
  studentName: string;
  studentAvatar?: string;
  instructorName?: string;
  onUpdateStudentName: (name: string) => void;
  onUpdateStudentAvatar?: (avatarUrl: string) => void;
  onClose: () => void;
}

function compressAvatarFile(file: File): Promise<string> {
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

export function CertificateModal({
  course,
  lessonId,
  lessonTitle,
  examScorePercent,
  submittedAt,
  studentName,
  studentAvatar,
  instructorName,
  onUpdateStudentName,
  onUpdateStudentAvatar,
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

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUpdateStudentAvatar) return;
    try {
      const dataUrl = await compressAvatarFile(file);
      onUpdateStudentAvatar(dataUrl);
    } catch {
      // ignore invalid file
    }
  };

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

          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 no-print bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="w-full sm:w-72">
              <label
                htmlFor="cert-student-name"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                الاسم الظاهر على الشهادة
              </label>
              <input
                id="cert-student-name"
                type="text"
                value={studentName}
                onChange={(e) => onUpdateStudentName(e.target.value)}
                placeholder="أدخل اسمك الكامل"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            {onUpdateStudentAvatar && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{studentAvatar ? 'تغيير صورة الشهادة' : 'إضافة صورتك للشهادة'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
                {studentAvatar && (
                  <button
                    type="button"
                    onClick={() => onUpdateStudentAvatar('')}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إزالة</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="border-2 border-slate-900 dark:border-slate-700 rounded-lg p-5 sm:p-10 bg-slate-50 dark:bg-slate-950 text-center">
            <div className="text-xs font-mono tracking-widest text-blue-700 dark:text-blue-400 uppercase mb-3">
              EZZ ACADEMY · {isLessonExamCert ? 'LESSON EXAM CERTIFICATE' : 'CERTIFICATE OF COMPLETION'}
            </div>
            <h4 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">
              {isLessonExamCert ? 'شهادة اجتياز امتحان الحصة' : 'شهادة إتمام مسار تدريبي'}
            </h4>

            {/* Student Profile Avatar inside the Certificate */}
            <div className="flex justify-center mb-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-blue-700 dark:border-blue-400 bg-white dark:bg-slate-900 shadow-md flex items-center justify-center">
                {studentAvatar ? (
                  <img
                    src={studentAvatar}
                    alt={studentName || 'صورة الطالب'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-blue-700 dark:text-blue-400">
                    <User className="w-8 h-8 sm:w-10 sm:h-10" />
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">تشهد منصة Ezz Academy بأن الطالب</p>
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
