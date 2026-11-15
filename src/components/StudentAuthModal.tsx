import { useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { GradeStage } from '../data/academyData';

interface StudentAuthModalProps {
  studentName: string;
  studentPhone: string;
  studentGrade: GradeStage;
  onSaveProfile: (profile: { name: string; phone: string; grade: GradeStage }) => void;
  onClose: () => void;
}

const GRADES: GradeStage[] = [
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي',
];

export function StudentAuthModal({
  studentName,
  studentPhone,
  studentGrade,
  onSaveProfile,
  onClose,
}: StudentAuthModalProps) {
  const [name, setName] = useState(studentName);
  const [phone, setPhone] = useState(studentPhone);
  const [grade, setGrade] = useState<GradeStage>(studentGrade);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      name: name.trim() || 'طالب Ezz Academy',
      phone: phone.trim() || '01012345678',
      grade,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-slate-900">
            <UserCheck className="w-5 h-5 text-blue-700" />
            <h3 id="auth-modal-title" className="text-lg font-bold">
              تسجيل دخول الطالب
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="student-name-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
              اسم الطالب ثلاثي
            </label>
            <input
              id="student-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: عمر خالد محمود"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div>
            <label htmlFor="student-phone-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
              رقم هاتف الطالب (لربط بوابة ولي الأمر)
            </label>
            <input
              id="student-phone-input"
              type="tel"
              dir="ltr"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01012345678"
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div>
            <label htmlFor="student-grade-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
              المرحلة الدراسية
            </label>
            <select
              id="student-grade-select"
              value={grade}
              onChange={(e) => setGrade(e.target.value as GradeStage)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
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
              حفظ ودخول الحساب
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
