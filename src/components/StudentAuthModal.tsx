import { useState } from 'react';
import { Eye, EyeOff, UserCheck, UserPlus, X } from 'lucide-react';
import {
  BACCALAUREATE_TRACKS,
  EDUCATIONAL_STAGES,
  EducationalStage,
  SECONDARY_BRANCHES,
  StudentRecord,
} from '../types/student';
import { apiLogin, apiRegisterStudent } from '../utils/apiClient';
import {
  createFirebaseStudentProfile,
  signInWithGooglePopup,
} from '../services/firebaseStudents';

interface StudentAuthModalProps {
  onStudentAuthenticated: (student: StudentRecord, token: string) => void;
  onSupervisorAuthenticated: (info: { name: string; phone: string; token: string }) => void;
  onClose: () => void;
}

type AuthTab = 'login' | 'register';

export function StudentAuthModal({
  onStudentAuthenticated,
  onSupervisorAuthenticated,
  onClose,
}: StudentAuthModalProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Unified login state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

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
  const [registerPassword, setRegisterPassword] = useState('');
  const [googlePending, setGooglePending] = useState<{
    uid: string;
    email: string;
  } | null>(null);

  const handleStageChange = (nextStage: EducationalStage) => {
    setStage(nextStage);
    if (nextStage === 'البكالوريا') {
      setSpecialization(BACCALAUREATE_TRACKS[0]);
    } else {
      setSpecialization(SECONDARY_BRANCHES[nextStage][0]);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const result = await apiLogin(loginPhone, loginPassword);
      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }

      if (result.role === 'supervisor') {
        onSupervisorAuthenticated({
          name: result.name,
          phone: result.phone,
          token: result.token,
        });
        onClose();
        return;
      }

      onStudentAuthenticated(result.student, result.token);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await signInWithGooglePopup();
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      if (res.role === 'supervisor') {
        onSupervisorAuthenticated({
          name: res.name,
          phone: res.phone,
          token: res.token,
        });
        onClose();
        return;
      }
      if (!res.needsProfile) {
        onStudentAuthenticated(res.student, res.token);
        onClose();
        return;
      }
      setGooglePending({ uid: res.uid, email: res.email });
      if (res.displayName && !studentName) {
        setStudentName(res.displayName);
      }
      setActiveTab('register');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      if (googlePending) {
        const fbRes = await createFirebaseStudentProfile(
          googlePending.uid,
          googlePending.email,
          {
            studentName,
            studentPhone,
            parentName,
            parentPhone,
            motherName,
            stage,
            specialization,
          }
        );
        if (!fbRes.ok) {
          setErrorMsg(fbRes.error);
          return;
        }
        onStudentAuthenticated(fbRes.student, fbRes.token);
        onClose();
        return;
      }

      const result = await apiRegisterStudent({
        studentName,
        studentPhone,
        parentName,
        parentPhone,
        motherName,
        stage,
        specialization,
        password: registerPassword,
      });
      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }
      onStudentAuthenticated(result.student, result.token);
      onClose();
    } catch {
      setErrorMsg('حدث خطأ أثناء حفظ البيانات. تأكد من الاتصال وحاول مجددًا.');
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
              حساب الطالب
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

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMsg('');
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMsg('');
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {googlePending ? 'استكمال بيانات الطالب' : 'إنشاء حساب طالب جديد'}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 text-xs font-medium text-red-900 bg-red-50 border border-red-200 rounded-lg">
            {errorMsg}
          </div>
        )}

        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-phone"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                رقم الهاتف
              </label>
              <input
                id="login-phone"
                type="tel"
                dir="ltr"
                required
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  dir="ltr"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((s) => !s)}
                  aria-label={showLoginPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                >
                  {showLoginPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
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
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
              </button>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-500">أو الدخول السريع</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>تسجيل الدخول بحساب Google</span>
            </button>
          </form>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

              {!googlePending ? (
                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showRegisterPassword ? 'text' : 'password'}
                      dir="ltr"
                      required
                      minLength={4}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full pl-10 pr-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword((s) => !s)}
                      aria-label={showRegisterPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                    >
                      {showRegisterPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1">
                    الحساب المرتبط
                  </span>
                  <div
                    dir="ltr"
                    className="px-3 py-2 text-xs font-mono bg-blue-50 text-blue-900 border border-blue-200 rounded-lg truncate"
                  >
                    {googlePending.email}
                  </div>
                </div>
              )}
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
      </div>
    </div>
  );
}
