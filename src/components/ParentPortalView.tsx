import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Phone,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { COURSES, DEMO_PARENT_EXAMS, getCourseAllLessons } from '../data/academyData';
import { StudentRecord } from '../types/student';

interface ParentPortalViewProps {
  defaultPhone?: string;
  onBackHome: () => void;
}

export function ParentPortalView({ defaultPhone = '', onBackHome }: ParentPortalViewProps) {
  const [phoneInput, setPhoneInput] = useState<string>(defaultPhone);
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
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

  const lookupStudent = async (phoneToLookup: string) => {
    const cleaned = phoneToLookup.trim();
    if (cleaned.length < 8) {
      setErrorMsg('يرجى إدخال رقم هاتف صحيح.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/parent/lookup?phone=${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'لم يتم العثور على بيانات بهذا الرقم.');
        setStudent(null);
        return;
      }
      setStudent(data.student);
    } catch {
      setErrorMsg('حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  const handleParentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    lookupStudent(phoneInput);
  };

  const answeredCount = student ? Object.keys(student.quizAnswers).length : 0;
  const correctCount = student
    ? Object.entries(student.quizAnswers).filter(([id, opt]) => {
        const entry = allLessonsMap.get(id);
        return entry && entry.lesson.quiz.correctIndex === opt;
      }).length
    : 0;

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
            استعلم برقم ولي الأمر أو رقم الطالب للاطلاع على سجل الحضور، الإنجاز، وملاحظات المشرف.
          </p>
        </div>
      </div>

      {!student ? (
        <div className="max-w-lg mx-auto bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 text-slate-900">
            <ShieldCheck className="w-5 h-5 text-blue-700" />
            <h2 className="text-lg font-bold">دخول ولي الأمر</h2>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            أدخل رقم هاتف ولي الأمر أو رقم الطالب المسجل لعرض تقرير الأداء الدراسي والالتزام الأسبوعي.
          </p>

          <form onSubmit={handleParentLogin} className="space-y-4">
            <div>
              <label
                htmlFor="parent-phone-lookup"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                رقم ولي الأمر أو رقم الطالب
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="parent-phone-lookup"
                  type="tel"
                  dir="ltr"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="01099887766"
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
                disabled={loading}
                className="flex-1 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer disabled:opacity-60"
              >
                {loading ? 'جاري البحث...' : 'عرض تقرير الطالب'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const demoPhone = defaultPhone || '01099887766';
                  setPhoneInput(demoPhone);
                  lookupStudent(demoPhone);
                }}
                className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                استعلام تجريبي سريع
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">تقرير متابعة الطالب</div>
              <h2 className="text-xl font-bold text-slate-900">{student.studentName}</h2>
              <div className="text-xs text-slate-600">
                {student.stage} · {student.specializationType}: {student.specialization} · رقم الطالب:{' '}
                <span className="font-mono" dir="ltr">
                  {student.studentPhone}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                ولي الأمر: {student.parentName} (
                <span className="font-mono" dir="ltr">
                  {student.parentPhone}
                </span>
                )
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStudent(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              بحث برقم آخر
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 mb-2">الحصص المكتملة على المنصة</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {student.completedLessonIds.length} / {totalPlatformLessons}
              </div>
              <div className="text-xs text-slate-500 mt-1">تحديث مباشر من المنصة</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 mb-2">نسبة الحضور (سنتر وأونلاين)</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {student.attendanceRate}%
              </div>
              <div className="text-xs text-emerald-700 font-medium mt-1">مسجل من المشرف</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 mb-2">الكورسات المفعلة</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {student.unlockedCourseIds.length}
              </div>
              <div className="text-xs text-slate-500 mt-1">كورسات فعالة حالياً</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 mb-2">اختبارات الحصص التفاعلية</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {answeredCount > 0 ? `${correctCount} / ${answeredCount}` : 'لا يوجد بعد'}
              </div>
              <div className="text-xs text-slate-500 mt-1">الأسئلة المجابة داخل الدروس</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
            <h3 className="text-sm font-bold text-slate-900">ملاحظة المشرف لولي الأمر</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{student.supervisorNotes}</p>
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
        </div>
      )}
    </div>
  );
}
