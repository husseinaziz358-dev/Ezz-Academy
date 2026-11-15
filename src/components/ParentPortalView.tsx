import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Phone,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import {
  COURSES,
  DEMO_PARENT_EXAMS,
  getCourseAllLessons,
  GradeStage,
} from '../data/academyData';

interface ParentPortalViewProps {
  studentName: string;
  studentPhone: string;
  studentGrade: GradeStage;
  completedLessonIds: string[];
  quizAnswers: Record<string, number>;
  onBackHome: () => void;
}

export function ParentPortalView({
  studentName,
  studentPhone,
  studentGrade,
  completedLessonIds,
  quizAnswers,
  onBackHome,
}: ParentPortalViewProps) {
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const totalPlatformLessons = COURSES.reduce(
    (sum, c) => sum + getCourseAllLessons(c).length,
    0
  );

  const allLessonsMap = new Map(
    COURSES.flatMap((c) =>
      getCourseAllLessons(c).map((l) => [l.id, { lesson: l, course: c }])
    )
  );

  const answeredCount = Object.keys(quizAnswers).length;
  const correctCount = Object.entries(quizAnswers).filter(([id, opt]) => {
    const entry = allLessonsMap.get(id);
    return entry && entry.lesson.quiz.correctIndex === opt;
  }).length;

  const handleParentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phoneInput.trim();
    if (cleaned.length < 8) {
      setErrorMsg('يرجى إدخال رقم هاتف صحيح مكون من ١١ رقمًا.');
      return;
    }
    setErrorMsg('');
    setIsVerified(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 mb-2"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            بوابة متابعة ولي الأمر
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            متابعة لحظية لحضور الطالب في السنتر والأونلاين، درجات الامتحانات الشاملة، ونسب إنجاز الحصص.
          </p>
        </div>
      </div>

      {!isVerified ? (
        <div className="max-w-lg mx-auto bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 text-slate-900">
            <ShieldCheck className="w-5 h-5 text-blue-700" />
            <h2 className="text-lg font-bold">دخول ولي الأمر</h2>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            أدخل رقم هاتف الطالب المسجل على المنصة لعرض تقرير الأداء الدراسي والالتزام الأسبوعي.
          </p>

          <form onSubmit={handleParentLogin} className="space-y-4">
            <div>
              <label htmlFor="parent-phone-lookup" className="block text-xs font-semibold text-slate-700 mb-1.5">
                رقم هاتف الطالب أو ولي الأمر
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="parent-phone-lookup"
                  type="tel"
                  dir="ltr"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder={studentPhone}
                  className="w-full pr-10 pl-4 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 text-xs text-red-900 bg-red-50 border border-red-200 rounded-lg">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="submit"
                className="flex-1 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
              >
                عرض تقرير الطالب
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhoneInput(studentPhone);
                  setErrorMsg('');
                  setIsVerified(true);
                }}
                className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                دخول سريع برقم الطالب الحالي
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">تقرير متابعة الطالب</div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{studentName}</h2>
              <div className="text-xs text-slate-600 mt-1">
                {studentGrade} · رقم الهاتف: <span className="font-mono" dir="ltr">{phoneInput || studentPhone}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsVerified(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              تغيير رقم الطالب
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 mb-2">الحصص المكتملة على المنصة</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {completedLessonIds.length} / {totalPlatformLessons}
              </div>
              <div className="text-xs text-slate-500 mt-1">تحديث لحظي من غرفة الدراسة</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 mb-2">متوسط درجات الامتحانات</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">88.5%</div>
              <div className="text-xs text-emerald-700 font-medium mt-1">أداء منتظم ومرتفع</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 mb-2">نسبة الحضور (سنتر وأونلاين)</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">95%</div>
              <div className="text-xs text-slate-500 mt-1">١٩ من أصل ٢٠ حصة مجدولة</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 mb-2">اختبارات الحصص التفاعلية</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {answeredCount > 0 ? `${correctCount} / ${answeredCount}` : 'لا يوجد بعد'}
              </div>
              <div className="text-xs text-slate-500 mt-1">الأسئلة المجابة داخل الدروس</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">سجل الامتحانات الأسبوعية والشوامل</h3>
              <span className="text-xs text-slate-500">أونلاين وسنتر</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="py-3.5 px-6 font-semibold">الامتحان</th>
                    <th className="py-3.5 px-6 font-semibold">التاريخ</th>
                    <th className="py-3.5 px-6 font-semibold">نظام الحضور</th>
                    <th className="py-3.5 px-6 font-semibold">الدرجة</th>
                    <th className="py-3.5 px-6 font-semibold">التقييم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DEMO_PARENT_EXAMS.map((exam) => (
                    <tr key={exam.id} className="hover:bg-slate-50/60">
                      <td className="py-4 px-6 font-medium text-slate-900">{exam.examTitle}</td>
                      <td className="py-4 px-6 text-slate-600 font-mono text-xs tabular-nums">
                        {exam.date}
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-xs">{exam.attendanceMode}</td>
                      <td className="py-4 px-6 font-mono font-semibold text-slate-900 tabular-nums">
                        {exam.score} / {exam.maxScore}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            exam.status === 'يحتاج مراجعة' ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {exam.status === 'يحتاج مراجعة' ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>{exam.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
            <h3 className="text-sm font-bold text-slate-900">ملاحظة المشرف الأكاديمي</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              مستوى الطالب في التفاضل وتطبيقات القيم العظمى متميز جدًا؛ يُنصح بمراجعة حصة الديناميكا التراكمية وحل ١٥ مسألة إضافية من بنك الأسئلة قبل الامتحان الشامل القادم.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
