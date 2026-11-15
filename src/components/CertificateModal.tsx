import { Award, Printer, X } from 'lucide-react';
import { Course, getInstructorById } from '../data/academyData';

interface CertificateModalProps {
  course: Course;
  studentName: string;
  onUpdateStudentName: (name: string) => void;
  onClose: () => void;
}

export function CertificateModal({
  course,
  studentName,
  onUpdateStudentName,
  onClose,
}: CertificateModalProps) {
  const instructor = getInstructorById(course.instructorId);
  const issueDate = new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const certificateCode = `EZZ-${course.id.slice(-4).toUpperCase()}-2026`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="certificate-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-200 no-print">
          <div className="flex items-center gap-2 text-slate-900">
            <Award className="w-5 h-5 text-blue-700" />
            <h3 id="certificate-title" className="text-lg font-bold">
              شهادة إتمام رسمية
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الشهادة"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 no-print">
          <label htmlFor="cert-student-name" className="block text-xs font-medium text-slate-600 mb-1.5">
            الاسم الظاهر على الشهادة
          </label>
          <input
            id="cert-student-name"
            type="text"
            value={studentName}
            onChange={(e) => onUpdateStudentName(e.target.value)}
            placeholder="أدخل اسمك الكامل"
            className="w-full sm:w-80 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
          />
        </div>

        <div className="border-2 border-slate-900 rounded-lg p-8 sm:p-10 bg-slate-50 text-center">
          <div className="text-xs font-mono tracking-widest text-blue-700 uppercase mb-3">
            EZZ ACADEMY · CERTIFICATE OF COMPLETION
          </div>
          <h4 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            شهادة إتمام مسار تدريبي
          </h4>
          <p className="text-sm text-slate-600 mb-3">تشهد منصة Ezz Academy بأن المتعلم</p>
          <div className="text-2xl font-bold text-blue-800 mb-4">
            {studentName.trim() || 'متعلم Ezz Academy'}
          </div>
          <p className="text-sm text-slate-600 mb-2">قد أتم بنجاح جميع متطلبات ومختبرات دورة</p>
          <div className="text-lg font-semibold text-slate-900 mb-6">{course.title}</div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-300 text-xs text-slate-600">
            <div>
              <div className="text-slate-400 mb-1">المحاضر المشرف</div>
              <div className="font-semibold text-slate-900">{instructor.name}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">تاريخ الإصدار</div>
              <div className="font-semibold text-slate-900 tabular-nums">{issueDate}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">رقم التحقق</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums">{certificateCode}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 mt-6 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
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
  );
}
