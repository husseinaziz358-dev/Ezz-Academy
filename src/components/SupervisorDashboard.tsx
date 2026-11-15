import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  LogOut,
  Save,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { COURSES } from '../data/academyData';
import { EDUCATIONAL_STAGES, StudentRecord } from '../types/student';
import {
  apiFetchSupervisorStudents,
  apiUpdateSupervisorStudent,
} from '../utils/apiClient';
import {
  fetchAllFirebaseStudents,
  updateFirebaseStudentBySupervisor,
} from '../services/firebaseStudents';

interface SupervisorDashboardProps {
  supervisorName: string;
  supervisorPhone: string;
  token: string;
  onLogout: () => void;
}

export function SupervisorDashboard({
  supervisorName,
  supervisorPhone,
  token,
  onLogout,
}: SupervisorDashboardProps) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('جميع المراحل');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  // Editable follow-up fields for selected student
  const [editNotes, setEditNotes] = useState('');
  const [editAttendance, setEditAttendance] = useState<number>(100);
  const [editCourses, setEditCourses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const loadStudents = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (token === 'firebase-google-session') {
        const fbStudents = await fetchAllFirebaseStudents();
        setStudents(fbStudents);
        return;
      }
      const result = await apiFetchSupervisorStudents(token);
      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }
      setStudents(result.students);
    } catch {
      setErrorMsg('تعذر تحميل بيانات الطلاب من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const matchesStage = stageFilter === 'جميع المراحل' || s.stage === stageFilter;
      const matchesQuery =
        !q ||
        s.studentName.toLowerCase().includes(q) ||
        s.studentPhone.includes(q) ||
        s.parentName.toLowerCase().includes(q) ||
        s.parentPhone.includes(q) ||
        s.motherName.toLowerCase().includes(q) ||
        s.specialization.toLowerCase().includes(q);
      return matchesStage && matchesQuery;
    });
  }, [students, searchQuery, stageFilter]);

  const openStudentFollowUp = (student: StudentRecord) => {
    setSelectedStudent(student);
    setEditNotes(student.supervisorNotes);
    setEditAttendance(student.attendanceRate);
    setEditCourses(student.unlockedCourseIds);
    setSavedNotice(false);
  };

  const toggleCourseForStudent = (courseId: string) => {
    setEditCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    setSavedNotice(false);
    try {
      if (token === 'firebase-google-session') {
        const updated = await updateFirebaseStudentBySupervisor(selectedStudent.id, {
          supervisorNotes: editNotes,
          attendanceRate: editAttendance,
          unlockedCourseIds: editCourses,
        });
        setStudents((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        setSelectedStudent(updated);
        setSavedNotice(true);
        return;
      }

      const result = await apiUpdateSupervisorStudent(selectedStudent.id, token, {
        supervisorNotes: editNotes,
        attendanceRate: editAttendance,
        unlockedCourseIds: editCourses,
      });
      if (result.ok) {
        setStudents((prev) =>
          prev.map((s) => (s.id === result.student.id ? result.student : s))
        );
        setSelectedStudent(result.student);
        setSavedNotice(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const bacCount = students.filter((s) => s.stage === 'البكالوريا').length;
  const secCount = students.filter((s) => s.stage !== 'البكالوريا').length;
  const totalLessonsCompleted = students.reduce(
    (sum, s) => sum + s.completedLessonIds.length,
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>حساب المشرف · {supervisorPhone}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            لوحة المشرف لمتابعة الطلاب
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            مرحباً {supervisorName} — عرض كامل لبيانات الطلاب المسجلين، أولياء الأمور، المراحل، الشعب والمسارات، ومتابعة الحضور والكورسات.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل خروج المشرف</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-1.5">إجمالي الطلاب المسجلين</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{students.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-1.5">طلاب المرحلة الثانوية</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{secCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-1.5">طلاب البكالوريا</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{bacCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 mb-1.5">إجمالي الحصص المنجزة</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {totalLessonsCompleted}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الطالب، رقم الطالب، رقم ولي الأمر، أو اسم الأم..."
            aria-label="بحث في الطلاب"
            className="w-full pr-10 pl-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
          />
        </div>

        <select
          aria-label="تصفية حسب المرحلة"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
        >
          <option value="جميع المراحل">جميع المراحل</option>
          {EDUCATIONAL_STAGES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-900">
          {errorMsg}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">سجل بيانات الطلاب الكامل</h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {filteredStudents.length} طالب
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">جاري تحميل بيانات الطلاب...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            لا يوجد طلاب مطابقون لبحثك الحالي.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">اسم الطالب ورقمه</th>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">ولي الأمر ورقمه</th>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">اسم الأم</th>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">المرحلة والشعبة/المسار</th>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">الحضور والإنجاز</th>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((stu) => (
                  <tr key={stu.id} className="hover:bg-slate-50/70">
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{stu.studentName}</div>
                      <div className="font-mono text-xs text-slate-500 mt-0.5 tabular-nums" dir="ltr">
                        {stu.studentPhone}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-800">{stu.parentName}</div>
                      <div className="font-mono text-xs text-slate-500 mt-0.5 tabular-nums" dir="ltr">
                        {stu.parentPhone}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-700">{stu.motherName}</td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-900">{stu.stage}</div>
                      <div className="text-xs text-blue-700 mt-0.5">
                        {stu.specializationType}: {stu.specialization}
                      </div>
                    </td>
                    <td className="py-4 px-4 tabular-nums">
                      <div className="font-semibold text-slate-900">
                        حضور {stu.attendanceRate}%
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {stu.completedLessonIds.length} حصص · {stu.unlockedCourseIds.length} كورسات
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        type="button"
                        onClick={() => openStudentFollowUp(stu)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        متابعة وتعديل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sup-student-detail-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 id="sup-student-detail-title" className="text-lg font-bold text-slate-900">
                  ملف متابعة الطالب: {selectedStudent.studentName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedStudent.stage} · {selectedStudent.specializationType}:{' '}
                  {selectedStudent.specialization}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                aria-label="إغلاق"
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-lg border border-slate-200 p-4 text-xs">
              <div>
                <span className="text-slate-500">رقم الطالب:</span>
                <div className="font-mono font-semibold text-slate-900 mt-0.5" dir="ltr">
                  {selectedStudent.studentPhone}
                </div>
              </div>
              <div>
                <span className="text-slate-500">اسم ولي الأمر ورقمه:</span>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {selectedStudent.parentName} —{' '}
                  <span className="font-mono" dir="ltr">
                    {selectedStudent.parentPhone}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-500">اسم الأم:</span>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {selectedStudent.motherName}
                </div>
              </div>
              <div>
                <span className="text-slate-500">تاريخ التسجيل:</span>
                <div className="font-mono text-slate-900 mt-0.5 tabular-nums">
                  {new Date(selectedStudent.createdAt).toLocaleDateString('ar-EG')}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveFollowUp} className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <label htmlFor="sup-attendance-slider">نسبة الحضور والالتزام</label>
                  <span className="font-mono text-blue-700 tabular-nums">{editAttendance}%</span>
                </div>
                <input
                  id="sup-attendance-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={editAttendance}
                  onChange={(e) => setEditAttendance(Number(e.target.value))}
                  className="w-full accent-blue-700 cursor-pointer"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  الكورسات المفعلة للطالب
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COURSES.map((c) => {
                    const active = editCourses.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCourseForStudent(c.id)}
                        className={`p-2.5 text-right rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 ${
                          active
                            ? 'bg-blue-50 border-blue-300 text-blue-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{c.title}</span>
                        {active && <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="sup-notes-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  ملاحظات المشرف لمتابعة الطالب وولي الأمر
                </label>
                <textarea
                  id="sup-notes-input"
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              {savedNotice && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>تم حفظ التعديلات وتحديث ملف الطالب بنجاح.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'جاري الحفظ...' : 'حفظ المتابعة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
