import { StudentRecord } from '../types/student';

const FALLBACK_DB_KEY = 'ezz_academy_students_fallback_v1';

// SHA-256 hex of 'Husse123##' so no plaintext password is stored in client code
const SUPERVISOR_PHONE = '01022193514';
const SUPERVISOR_SHA256 =
  '254d0c7e5eb15e0a817e7634009d49d90425c3943c3230f22f52cfad1979a725';

export function normalizeDigits(input: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  return input
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/\s+/g, '')
    .trim();
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const SEED_FALLBACK_STUDENTS: StudentRecord[] = [
  {
    id: 'stu-1001',
    studentName: 'عمر خالد محمود',
    studentPhone: '01012345678',
    parentName: 'خالد محمود عبد العزيز',
    parentPhone: '01099887766',
    motherName: 'سحر أحمد حسن',
    stage: 'الصف الثالث الثانوي',
    specializationType: 'شعبة',
    specialization: 'علمي رياضة',
    unlockedCourseIds: ['course-sec3-pure-applied', 'course-sec3-rescue'],
    completedLessonIds: ['les-sec3-1', 'les-sec3-2'],
    quizAnswers: { 'les-sec3-1': 0, 'les-sec3-2': 0 },
    notesByLesson: {
      'les-sec3-1': 'مراجعة ميل العمودي والنقط الحرجة قبل الامتحان الشامل.',
    },
    supervisorNotes: 'طالب ملتزم في حضور السنتر والأونلاين، درجاته في التفاضل ممتازة.',
    attendanceRate: 96,
    createdAt: '2026-10-05T10:00:00.000Z',
    updatedAt: '2026-11-10T14:30:00.000Z',
  },
  {
    id: 'stu-1002',
    studentName: 'مريم طارق الشريف',
    studentPhone: '01122334455',
    parentName: 'طارق الشريف محمد',
    parentPhone: '01155443322',
    motherName: 'نادية مصطفى علي',
    stage: 'البكالوريا',
    specializationType: 'مسار',
    specialization: 'مسار الهندسة وعلوم الحاسب',
    unlockedCourseIds: ['course-sec3-math-lang', 'course-sec-ai-coding'],
    completedLessonIds: ['les-lang-1', 'les-prog-1'],
    quizAnswers: { 'les-lang-1': 0 },
    notesByLesson: {},
    supervisorNotes: 'متفوقة في مسار الهندسة وعلوم الحاسب وتحتاج متابعة في المعدلات الزمنية.',
    attendanceRate: 92,
    createdAt: '2026-10-12T09:15:00.000Z',
    updatedAt: '2026-11-12T16:20:00.000Z',
  },
  {
    id: 'stu-1003',
    studentName: 'يوسف إبراهيم سالم',
    studentPhone: '01234567890',
    parentName: 'إبراهيم سالم السيد',
    parentPhone: '01209876543',
    motherName: 'أمل محمود عبد الله',
    stage: 'الصف الثاني الثانوي',
    specializationType: 'شعبة',
    specialization: 'علمي',
    unlockedCourseIds: ['course-sec2-math'],
    completedLessonIds: ['les-sec2-1'],
    quizAnswers: {},
    notesByLesson: {},
    supervisorNotes: 'مطلوب متابعة ولي الأمر لاستكمال اختبارات الحصة الأولى.',
    attendanceRate: 84,
    createdAt: '2026-10-20T11:45:00.000Z',
    updatedAt: '2026-11-13T18:00:00.000Z',
  },
];

function getLocalStudents(): (StudentRecord & { passwordHash?: string })[] {
  try {
    const raw = window.localStorage.getItem(FALLBACK_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage read error
  }
  return [...SEED_FALLBACK_STUDENTS];
}

function saveLocalStudents(list: (StudentRecord & { passwordHash?: string })[]) {
  try {
    window.localStorage.setItem(FALLBACK_DB_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage write error
  }
}

async function tryServerJson<T>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T } | null> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }
    const text = await res.text();
    const data = JSON.parse(text) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return null;
  }
}

export async function apiLogin(phoneInput: string, password: string): Promise<
  | { ok: true; role: 'supervisor'; name: string; phone: string; token: string }
  | { ok: true; role: 'student'; student: StudentRecord; token: string }
  | { ok: false; error: string }
> {
  const phone = normalizeDigits(phoneInput);
  const serverRes = await tryServerJson<{
    role?: 'supervisor' | 'student';
    name?: string;
    phone?: string;
    token?: string;
    student?: StudentRecord;
    error?: string;
  }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });

  if (serverRes) {
    if (!serverRes.ok) {
      return {
        ok: false,
        error: serverRes.data.error || 'رقم الهاتف أو كلمة المرور غير صحيحة.',
      };
    }
    if (serverRes.data.role === 'supervisor' && serverRes.data.token) {
      return {
        ok: true,
        role: 'supervisor',
        name: serverRes.data.name || 'المشرف العام — Ezz Academy',
        phone: serverRes.data.phone || phone,
        token: serverRes.data.token,
      };
    }
    if (serverRes.data.role === 'student' && serverRes.data.student && serverRes.data.token) {
      return {
        ok: true,
        role: 'student',
        student: serverRes.data.student,
        token: serverRes.data.token,
      };
    }
  }

  // Fallback for static preview without backend server
  if (phone === SUPERVISOR_PHONE) {
    const hash = await sha256Hex(password);
    if (hash !== SUPERVISOR_SHA256) {
      return { ok: false, error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' };
    }
    return {
      ok: true,
      role: 'supervisor',
      name: 'المشرف العام — Ezz Academy',
      phone: SUPERVISOR_PHONE,
      token: 'local-supervisor-session',
    };
  }

  const list = getLocalStudents();
  const student = list.find((s) => s.studentPhone === phone);
  if (!student) {
    return { ok: false, error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' };
  }
  const hash = await sha256Hex(password);
  const expectedSeedHash = await sha256Hex('123456');
  if (student.passwordHash ? hash !== student.passwordHash : hash !== expectedSeedHash) {
    return { ok: false, error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' };
  }
  const { passwordHash: _ignored, ...safeStudent } = student;
  return {
    ok: true,
    role: 'student',
    student: safeStudent,
    token: `local-student-${student.id}`,
  };
}

export async function apiRegisterStudent(payload: {
  studentName: string;
  studentPhone: string;
  parentName: string;
  parentPhone: string;
  motherName: string;
  stage: string;
  specialization: string;
  password: string;
}): Promise<
  | { ok: true; student: StudentRecord; token: string }
  | { ok: false; error: string }
> {
  const normalizedPayload = {
    ...payload,
    studentPhone: normalizeDigits(payload.studentPhone),
    parentPhone: normalizeDigits(payload.parentPhone),
  };

  const serverRes = await tryServerJson<{
    student?: StudentRecord;
    token?: string;
    error?: string;
  }>('/api/students/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizedPayload),
  });

  if (serverRes) {
    if (!serverRes.ok || !serverRes.data.student || !serverRes.data.token) {
      return {
        ok: false,
        error: serverRes.data.error || 'تعذر إنشاء الحساب. راجع البيانات وحاول مجددًا.',
      };
    }
    return {
      ok: true,
      student: serverRes.data.student,
      token: serverRes.data.token,
    };
  }

  // Fallback for static preview
  const list = getLocalStudents();
  if (
    normalizedPayload.studentPhone === SUPERVISOR_PHONE ||
    list.some((s) => s.studentPhone === normalizedPayload.studentPhone)
  ) {
    return { ok: false, error: 'رقم الطالب مسجل بالفعل. يمكنك تسجيل الدخول مباشرة.' };
  }
  const now = new Date().toISOString();
  const passwordHash = await sha256Hex(payload.password);
  const newStudent: StudentRecord & { passwordHash?: string } = {
    id: `stu-${Date.now()}`,
    studentName: payload.studentName.trim(),
    studentPhone: normalizedPayload.studentPhone,
    parentName: payload.parentName.trim(),
    parentPhone: normalizedPayload.parentPhone,
    motherName: payload.motherName.trim(),
    stage: payload.stage,
    specializationType: payload.stage === 'البكالوريا' ? 'مسار' : 'شعبة',
    specialization: payload.specialization,
    passwordHash,
    unlockedCourseIds: ['course-sec3-pure-applied', 'course-sec1-math'],
    completedLessonIds: [],
    quizAnswers: {},
    notesByLesson: {},
    supervisorNotes: 'حساب جديد — في انتظار المراجعة الأولى.',
    attendanceRate: 100,
    createdAt: now,
    updatedAt: now,
  };
  saveLocalStudents([newStudent, ...list]);
  const { passwordHash: _ignored, ...safeStudent } = newStudent;
  return {
    ok: true,
    student: safeStudent,
    token: `local-student-${newStudent.id}`,
  };
}

export async function apiFetchSupervisorStudents(token: string): Promise<
  | { ok: true; students: StudentRecord[] }
  | { ok: false; error: string }
> {
  const serverRes = await tryServerJson<{ students?: StudentRecord[]; error?: string }>(
    '/api/supervisor/students',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (serverRes) {
    if (!serverRes.ok) {
      return { ok: false, error: serverRes.data.error || 'تعذر تحميل بيانات الطلاب.' };
    }
    return { ok: true, students: serverRes.data.students || [] };
  }

  return {
    ok: true,
    students: getLocalStudents().map(({ passwordHash: _ignored, ...safe }) => safe),
  };
}

export async function apiUpdateSupervisorStudent(
  studentId: string,
  token: string,
  updates: {
    supervisorNotes: string;
    attendanceRate: number;
    unlockedCourseIds: string[];
  }
): Promise<{ ok: true; student: StudentRecord } | { ok: false; error: string }> {
  const serverRes = await tryServerJson<{ student?: StudentRecord; error?: string }>(
    `/api/supervisor/students/${studentId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    }
  );

  if (serverRes) {
    if (!serverRes.ok || !serverRes.data.student) {
      return { ok: false, error: serverRes.data.error || 'تعذر حفظ التعديلات.' };
    }
    return { ok: true, student: serverRes.data.student };
  }

  const list = getLocalStudents();
  const idx = list.findIndex((s) => s.id === studentId);
  if (idx === -1) return { ok: false, error: 'الطالب غير موجود.' };
  const updated = {
    ...list[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  saveLocalStudents(list);
  const { passwordHash: _ignored, ...safeStudent } = updated;
  return { ok: true, student: safeStudent };
}

export async function apiSyncStudentProgress(
  studentId: string,
  token: string,
  updates: {
    unlockedCourseIds: string[];
    completedLessonIds: string[];
    notesByLesson: Record<string, string>;
    quizAnswers: Record<string, number>;
  }
): Promise<void> {
  const serverRes = await tryServerJson<{ student?: StudentRecord }>(
    `/api/students/${studentId}/progress`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    }
  );

  if (serverRes) return;

  const list = getLocalStudents();
  const idx = list.findIndex((s) => s.id === studentId);
  if (idx === -1) return;
  list[idx] = {
    ...list[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveLocalStudents(list);
}

export async function apiLookupParent(phoneInput: string): Promise<
  | { ok: true; student: StudentRecord }
  | { ok: false; error: string }
> {
  const phone = normalizeDigits(phoneInput);
  const serverRes = await tryServerJson<{ student?: StudentRecord; error?: string }>(
    `/api/parent/lookup?phone=${encodeURIComponent(phone)}`
  );

  if (serverRes) {
    if (!serverRes.ok || !serverRes.data.student) {
      return {
        ok: false,
        error: serverRes.data.error || 'لم يتم العثور على طالب مرتبط بهذا الرقم.',
      };
    }
    return { ok: true, student: serverRes.data.student };
  }

  const found = getLocalStudents().find(
    (s) => s.parentPhone === phone || s.studentPhone === phone
  );
  if (!found) {
    return { ok: false, error: 'لم يتم العثور على طالب مرتبط بهذا الرقم.' };
  }
  const { passwordHash: _ignored, ...safeStudent } = found;
  return { ok: true, student: safeStudent };
}
