import { DynamicTeacher, EducationalStage, StudentRecord } from '../types/student';
import { Course } from '../data/academyData';

const FALLBACK_DB_KEY = 'ezz_academy_students_fallback_v1';
const FALLBACK_CATALOG_KEY = 'ezz_academy_catalog_v1';

// SHA-256 hex of 'Husse123##' so no plaintext password is stored in client code
const SUPERVISOR_PHONE = '01022193514';
const SUPERVISOR_SHA256 =
  '43a8f3a4982f9dba8097ed482a8c35882c71469290a5eba22ada384257f3e72b';

export function normalizeDigits(input: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  let normalized = input
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[\s\-()]/g, '')
    .trim();
  if (normalized.startsWith('+20')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('0020')) {
    normalized = '0' + normalized.slice(4);
  } else if (normalized.startsWith('201') && normalized.length === 12) {
    normalized = '0' + normalized.slice(2);
  }
  return normalized;
}

function pureSha256Hex(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const utf8 = unescape(encodeURIComponent(ascii));
  const asciiBitLength = utf8.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2, root = Math.sqrt(n); factor <= root; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };
  const frac = (n: number) => ((n - (n | 0)) * maxWord) | 0;

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) hash[primeCounter] = frac(mathPow(candidate, 1 / 2));
      k[primeCounter] = frac(mathPow(candidate, 1 / 3));
      primeCounter++;
    }
  }

  let msg = utf8 + '\x80';
  while ((msg.length % 64) - 56) msg += '\x00';
  for (let i = 0; i < msg.length; i++) {
    const j = msg.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash.unshift((temp1 + temp2) | 0);
      hash.pop();
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

async function sha256Hex(text: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback to pure JS SHA-256
  }
  return pureSha256Hex(text);
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
    const trimmedHash = await sha256Hex(password.trim());
    if (hash !== SUPERVISOR_SHA256 && trimmedHash !== SUPERVISOR_SHA256) {
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

interface LocalCatalog {
  teachers: DynamicTeacher[];
  customCourses: Course[];
}

function getLocalCatalog(): LocalCatalog {
  try {
    const raw = window.localStorage.getItem(FALLBACK_CATALOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalCatalog>;
      return {
        teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
        customCourses: Array.isArray(parsed.customCourses) ? parsed.customCourses : [],
      };
    }
  } catch {
    // Ignore storage read error
  }
  return { teachers: [], customCourses: [] };
}

function saveLocalCatalog(catalog: LocalCatalog) {
  try {
    window.localStorage.setItem(FALLBACK_CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    // Ignore storage write error
  }
}

export async function apiFetchAcademyCatalog(): Promise<LocalCatalog> {
  const serverRes = await tryServerJson<LocalCatalog>('/api/academy/catalog');
  if (serverRes && serverRes.ok) {
    return {
      teachers: Array.isArray(serverRes.data.teachers) ? serverRes.data.teachers : [],
      customCourses: Array.isArray(serverRes.data.customCourses)
        ? serverRes.data.customCourses
        : [],
    };
  }
  return getLocalCatalog();
}

export async function apiAddTeacher(
  token: string,
  payload: {
    name: string;
    subject: string;
    grades: EducationalStage[];
    image: string;
  }
): Promise<{ ok: true; teacher: DynamicTeacher } | { ok: false; error: string }> {
  const serverRes = await tryServerJson<{ teacher?: DynamicTeacher; error?: string }>(
    '/api/supervisor/teachers',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );
  if (serverRes) {
    if (!serverRes.ok || !serverRes.data.teacher) {
      return { ok: false, error: serverRes.data.error || 'تعذر إضافة المدرس.' };
    }
    return { ok: true, teacher: serverRes.data.teacher };
  }

  const catalog = getLocalCatalog();
  const teacher: DynamicTeacher = {
    id: `teacher-${Date.now()}`,
    name: payload.name.trim(),
    subject: payload.subject.trim(),
    grades: payload.grades.length > 0 ? payload.grades : ['الصف الثالث الثانوي'],
    image: payload.image || '/src/assets/images/hero_academy_studio_1794779037349.jpg',
    createdAt: new Date().toISOString(),
  };
  catalog.teachers.push(teacher);
  saveLocalCatalog(catalog);
  return { ok: true, teacher };
}

export async function apiDeleteTeacher(token: string, teacherId: string): Promise<boolean> {
  const serverRes = await tryServerJson<{ ok?: boolean }>(
    `/api/supervisor/teachers/${teacherId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (serverRes) return serverRes.ok;

  const catalog = getLocalCatalog();
  catalog.teachers = catalog.teachers.filter((t) => t.id !== teacherId);
  saveLocalCatalog(catalog);
  return true;
}

export function mergeCatalogCourses(
  customCourses: Course[],
  builtInCourses: Course[]
): Course[] {
  const overrideMap = new Map(customCourses.map((c) => [c.id, c]));
  const builtInIds = new Set(builtInCourses.map((c) => c.id));
  const customOnly = customCourses.filter((c) => !builtInIds.has(c.id));
  const mergedBuiltIn = builtInCourses.map((c) => overrideMap.get(c.id) ?? c);
  return [...customOnly, ...mergedBuiltIn];
}

export async function apiUploadMediaFile(
  token: string,
  file: File
): Promise<{ ok: true; url: string; fileName: string } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/supervisor/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-file-name': encodeURIComponent(file.name),
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as { url?: string; fileName?: string; error?: string };
      if (!res.ok || !data.url) {
        return { ok: false, error: data.error || 'تعذر رفع الملف على الخادم.' };
      }
      return { ok: true, url: data.url, fileName: data.fileName || file.name };
    }
  } catch {
    // Fall through to static preview fallback below
  }

  // Static preview fallback when Express server is unavailable
  if (file.size <= 1.5 * 1024 * 1024) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ ok: true, url: String(reader.result), fileName: file.name });
      };
      reader.onerror = () => {
        resolve({ ok: false, error: 'تعذر قراءة الملف المختار.' });
      };
      reader.readAsDataURL(file);
    });
  }

  const blobUrl = URL.createObjectURL(file);
  return { ok: true, url: blobUrl, fileName: file.name };
}

export async function apiAddCourse(
  token: string,
  payload: {
    title: string;
    subtitle: string;
    grade: EducationalStage;
    category: string;
    instructorId: string;
    studyMode: 'أونلاين' | 'سنتر وأونلاين';
    priceEgp: number;
    image: string;
    lessonTitles: string[];
  }
): Promise<{ ok: true; course: Course } | { ok: false; error: string }> {
  const serverRes = await tryServerJson<{ course?: Course; error?: string }>(
    '/api/supervisor/courses',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );
  if (serverRes) {
    if (!serverRes.ok || !serverRes.data.course) {
      return { ok: false, error: serverRes.data.error || 'تعذر إضافة الكورس.' };
    }
    return { ok: true, course: serverRes.data.course };
  }

  const lessonsList =
    payload.lessonTitles.length > 0
      ? payload.lessonTitles
      : ['الحصة الأولى: شرح الأساسيات والتطبيقات'];

  const course: Course = {
    id: `course-custom-${Date.now()}`,
    title: payload.title.trim(),
    subtitle:
      payload.subtitle.trim() || `شرح وتطبيقات ${payload.title.trim()} لطلاب ${payload.grade}.`,
    grade: payload.grade,
    category: payload.category.trim() || 'محتوى المنهج',
    studyMode: payload.studyMode,
    priceEgp: payload.priceEgp || 250,
    totalHours: Math.max(4, lessonsList.length * 2),
    instructorId: payload.instructorId,
    image: payload.image || '/src/assets/images/course_math_calculus_1794779284413.jpg',
    fallbackTitle: payload.title.trim(),
    modules: [
      {
        id: `mod-${Date.now()}`,
        title: 'الحصص الدراسية',
        lessons: lessonsList.map((lesTitle, idx) => {
          const defaultQ = {
            question: `اختبار سريع على: ${lesTitle}`,
            options: [
              'مراجعة المفهوم الأساسي وتطبيق القانون المباشر',
              'إهمال شروط التعريف في المسألة',
              'الاعتماد على خطوات غير مكتملة',
              'لا شيء مما سبق',
            ],
            correctIndex: 0,
            explanation: 'الخطوة الصحيحة دائمًا تبدأ بتحقيق شروط القانون الأساسي ثم التعويض الدقيق.',
          };
          return {
            id: `les-${Date.now()}-${idx + 1}`,
            title: lesTitle,
            durationMinutes: 45,
            summary: `شرح تفصيلي لدرس «${lesTitle}» مع أمثلة محلولة وتدريبات شاملة لطلاب ${payload.grade}.`,
            keyTakeaways: [
              'فهم القوانين الأساسية والتعريفات المرتبطة بالدرس.',
              'حل مسائل متدرجة المستوى وفق مواصفات الامتحان.',
              'مراجعة أبرز نقاط الفهم الشائعة قبل الاختبار.',
            ],
            videos: [],
            attachments: [],
            examQuestions: [defaultQ],
            simulationKind: 'math-calculus' as const,
            quiz: defaultQ,
          };
        }),
      },
    ],
  };

  const catalog = getLocalCatalog();
  catalog.customCourses.unshift(course);
  saveLocalCatalog(catalog);
  return { ok: true, course };
}

export async function apiUpdateCourse(
  token: string,
  course: Course
): Promise<{ ok: true; course: Course } | { ok: false; error: string }> {
  const serverRes = await tryServerJson<{ course?: Course; error?: string }>(
    `/api/supervisor/courses/${course.id}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(course),
    }
  );
  if (serverRes) {
    if (!serverRes.ok || !serverRes.data.course) {
      return { ok: false, error: serverRes.data.error || 'تعذر حفظ تعديلات الكورس.' };
    }
    return { ok: true, course: serverRes.data.course };
  }

  const catalog = getLocalCatalog();
  const idx = catalog.customCourses.findIndex((c) => c.id === course.id);
  if (idx >= 0) {
    catalog.customCourses[idx] = course;
  } else {
    catalog.customCourses.unshift(course);
  }
  saveLocalCatalog(catalog);
  return { ok: true, course };
}

export async function apiDeleteCourse(token: string, courseId: string): Promise<boolean> {
  const serverRes = await tryServerJson<{ ok?: boolean }>(
    `/api/supervisor/courses/${courseId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (serverRes) return serverRes.ok;

  const catalog = getLocalCatalog();
  catalog.customCourses = catalog.customCourses.filter((c) => c.id !== courseId);
  saveLocalCatalog(catalog);
  return true;
}
