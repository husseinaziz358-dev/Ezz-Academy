import { useState } from 'react';
import { Clock, Eye, EyeOff, Info, UserCheck, UserPlus, X } from 'lucide-react';
import {
  BACCALAUREATE_TRACKS,
  EDUCATIONAL_STAGES,
  EducationalStage,
  SECONDARY_BRANCHES,
  StudentRecord,
} from '../types/student';
import { apiLogin, apiRegisterStudent, normalizeDigits } from '../utils/apiClient';

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
  const [pendingSuccess, setPendingSuccess] = useState<{
    phone: string;
    message: string;
  } | null>(null);

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
    if (!normalizeDigits(loginPhone) || !loginPassword) {
      setErrorMsg('يرجى إدخال رقم الهاتف وكلمة المرور.');
      return;
    }
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const normStudentPhone = normalizeDigits(studentPhone);
    const normParentPhone = normalizeDigits(parentPhone);
    if (!studentName.trim() || !parentName.trim() || !motherName.trim()) {
      setErrorMsg('يرجى إدخال اسم الطالب واسم ولي الأمر واسم الأم.');
      return;
    }
    if (normStudentPhone.length < 8 || normParentPhone.length < 8) {
      setErrorMsg('يرجى إدخال رقم هاتف صحيح للطالب وولي الأمر (٨ أرقام على الأقل).');
      return;
    }
    if (registerPassword.length < 4) {
      setErrorMsg('يجب أن تكون كلمة المرور ٤ أحرف على الأقل.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiRegisterStudent({
        studentName: studentName.trim(),
        studentPhone: normStudentPhone,
        parentName: parentName.trim(),
        parentPhone: normParentPhone,
        motherName: motherName.trim(),
        stage,
        specialization,
        password: registerPassword,
      });
      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }
      setLoginPhone(normStudentPhone);
      setPendingSuccess({
        phone: normStudentPhone,
        message: result.message,
      });
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
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-3 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="min-h-full flex items-start sm:items-center justify-center py-3 sm:py-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-4 sm:p-7 shadow-2xl space-y-5 overflow-x-hidden">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <UserCheck className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h3 id="auth-modal-title" className="text-lg font-bold">
              حساب الطالب
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMsg('');
              setPendingSuccess(null);
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'login'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMsg('');
              setPendingSuccess(null);
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'register'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            إنشاء حساب طالب جديد
          </button>
        </div>

        {errorMsg && (
          <div
            className={`p-3 text-xs font-medium rounded-lg space-y-1.5 border ${
              errorMsg.includes('موافقة المشرف') || errorMsg.includes('قيد المراجعة')
                ? 'text-amber-950 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800'
                : 'text-red-900 dark:text-red-200 bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800'
            }`}
          >
            <div>{errorMsg}</div>
            {activeTab === 'login' && errorMsg.includes('غير صحيحة') && (
              <button
                type="button"
                onClick={() => {
                  if (loginPhone.trim() && !studentPhone) {
                    setStudentPhone(loginPhone.trim());
                  }
                  setActiveTab('register');
                  setErrorMsg('');
                }}
                className="font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                ليس لديك حساب مسجّل؟ اضغط هنا لإنشاء حساب طالب جديد
              </button>
            )}
          </div>
        )}

        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-phone"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
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
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
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
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((s) => !s)}
                  aria-label={showLoginPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
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
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
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
          </form>
        )}

        {activeTab === 'register' && pendingSuccess && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 p-5 sm:p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                تم إرسال طلب إنشاء الحساب بنجاح
              </h4>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {pendingSuccess.message}
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span>رقم الحساب المسجّل:</span>
                <span className="font-mono font-bold text-blue-700 dark:text-blue-400" dir="ltr">
                  {pendingSuccess.phone}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                بمجرد موافقة المشرف على طلبك يمكنك العودة لتسجيل الدخول برقم هاتفك وكلمة المرور.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingSuccess(null);
                  setErrorMsg('');
                  setActiveTab('login');
                }}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
              >
                العودة لتسجيل الدخول
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {activeTab === 'register' && !pendingSuccess && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200">
              <Info className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>
                يتطلب تفعيل حساب الطالب الجديد مراجعة وموافقة المشرف أولًا قبل التمكن من تسجيل الدخول.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="reg-student-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
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
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-student-phone"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
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
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="reg-parent-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
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
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-parent-phone"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
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
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="reg-mother-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
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
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
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
                    className="w-full pl-10 pr-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword((s) => !s)}
                    aria-label={showRegisterPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                  >
                    {showRegisterPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="reg-stage"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  المرحلة التعليمية
                </label>
                <select
                  id="reg-stage"
                  value={stage}
                  onChange={(e) => handleStageChange(e.target.value as EducationalStage)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
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
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {stage === 'البكالوريا' ? 'اختر المسار (بكالوريا)' : 'اختر الشعبة (ثانوي)'}
                </label>
                <select
                  id="reg-specialization"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
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
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'جاري إرسال الطلب...' : 'إرسال طلب إنشاء الحساب'}</span>
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
