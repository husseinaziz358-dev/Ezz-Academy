import { useState } from 'react';
import { ShieldCheck, UserCheck, UserPlus, X } from 'lucide-react';
import {
  BACCALAUREATE_TRACKS,
  EDUCATIONAL_STAGES,
  EducationalStage,
  SECONDARY_BRANCHES,
  StudentRecord,
} from '../types/student';

interface StudentAuthModalProps {
  onStudentAuthenticated: (student: StudentRecord, token: string) => void;
  onSupervisorAuthenticated: (info: { name: string; phone: string; token: string }) => void;
  onClose: () => void;
}

type AuthTab = 'register' | 'student-login' | 'supervisor-login';

export function StudentAuthModal({
  onStudentAuthenticated,
  onSupervisorAuthenticated,
  onClose,
}: StudentAuthModalProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>('register');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Registration state
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [motherName, setMotherName] = useState('');
  const [stage, setStage] = useState<EducationalStage>('الصف الثالث الثانوي');
  const [specialization, setSpecialization] = useState<string>(
    SECONDARY_BRANCHES['الصف الثالث الثانوي'][0]
  );

  // Student login state
  const [loginStudentPhone, setLoginStudentPhone] = useState('');

  // Supervisor login state
  const [supervisorPhone, setSupervisorPhone] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');

  const handleStageChange = (nextStage: EducationalStage) => {
    setStage(nextStage);
    if (nextStage === 'البكالوريا') {
      setSpecialization(BACCALAUREATE_TRACKS[0]);
    } else {
      setSpecialization(SECONDARY_BRANCHES[nextStage][0]);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          studentPhone,
          parentName,
          parentPhone,
          motherName,
          stage,
          specialization,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'تعذر إنشاء الحساب. راجع البيانات وحاول مجددًا.');
        return;
      }
      onStudentAuthenticated(data.student, data.token);
      onClose();
    } catch {
      setErrorMsg('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentPhone: loginStudentPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'تعذر تسجيل الدخول.');
        return;
      }
      onStudentAuthenticated(data.student, data.token);
      onClose();
    } catch {
      setErrorMsg('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  const handleSupervisorLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: supervisorPhone,
          password: supervisorPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'بيانات المشرف غير صحيحة.');
        return;
      }
      onSupervisorAuthenticated({
        name: data.name,
        phone: data.phone,
        token: data.token,
      });
      onClose();
    } catch {
      setErrorMsg('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  const specializationOptions =
    stage === 'البكالوريا' ? BACCALAUREATE_TRACKS : SECONDARY_BRANCHES[stage];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 my-8">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-slate-900">
            <UserCheck className="w-5 h-5 text-blue-700" />
            <h3 id="auth-modal-title" className="text-lg font-bold">
              بوابة الدخول وإنشاء الحساب
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

        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMsg('');
            }}
            className={`px-2 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            حساب طالب جديد
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('student-login');
              setErrorMsg('');
            }}
            className={`px-2 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'student-login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            دخول الطالب
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('supervisor-login');
              setErrorMsg('');
            }}
            className={`px-2 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'supervisor-login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            دخول المشرف
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 text-xs font-medium text-red-900 bg-red-50 border border-red-200 rounded-lg">
            {errorMsg}
          </div>
        )}

        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="reg-student-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  اسم الطالب
                </label>
                <input
                  id="reg-student-name"
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="الاسم الكامل للطالب"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-student-phone"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  رقم الطالب
                </label>
                <input
                  id="reg-student-phone"
                  type="tel"
                  dir="ltr"
                  required
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="reg-parent-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  اسم ولي الأمر
                </label>
                <input
                  id="reg-parent-name"
                  type="text"
                  required
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="اسم ولي الأمر"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-parent-phone"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  رقم ولي الأمر
                </label>
                <input
                  id="reg-parent-phone"
                  type="tel"
                  dir="ltr"
                  required
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="01099887766"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-mother-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                اسم الأم
              </label>
              <input
                id="reg-mother-name"
                type="text"
                required
                value={motherName}
                onChange={(e) => setMotherName(e.target.value)}
                placeholder="اسم الأم ثلاثي"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="reg-stage"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  المرحلة التعليمية
                </label>
                <select
                  id="reg-stage"
                  value={stage}
                  onChange={(e) => handleStageChange(e.target.value as EducationalStage)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  {EDUCATIONAL_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="reg-specialization"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {stage === 'البكالوريا' ? 'اختر المسار (بكالوريا)' : 'اختر الشعبة (ثانوي)'}
                </label>
                <select
                  id="reg-specialization"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  {specializationOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
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
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'جاري التسجيل...' : 'إنشاء حساب الطالب'}</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'student-login' && (
          <form onSubmit={handleStudentLoginSubmit} className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              أدخل رقم هاتف الطالب المسجل مسبقًا للدخول إلى حسابك واستكمال الحصص.
            </p>
            <div>
              <label
                htmlFor="login-student-phone"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                رقم الطالب
              </label>
              <input
                id="login-student-phone"
                type="tel"
                dir="ltr"
                required
                value={loginStudentPhone}
                onChange={(e) => setLoginStudentPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
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
                disabled={loading}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'جاري الدخول...' : 'دخول الطالب'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'supervisor-login' && (
          <form onSubmit={handleSupervisorLoginSubmit} className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
              <span>دخول المشرف يفتح لوحة المتابعة الكاملة لبيانات جميع الطلاب.</span>
            </div>

            <div>
              <label
                htmlFor="sup-phone-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                رقم هاتف المشرف
              </label>
              <input
                id="sup-phone-input"
                type="tel"
                dir="ltr"
                required
                value={supervisorPhone}
                onChange={(e) => setSupervisorPhone(e.target.value)}
                placeholder="01022193514"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="sup-pass-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                كلمة السر
              </label>
              <input
                id="sup-pass-input"
                type="password"
                dir="ltr"
                required
                value={supervisorPassword}
                onChange={(e) => setSupervisorPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
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
                disabled={loading}
                className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'جاري التحقق...' : 'دخول لوحة المشرف'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
