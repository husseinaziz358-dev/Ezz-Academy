import { useState } from 'react';
import { CheckCircle2, KeyRound, X } from 'lucide-react';
import { VALID_ACTIVATION_CODES } from '../data/academyData';

interface CodeActivationModalProps {
  onActivateCourses: (courseIds: string[]) => void;
  onClose: () => void;
}

export function CodeActivationModal({
  onActivateCourses,
  onClose,
}: CodeActivationModalProps) {
  const [code, setCode] = useState<string>('');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    const match = VALID_ACTIVATION_CODES[normalized];
    if (!match) {
      setFeedback({
        ok: false,
        message: 'الكود غير صحيح أو منتهي الصلاحية. تأكد من الحروف أو جرّب أحد الأكواد التجريبية أدناه.',
      });
      return;
    }

    onActivateCourses(match.courseIds);
    setFeedback({
      ok: true,
      message: `تم التفعيل بنجاح: ${match.label}`,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activation-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-slate-900">
            <KeyRound className="w-5 h-5 text-blue-700" />
            <h3 id="activation-modal-title" className="text-lg font-bold">
              الاشتراك وتفعيل الكورس بالكود
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          أدخل كود الاشتراك المطبوع على كارت السنتر أو غلاف الكتاب لفتح الحصص والامتحانات الخاصة بالكورس فورًا.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="activation-code-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
              كود التفعيل
            </label>
            <input
              id="activation-code-input"
              type="text"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="EZZ-3SEC-MATH"
              className="w-full px-4 py-2.5 text-sm font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-lg border text-xs font-medium flex items-start gap-2 ${
                feedback.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {feedback.ok && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="text-xs font-semibold text-slate-700">أكواد تجريبية سريعة (اضغط للتعبئة):</div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(VALID_ACTIVATION_CODES).map((sampleCode) => (
                <button
                  key={sampleCode}
                  type="button"
                  onClick={() => setCode(sampleCode)}
                  dir="ltr"
                  className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                >
                  {sampleCode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
            >
              تفعيل الكود الآن
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
