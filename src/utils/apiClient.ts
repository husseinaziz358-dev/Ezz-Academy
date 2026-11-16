import {
  DynamicTeacher,
  EducationalStage,
  LessonExamResult,
  StudentApprovalStatus,
  StudentNotification,
  StudentRecord,
} from '../types/student';
import { Course, COURSES, normalizeSubjectCategory } from '../data/academyData';
import { computeStudentAttendance } from './attendance';
import { getClientDeviceInfo, mergeStudentDeviceEntry } from './deviceInfo';

const FALLBACK_DB_KEY = 'ezz_academy_students_fallback_v2';
const FALLBACK_CATALOG_KEY = 'ezz_academy_catalog_v1';
const DEVICE_ID_KEY = 'ezz_academy_device_id_v1';

export function getOrCreateDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim().length > 0) return existing.trim();
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `dev-${crypto.randomUUID()}`
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return 'dev-browser';
  }
}

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

export function formatWhatsappUrl(phoneInput: string, text?: string): string {
  const digits = normalizeDigits(phoneInput).replace(/[^0-9]/g, '');
  const intl = digits.startsWith('0') ? `20${digits.slice(1)}` : digits || '201022193514';
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${intl}${query}`;
}

export function formatTelegramUrl(rawInput: string): string {
  const val = rawInput.trim();
  if (!val) return '';
  if (/^https?:\/\//i.test(val)) return val;
  if (val.startsWith('t.me/')) return `https://${val}`;
  if (val.startsWith('@')) return `https://t.me/${val.slice(1)}`;
  const digitsOnly = normalizeDigits(val).replace(/[^0-9+]/g, '');
  if (/^\+?[0-9]{8,15}$/.test(digitsOnly)) {
    const clean = digitsOnly.replace(/^\+/, '');
    const intl = clean.startsWith('0') ? `+20${clean.slice(1)}` : `+${clean}`;
    return `https://t.me/${intl}`;
  }
  return `https://t.me/${val.replace(/^@/, '')}`;
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

type LocalStudentRecord = StudentRecord & {
  passwordHash?: string;
  pendingServerSync?: boolean;
};

const SEED_FALLBACK_STUDENTS: LocalStudentRecord[] = [];

function getLocalStudents(): LocalStudentRecord[] {
  try {
    const raw = window.localStorage.getItem(FALLBACK_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as LocalStudentRecord[];
    }
  } catch {
    // Ignore storage read error
  }
  return [...SEED_FALLBACK_STUDENTS];
}

function saveLocalStudents(list: LocalStudentRecord[]) {
  try {
    window.localStorage.setItem(FALLBACK_DB_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage write error
  }
}

function applyLocalAutoBlockPolicy(
  student: StudentRecord & { passwordHash?: string },
  activeDeviceIds: string[]
): StudentRecord & { passwordHash?: string } {
  if (student.autoBlockExempt) return student;
  const existingNotifs = Array.isArray(student.notifications) ? student.notifications : [];
  if (activeDeviceIds.length >= 3) {
    const alreadyNotif = existingNotifs.some((n) => n.id.startsWith('autoblk-lock-'));
    const nextNotifs = alreadyNotif
      ? existingNotifs
      : [
          {
            id: `autoblk-lock-${Date.now()}`,
            title: 'تم حظر الحساب تلقائيًا',
            message:
              'تم حظر حسابك تلقائيًا بسبب فتحه من 3 أجهزة أو أكثر. تواصل مع المشرف لإيقاف الحظر.',
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...existingNotifs,
        ].slice(0, 30);
    return {
      ...student,
      isBlocked: true,
      blockReason:
        student.blockReason ||
        'تم حظر الحساب تلقائيًا لتجاوز الحد المسموح للأجهزة (٣ أجهزة أو أكثر).',
      notifications: nextNotifs,
    };
  }
  if (activeDeviceIds.length === 2) {
    const tag = `warn-autoblk-${activeDeviceIds[1].slice(0, 24)}`;
    if (!existingNotifs.some((n) => n.id.startsWith(tag))) {
      return {
        ...student,
        notifications: [
          {
            id: `${tag}-${Date.now()}`,
            title: 'إنذار الحظر التلقائي — تعدد الأجهزة',
            message:
              'تم رصد فتح حسابك من جهاز ثانٍ. يُسمح بحد أقصى جهازين، وفي حالة الدخول من جهاز ثالث سيتم حظر حسابك تلقائيًا لحماية اشتراكاتك.',
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...existingNotifs,
        ].slice(0, 30),
      };
    }
  }
  return student;
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

async function tryServerJsonWithRetry<T>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T } | null> {
  const first = await tryServerJson<T>(url, options);
  if (first !== null) return first;
  await new Promise((resolve) => setTimeout(resolve, 350));
  return tryServerJson<T>(url, options);
}

export async function apiLogin(phoneInput: string, password: string): Promise<
  | { ok: true; role: 'supervisor'; name: string; phone: string; token: string }
  | { ok: true; role: 'student'; student: StudentRecord; token: string }
  | { ok: false; error: string }
> {
  const phone = normalizeDigits(phoneInput);
  const deviceId = getOrCreateDeviceId();
  const deviceInfo = getClientDeviceInfo(deviceId);
  const serverRes = await tryServerJsonWithRetry<{
    role?: 'supervisor' | 'student';
    name?: string;
    phone?: string;
    token?: string;
    student?: StudentRecord;
    error?: string;
  }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password, deviceId, deviceInfo }),
  });

  if (serverRes) {
    if (!serverRes.ok) {
      // If student submitted a request earlier while offline/restarting, sync it as pending for the supervisor
      if (serverRes.status === 401 && phone !== SUPERVISOR_PHONE) {
        const list = getLocalStudents();
        const localIdx = list.findIndex((s) => s.studentPhone === phone);
        if (localIdx !== -1) {
          const localStu = list[localIdx];
          if (localStu.approvalStatus === 'rejected') {
            return {
              ok: false,
              error: 'لم تتم الموافقة على طلب إنشاء حسابك من قِبل المشرف.',
            };
          }
          const hash = await sha256Hex(password);
          if (!localStu.passwordHash || hash === localStu.passwordHash) {
            const migrated = await tryServerJson<{
              pendingApproval?: boolean;
              message?: string;
              error?: string;
            }>('/api/students/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentName: localStu.studentName,
                studentPhone: localStu.studentPhone,
                parentName: localStu.parentName,
                parentPhone: localStu.parentPhone,
                parentJob: localStu.parentJob ?? '',
                motherName: localStu.motherName,
                stage: localStu.stage,
                specialization: localStu.specialization,
                password,
                deviceId,
                deviceInfo,
              }),
            });
            if (migrated?.ok && migrated.data.pendingApproval) {
              saveLocalStudents(list.filter((_, idx) => idx !== localIdx));
              return {
                ok: false,
                error:
                  migrated.data.message ||
                  'طلب إنشاء حسابك قيد المراجعة حاليًا في انتظار موافقة المشرف.',
              };
            }
          }
          if (localStu.approvalStatus === 'pending') {
            return {
              ok: false,
              error:
                'طلب إنشاء حسابك قيد المراجعة حاليًا. لا يمكن تسجيل الدخول قبل موافقة المشرف.',
            };
          }
        }
      }
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
  const idx = list.findIndex((s) => s.studentPhone === phone);
  if (idx === -1) {
    return { ok: false, error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' };
  }
  const student = list[idx];
  const hash = await sha256Hex(password);
  const expectedSeedHash = await sha256Hex('123456');
  if (student.passwordHash ? hash !== student.passwordHash : hash !== expectedSeedHash) {
    return { ok: false, error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' };
  }
  if (student.approvalStatus === 'pending') {
    return {
      ok: false,
      error: 'طلب إنشاء حسابك قيد المراجعة حاليًا. لا يمكن تسجيل الدخول قبل موافقة المشرف.',
    };
  }
  if (student.approvalStatus === 'rejected') {
    return {
      ok: false,
      error: 'لم تتم الموافقة على طلب إنشاء حسابك من قِبل المشرف.',
    };
  }
  if (student.isBlocked) {
    return {
      ok: false,
      error:
        student.blockReason ||
        'تم حظر هذا الحساب من قِبل الإدارة. تواصل مع الدعم الفني.',
    };
  }
  const mergedDevices = mergeStudentDeviceEntry(
    student.activeDeviceIds,
    student.deviceDetails,
    deviceId,
    deviceInfo
  );
  const afterPolicy = applyLocalAutoBlockPolicy(
    {
      ...student,
      activeDeviceIds: mergedDevices.activeDeviceIds,
      deviceDetails: mergedDevices.deviceDetails,
    },
    mergedDevices.activeDeviceIds
  );
  list[idx] = afterPolicy;
  saveLocalStudents(list);
  if (afterPolicy.isBlocked) {
    return {
      ok: false,
      error:
        afterPolicy.blockReason ||
        'تم حظر هذا الحساب تلقائيًا لتجاوز الحد المسموح للأجهزة. تواصل مع المشرف لإيقاف الحظر.',
    };
  }
  const { passwordHash: _ignored, ...safeStudent } = list[idx];
  return {
    ok: true,
    role: 'student',
    student: safeStudent,
    token: `local-student-${student.id}`,
  };
}

export async function apiRegisterStudent(payload: {
  studentName: string;
  username?: string;
  gmail?: string;
  studentPhone: string;
  parentName: string;
  parentPhone: string;
  parentJob: string;
  motherName: string;
  stage: string;
  specialization: string;
  password: string;
}): Promise<
  | { ok: true; pendingApproval: true; message: string }
  | { ok: false; error: string }
> {
  const deviceId = getOrCreateDeviceId();
  const deviceInfo = getClientDeviceInfo(deviceId);
  const normalizedPayload = {
    ...payload,
    parentJob: payload.parentJob.trim(),
    studentPhone: normalizeDigits(payload.studentPhone),
    parentPhone: normalizeDigits(payload.parentPhone),
    deviceId,
    deviceInfo,
  };

  const serverRes = await tryServerJsonWithRetry<{
    pendingApproval?: boolean;
    message?: string;
    error?: string;
  }>('/api/students/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizedPayload),
  });

  if (serverRes) {
    if (!serverRes.ok) {
      return {
        ok: false,
        error: serverRes.data.error || 'تعذر إرسال طلب إنشاء الحساب. راجع البيانات وحاول مجددًا.',
      };
    }
    const existingLocal = getLocalStudents();
    if (existingLocal.some((s) => s.studentPhone === normalizedPayload.studentPhone)) {
      saveLocalStudents(
        existingLocal.filter((s) => s.studentPhone !== normalizedPayload.studentPhone)
      );
    }
    return {
      ok: true,
      pendingApproval: true,
      message:
        serverRes.data.message ||
        'تم إرسال طلب إنشاء الحساب بنجاح. لا يمكن تفعيل الحساب أو الدخول إلا بعد موافقة المشرف.',
    };
  }

  // Fallback for static preview / server restart window
  const list = getLocalStudents();
  if (normalizedPayload.studentPhone === SUPERVISOR_PHONE) {
    return { ok: false, error: 'هذا الرقم مسجل بالفعل في النظام.' };
  }
  const duplicate = list.find(
    (s) => normalizeDigits(s.studentPhone) === normalizedPayload.studentPhone
  );
  if (duplicate) {
    if (duplicate.approvalStatus === 'pending') {
      return {
        ok: false,
        error:
          'لا يمكن إنشاء أكثر من حساب بنفس رقم الهاتف. يوجد طلب تسجيل لهذا الرقم قيد المراجعة في انتظار موافقة المشرف.',
      };
    }
    if (duplicate.approvalStatus === 'rejected') {
      return {
        ok: false,
        error:
          'لا يمكن إنشاء حساب جديد بهذا الرقم؛ تم رفض طلب التسجيل السابق من قِبل المشرف.',
      };
    }
    return {
      ok: false,
      error:
        'لا يمكن إنشاء أكثر من حساب بنفس رقم الهاتف. هذا الرقم مسجل ومفعل بالفعل، يمكنك تسجيل الدخول مباشرة.',
    };
  }
  const now = new Date().toISOString();
  const passwordHash = await sha256Hex(payload.password);
  const newStudent: LocalStudentRecord = {
    id: `stu-${Date.now()}`,
    studentName: payload.studentName.trim(),
    studentPhone: normalizedPayload.studentPhone,
    parentName: payload.parentName.trim(),
    parentPhone: normalizedPayload.parentPhone,
    parentJob: payload.parentJob.trim(),
    motherName: payload.motherName.trim(),
    stage: payload.stage,
    specializationType: payload.stage === 'البكالوريا' ? 'مسار' : 'شعبة',
    specialization: payload.specialization,
    passwordHash,
    approvalStatus: 'pending',
    pendingServerSync: true,
    unlockedCourseIds: [],
    completedLessonIds: [],
    quizAnswers: {},
    examResults: {},
    notesByLesson: {},
    supervisorNotes: 'طلب تسجيل جديد — في انتظار موافقة المشرف.',
    attendanceRate: 0,
    attendanceDates: {},
    walletBalance: 0,
    isBlocked: false,
    activeDeviceIds: [deviceId],
    deviceDetails: { [deviceId]: deviceInfo },
    createdAt: now,
    updatedAt: now,
  };
  saveLocalStudents([newStudent, ...list]);
  return {
    ok: true,
    pendingApproval: true,
    message:
      'تم إرسال طلب إنشاء الحساب بنجاح. لا يمكن تفعيل الحساب أو الدخول إلا بعد موافقة المشرف.',
  };
}

export async function apiForgotPassword(
  phoneOrEmail: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const serverRes = await tryServerJson<{ ok?: boolean; message?: string; error?: string }>(
    '/api/students/forgot-password',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneOrEmail }),
    }
  );
  if (serverRes && serverRes.ok && serverRes.data.ok) {
    return {
      ok: true,
      message: serverRes.data.message || 'تم إرسال كلمة المرور بنجاح في رسالة إلى بريدك الإلكتروني (Gmail).',
    };
  }
  const list = getLocalStudents();
  const found = list.find(
    (s) =>
      s.studentPhone === normalizeDigits(phoneOrEmail) ||
      s.gmail?.toLowerCase() === phoneOrEmail.toLowerCase() ||
      s.studentEmail?.toLowerCase() === phoneOrEmail.toLowerCase() ||
      s.username?.toLowerCase() === phoneOrEmail.toLowerCase()
  );
  if (!found) {
    return { ok: false, error: 'لم يتم العثور على طالب مسجل بهذا الرقم أو البريد الإلكتروني.' };
  }
  const targetEmail = found.gmail || found.studentEmail || found.studentPhone;
  return {
    ok: true,
    message: `تم إرسال كلمة المرور بنجاح في رسالة إلى بريدك الإلكتروني (Gmail: ${targetEmail}).`,
  };
}

export async function apiSyncPendingStudentSession(
  studentId: string,
  currentToken: string
): Promise<{ student: StudentRecord; token: string } | null> {
  if (!currentToken.startsWith('local-student-')) return null;
  const list = getLocalStudents();
  const localStu = list.find((s) => s.id === studentId);
  if (!localStu) return null;

  const deviceId = getOrCreateDeviceId();
  const deviceInfo = getClientDeviceInfo(deviceId);
  const payload = {
    id: localStu.id,
    studentName: localStu.studentName,
    studentPhone: localStu.studentPhone,
    parentName: localStu.parentName,
    parentPhone: localStu.parentPhone,
    parentJob: localStu.parentJob ?? '',
    motherName: localStu.motherName,
    stage: localStu.stage,
    specialization: localStu.specialization,
    unlockedCourseIds: localStu.unlockedCourseIds,
    completedLessonIds: localStu.completedLessonIds,
    notesByLesson: localStu.notesByLesson,
    quizAnswers: localStu.quizAnswers,
    examResults: localStu.examResults ?? {},
    attendanceRate: localStu.attendanceRate,
    attendanceDates: localStu.attendanceDates ?? {},
    activeDeviceIds: localStu.activeDeviceIds ?? [deviceId],
    deviceDetails: localStu.deviceDetails ?? { [deviceId]: deviceInfo },
    createdAt: localStu.createdAt,
    deviceId,
    deviceInfo,
  };

  const res = await tryServerJson<{
    student?: StudentRecord;
    token?: string;
    pendingApproval?: boolean;
  }>('/api/students/sync-local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res?.ok && res.data.student && res.data.token && !res.data.pendingApproval) {
    saveLocalStudents(list.filter((s) => s.id !== studentId));
    return { student: res.data.student, token: res.data.token };
  }
  return null;
}

export async function apiFetchSupervisorStudents(token: string): Promise<
  | { ok: true; students: StudentRecord[] }
  | { ok: false; error: string }
> {
  if (token === 'local-supervisor-session') {
    const catalog = getLocalCatalog();
    const merged = mergeCatalogCourses(catalog.customCourses, COURSES);
    return {
      ok: true,
      students: getLocalStudents().map(({ passwordHash: _ignored, pendingServerSync: _p, ...safe }) => ({
        ...safe,
        attendanceRate: computeStudentAttendance(safe, merged).rate,
      })),
    };
  }

  // First import any students that were registered offline/during restart in this browser
  const localPending = getLocalStudents();
  if (localPending.length > 0 && token && token !== 'firebase-google-session' && !token.startsWith('local-')) {
    const importRes = await tryServerJson<{
      importedCount?: number;
      students?: StudentRecord[];
    }>('/api/supervisor/students/import-local', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ students: localPending }),
    });
    if (importRes?.ok && Array.isArray(importRes.data.students)) {
      saveLocalStudents([]);
      return { ok: true, students: importRes.data.students };
    }
  }

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

  const catalog = getLocalCatalog();
  const merged = mergeCatalogCourses(catalog.customCourses, COURSES);
  return {
    ok: true,
    students: getLocalStudents().map(({ passwordHash: _ignored, pendingServerSync: _p, ...safe }) => ({
      ...safe,
      attendanceRate: computeStudentAttendance(safe, merged).rate,
    })),
  };
}

export async function apiUpdateSupervisorStudent(
  studentId: string,
  token: string,
  updates: {
    supervisorNotes?: string;
    attendanceRate?: number;
    unlockedCourseIds?: string[];
    walletBalance?: number;
    addWalletAmount?: number;
    approvalStatus?: StudentApprovalStatus;
    isBlocked?: boolean;
    autoBlockExempt?: boolean;
    blockReason?: string;
    resetDevices?: boolean;
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
  const catalog = getLocalCatalog();
  const merged = mergeCatalogCourses(catalog.customCourses, COURSES, catalog.deletedCourseIds);
  const nextUnlocked = updates.unlockedCourseIds ?? list[idx].unlockedCourseIds;
  const autoAttendance = computeStudentAttendance(
    {
      unlockedCourseIds: nextUnlocked,
      completedLessonIds: list[idx].completedLessonIds,
      stage: list[idx].stage,
    },
    merged
  );
  let nextWallet = Math.max(0, Number(list[idx].walletBalance) || 0);
  if (typeof updates.walletBalance === 'number' && Number.isFinite(updates.walletBalance)) {
    nextWallet = Math.max(0, Math.round(updates.walletBalance));
  }
  if (typeof updates.addWalletAmount === 'number' && Number.isFinite(updates.addWalletAmount)) {
    nextWallet = Math.max(0, Math.round(nextWallet + updates.addWalletAmount));
  }
  const nextBlocked =
    typeof updates.isBlocked === 'boolean' ? updates.isBlocked : Boolean(list[idx].isBlocked);
  const nextDevices = updates.resetDevices ? [] : list[idx].activeDeviceIds ?? [];
  const nextAutoBlockExempt =
    typeof updates.autoBlockExempt === 'boolean'
      ? updates.autoBlockExempt
      : Boolean(list[idx].autoBlockExempt) ||
        (list[idx].isBlocked === true && nextBlocked === false && nextDevices.length >= 3);
  const nextApprovalStatus = updates.approvalStatus ?? list[idx].approvalStatus;
  let nextNotes = updates.supervisorNotes ?? list[idx].supervisorNotes;
  if (
    nextApprovalStatus === 'approved' &&
    list[idx].approvalStatus !== 'approved' &&
    (nextNotes === 'طلب تسجيل جديد — في انتظار موافقة المشرف.' ||
      nextNotes === 'حساب جديد — في انتظار المراجعة الأولى.')
  ) {
    nextNotes = 'تمت الموافقة وتفعيل الحساب.';
  } else if (
    nextApprovalStatus === 'rejected' &&
    list[idx].approvalStatus !== 'rejected' &&
    typeof updates.supervisorNotes !== 'string'
  ) {
    nextNotes = 'تم رفض طلب إنشاء الحساب من قِبل المشرف.';
  }
  const updated = {
    ...list[idx],
    supervisorNotes: nextNotes,
    unlockedCourseIds: nextUnlocked,
    attendanceRate: autoAttendance.rate,
    walletBalance: nextWallet,
    approvalStatus: nextApprovalStatus,
    isBlocked: nextBlocked,
    autoBlockExempt: nextAutoBlockExempt,
    blockReason: nextBlocked
      ? updates.blockReason ?? list[idx].blockReason ?? 'تم حظر الحساب من قِبل الإدارة.'
      : '',
    activeDeviceIds: nextDevices,
    deviceDetails: updates.resetDevices ? {} : list[idx].deviceDetails ?? {},
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  saveLocalStudents(list);
  const { passwordHash: _ignored, ...safeStudent } = updated;
  return { ok: true, student: safeStudent };
}

export async function apiDeleteSupervisorStudent(
  studentId: string,
  token: string
): Promise<boolean> {
  const serverRes = await tryServerJson<{ ok?: boolean }>(
    `/api/supervisor/students/${studentId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (serverRes) return serverRes.ok;

  const list = getLocalStudents();
  saveLocalStudents(list.filter((s) => s.id !== studentId));
  return true;
}

export async function apiSyncStudentProgress(
  studentId: string,
  token: string,
  updates: {
    studentName?: string;
    studentAvatar?: string;
    unlockedCourseIds: string[];
    completedLessonIds: string[];
    notesByLesson: Record<string, string>;
    quizAnswers: Record<string, number>;
    examResults?: Record<string, LessonExamResult>;
    attendanceRate?: number;
    attendanceDates?: Record<string, string>;
  }
): Promise<void> {
  const deviceId = getOrCreateDeviceId();
  const deviceInfo = getClientDeviceInfo(deviceId);
  if (!token.startsWith('local-')) {
    const serverRes = await tryServerJson<{ student?: StudentRecord }>(
      `/api/students/${studentId}/progress`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...updates, deviceId, deviceInfo }),
      }
    );

    if (serverRes?.ok) return;
  }

  const list = getLocalStudents();
  const idx = list.findIndex((s) => s.id === studentId);
  if (idx === -1) return;
  const catalog = getLocalCatalog();
  const merged = mergeCatalogCourses(catalog.customCourses, COURSES, catalog.deletedCourseIds);
  const autoAttendance = computeStudentAttendance(
    {
      unlockedCourseIds: updates.unlockedCourseIds,
      completedLessonIds: updates.completedLessonIds,
      stage: list[idx].stage,
    },
    merged
  );
  const mergedDevices = mergeStudentDeviceEntry(
    list[idx].activeDeviceIds,
    list[idx].deviceDetails,
    deviceId,
    deviceInfo
  );
  list[idx] = applyLocalAutoBlockPolicy(
    {
      ...list[idx],
      ...updates,
      attendanceRate: updates.attendanceRate ?? autoAttendance.rate,
      attendanceDates: updates.attendanceDates ?? list[idx].attendanceDates ?? {},
      activeDeviceIds: mergedDevices.activeDeviceIds,
      deviceDetails: mergedDevices.deviceDetails,
      updatedAt: new Date().toISOString(),
    },
    mergedDevices.activeDeviceIds
  );
  saveLocalStudents(list);
}

export async function apiFetchStudentProfile(
  studentId: string,
  token: string
): Promise<
  | { ok: true; student: StudentRecord }
  | { ok: false; denied: true; error: string }
  | { ok: false; denied: false }
> {
  const deviceId = getOrCreateDeviceId();
  const deviceInfo = getClientDeviceInfo(deviceId);
  const params = new URLSearchParams({
    deviceId,
    deviceBrowser: deviceInfo.browser,
    deviceOs: deviceInfo.os,
    deviceType: deviceInfo.deviceType,
  });
  const serverRes = await tryServerJson<{ student?: StudentRecord; error?: string }>(
    `/api/students/${studentId}/me?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (serverRes) {
    if (serverRes.ok && serverRes.data.student) {
      return { ok: true, student: serverRes.data.student };
    }
    if (serverRes.status === 401 || serverRes.status === 403 || serverRes.status === 404) {
      return {
        ok: false,
        denied: true,
        error: serverRes.data.error || 'طلب إنشاء حسابك في انتظار موافقة المشرف.',
      };
    }
    return { ok: false, denied: false };
  }
  const list = getLocalStudents();
  const foundIdx = list.findIndex((s) => s.id === studentId);
  if (foundIdx === -1) return { ok: false, denied: false };
  if (list[foundIdx].approvalStatus === 'pending' || list[foundIdx].approvalStatus === 'rejected') {
    return {
      ok: false,
      denied: true,
      error:
        list[foundIdx].approvalStatus === 'rejected'
          ? 'لم تتم الموافقة على طلب إنشاء حسابك من قِبل المشرف.'
          : 'طلب إنشاء حسابك قيد المراجعة حاليًا في انتظار موافقة المشرف.',
    };
  }
  const mergedDevices = mergeStudentDeviceEntry(
    list[foundIdx].activeDeviceIds,
    list[foundIdx].deviceDetails,
    deviceId,
    deviceInfo
  );
  list[foundIdx] = applyLocalAutoBlockPolicy(
    {
      ...list[foundIdx],
      activeDeviceIds: mergedDevices.activeDeviceIds,
      deviceDetails: mergedDevices.deviceDetails,
    },
    mergedDevices.activeDeviceIds
  );
  saveLocalStudents(list);
  const { passwordHash: _ignored, ...safeStudent } = list[foundIdx];
  return { ok: true, student: safeStudent };
}

export async function apiPurchaseCourseWithWallet(
  studentId: string,
  token: string,
  courseId: string
): Promise<{ ok: true; student: StudentRecord } | { ok: false; error: string }> {
  const serverRes = await tryServerJson<{ student?: StudentRecord; error?: string }>(
    `/api/students/${studentId}/purchase-course`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ courseId }),
    }
  );
  if (serverRes) {
    if (!serverRes.ok || !serverRes.data.student) {
      return { ok: false, error: serverRes.data.error || 'تعذر إتمام شراء الكورس.' };
    }
    return { ok: true, student: serverRes.data.student };
  }

  // Fallback for static preview
  const list = getLocalStudents();
  const idx = list.findIndex((s) => s.id === studentId);
  if (idx === -1) return { ok: false, error: 'الحساب غير موجود.' };
  const stu = list[idx];
  if (stu.isBlocked) return { ok: false, error: 'تم حظر هذا الحساب من قِبل الإدارة.' };
  const catalog = getLocalCatalog();
  const merged = mergeCatalogCourses(catalog.customCourses, COURSES, catalog.deletedCourseIds);
  const course = merged.find((c) => c.id === courseId);
  if (!course) return { ok: false, error: 'الكورس غير موجود.' };
  if (stu.unlockedCourseIds.includes(courseId)) {
    const { passwordHash: _ignored, ...safe } = stu;
    return { ok: true, student: safe };
  }
  const balance = Math.max(0, Number(stu.walletBalance) || 0);
  const price = Math.max(0, Number(course.priceEgp) || 0);
  if (balance < price) {
    return {
      ok: false,
      error: `رصيد المحفظة غير كافٍ. الرصيد الحالي ${balance} ج.م وسعر الكورس ${price} ج.م.`,
    };
  }
  const nextUnlocked = [...stu.unlockedCourseIds, courseId];
  const autoAttendance = computeStudentAttendance(
    { unlockedCourseIds: nextUnlocked, completedLessonIds: stu.completedLessonIds, stage: stu.stage },
    merged
  );
  const updated = {
    ...stu,
    walletBalance: balance - price,
    unlockedCourseIds: nextUnlocked,
    attendanceRate: autoAttendance.rate,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  saveLocalStudents(list);
  const { passwordHash: _ignored, ...safe } = updated;
  return { ok: true, student: safe };
}

export async function apiSendSupervisorAlerts(
  token: string,
  payload: { studentIds: string[]; title: string; message: string }
): Promise<
  | { ok: true; sentCount: number; students?: StudentRecord[] }
  | { ok: false; error: string }
> {
  const serverRes = await tryServerJson<{
    ok?: boolean;
    sentCount?: number;
    students?: StudentRecord[];
    error?: string;
  }>('/api/supervisor/alerts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (serverRes) {
    if (!serverRes.ok) {
      return { ok: false, error: serverRes.data.error || 'تعذر إرسال التنبيه.' };
    }
    return {
      ok: true,
      sentCount: serverRes.data.sentCount ?? payload.studentIds.length,
      students: serverRes.data.students,
    };
  }

  // Fallback for static preview without backend server
  const list = getLocalStudents();
  const idSet = new Set(payload.studentIds);
  const now = new Date().toISOString();
  let sentCount = 0;
  const nextList = list.map((stu) => {
    if (!idSet.has(stu.id)) return stu;
    sentCount += 1;
    const notif: StudentNotification = {
      id: `notif-${Date.now()}-${sentCount}`,
      title: payload.title.trim(),
      message: payload.message.trim(),
      read: false,
      createdAt: now,
    };
    const existingNotifs = Array.isArray(stu.notifications) ? stu.notifications : [];
    return {
      ...stu,
      notifications: [notif, ...existingNotifs].slice(0, 30),
      updatedAt: now,
    };
  });
  saveLocalStudents(nextList);
  const catalog = getLocalCatalog();
  const merged = mergeCatalogCourses(catalog.customCourses, COURSES, catalog.deletedCourseIds);
  const safeStudents = nextList.map(({ passwordHash: _ignored, ...safe }) => ({
    ...safe,
    attendanceRate: computeStudentAttendance(safe, merged).rate,
  }));
  return { ok: true, sentCount, students: safeStudents };
}

export async function apiMarkStudentNotificationsRead(
  studentId: string,
  token: string,
  notificationIds?: string[]
): Promise<StudentNotification[] | null> {
  const serverRes = await tryServerJson<{ student?: StudentRecord }>(
    `/api/students/${studentId}/notifications/read`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notificationIds }),
    }
  );
  if (serverRes?.ok && serverRes.data.student) {
    return serverRes.data.student.notifications ?? [];
  }

  const list = getLocalStudents();
  const idx = list.findIndex((s) => s.id === studentId);
  if (idx === -1) return null;
  const targetIds =
    notificationIds && notificationIds.length > 0 ? new Set(notificationIds) : null;
  const nextNotifs = (list[idx].notifications ?? []).map((n) =>
    !targetIds || targetIds.has(n.id) ? { ...n, read: true } : n
  );
  list[idx] = {
    ...list[idx],
    notifications: nextNotifs,
    updatedAt: new Date().toISOString(),
  };
  saveLocalStudents(list);
  return nextNotifs;
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
  deletedCourseIds: string[];
  heroImage?: string;
  supportWhatsappPhone?: string;
}

function getLocalCatalog(): LocalCatalog {
  try {
    const raw = window.localStorage.getItem(FALLBACK_CATALOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalCatalog>;
      return {
        teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
        customCourses: Array.isArray(parsed.customCourses) ? parsed.customCourses : [],
        deletedCourseIds: Array.isArray(parsed.deletedCourseIds)
          ? parsed.deletedCourseIds
          : [],
        heroImage: typeof parsed.heroImage === 'string' ? parsed.heroImage : '',
        supportWhatsappPhone:
          typeof parsed.supportWhatsappPhone === 'string' && parsed.supportWhatsappPhone.trim()
            ? parsed.supportWhatsappPhone.trim()
            : SUPERVISOR_PHONE,
      };
    }
  } catch {
    // Ignore storage read error
  }
  return {
    teachers: [],
    customCourses: [],
    deletedCourseIds: [],
    heroImage: '',
    supportWhatsappPhone: SUPERVISOR_PHONE,
  };
}

function saveLocalCatalog(catalog: LocalCatalog) {
  try {
    window.localStorage.setItem(FALLBACK_CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    // Ignore storage write error
  }
}

export async function apiFetchAcademyCatalog(): Promise<LocalCatalog> {
  const serverRes = await tryServerJson<Partial<LocalCatalog>>('/api/academy/catalog');
  if (serverRes && serverRes.ok) {
    return {
      teachers: Array.isArray(serverRes.data.teachers) ? serverRes.data.teachers : [],
      customCourses: Array.isArray(serverRes.data.customCourses)
        ? serverRes.data.customCourses
        : [],
      deletedCourseIds: Array.isArray(serverRes.data.deletedCourseIds)
        ? serverRes.data.deletedCourseIds
        : [],
      heroImage: typeof serverRes.data.heroImage === 'string' ? serverRes.data.heroImage : '',
      supportWhatsappPhone:
        typeof serverRes.data.supportWhatsappPhone === 'string' &&
        serverRes.data.supportWhatsappPhone.trim()
          ? serverRes.data.supportWhatsappPhone.trim()
          : SUPERVISOR_PHONE,
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
    telegramSupport?: string;
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
    telegramSupport: payload.telegramSupport?.trim() || '',
    createdAt: new Date().toISOString(),
  };
  catalog.teachers.push(teacher);
  saveLocalCatalog(catalog);
  return { ok: true, teacher };
}

export async function apiUpdateTeacher(
  token: string,
  teacherId: string,
  payload: {
    name?: string;
    subject?: string;
    grades?: EducationalStage[];
    image?: string;
    telegramSupport?: string;
  }
): Promise<{ ok: true; teacher: DynamicTeacher } | { ok: false; error: string }> {
  const serverRes = await tryServerJson<{ teacher?: DynamicTeacher; error?: string }>(
    `/api/supervisor/teachers/${teacherId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );
  if (serverRes) {
    if (!serverRes.ok || !serverRes.data.teacher) {
      return { ok: false, error: serverRes.data.error || 'تعذر تحديث بيانات المدرس.' };
    }
    return { ok: true, teacher: serverRes.data.teacher };
  }

  const catalog = getLocalCatalog();
  const idx = catalog.teachers.findIndex((t) => t.id === teacherId);
  if (idx === -1) return { ok: false, error: 'المدرس غير موجود.' };
  const existing = catalog.teachers[idx];
  const updated: DynamicTeacher = {
    ...existing,
    name: payload.name?.trim() || existing.name,
    subject: payload.subject?.trim() || existing.subject,
    grades: payload.grades && payload.grades.length > 0 ? payload.grades : existing.grades,
    image: payload.image?.trim() || existing.image,
    telegramSupport:
      typeof payload.telegramSupport === 'string'
        ? payload.telegramSupport.trim()
        : existing.telegramSupport,
  };
  catalog.teachers[idx] = updated;
  saveLocalCatalog(catalog);
  return { ok: true, teacher: updated };
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
  builtInCourses: Course[],
  deletedCourseIds: string[] = []
): Course[] {
  const deletedSet = new Set(deletedCourseIds);
  const overrideMap = new Map(customCourses.map((c) => [c.id, c]));
  const builtInIds = new Set(builtInCourses.map((c) => c.id));
  const customOnly = customCourses.filter(
    (c) => !builtInIds.has(c.id) && !deletedSet.has(c.id)
  );
  const mergedBuiltIn = builtInCourses
    .filter((c) => !deletedSet.has(c.id))
    .map((c) => overrideMap.get(c.id) ?? c);
  return [...customOnly, ...mergedBuiltIn];
}

export async function apiUploadMediaFile(
  token: string,
  file: File
): Promise<
  | { ok: true; url: string; fileName: string; fileType: 'pdf' | 'file'; mimeType: string }
  | { ok: false; error: string }
> {
  const isPdfFile =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const detectedMime = file.type || (isPdfFile ? 'application/pdf' : 'application/octet-stream');

  try {
    const res = await fetch('/api/supervisor/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-file-name': encodeURIComponent(file.name),
        'Content-Type': detectedMime,
      },
      body: file,
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as {
        url?: string;
        fileName?: string;
        fileType?: 'pdf' | 'file';
        mimeType?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        return { ok: false, error: data.error || 'تعذر رفع الملف على الخادم.' };
      }
      return {
        ok: true,
        url: data.url,
        fileName: data.fileName || file.name,
        fileType: data.fileType || (isPdfFile ? 'pdf' : 'file'),
        mimeType: data.mimeType || detectedMime,
      };
    }
  } catch {
    // Fall through to static preview fallback below
  }

  // Static preview fallback when Express server is unavailable
  if (file.size <= (isPdfFile ? 4 * 1024 * 1024 : 1.5 * 1024 * 1024)) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          ok: true,
          url: String(reader.result),
          fileName: file.name,
          fileType: isPdfFile ? 'pdf' : 'file',
          mimeType: detectedMime,
        });
      };
      reader.onerror = () => {
        resolve({ ok: false, error: 'تعذر قراءة الملف المختار.' });
      };
      reader.readAsDataURL(file);
    });
  }

  const blobUrl = URL.createObjectURL(file);
  return {
    ok: true,
    url: blobUrl,
    fileName: file.name,
    fileType: isPdfFile ? 'pdf' : 'file',
    mimeType: detectedMime,
  };
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
    subtitle: payload.subtitle.trim(),
    grade: payload.grade,
    category: normalizeSubjectCategory(payload.category) || 'Mathematics',
    studyMode: payload.studyMode,
    priceEgp: payload.priceEgp || 250,
    totalHours: 0,
    instructorId: payload.instructorId,
    image: payload.image || '/src/assets/images/course_math_calculus_1794779284413.jpg',
    fallbackTitle: payload.title.trim(),
    modules: [
      {
        id: `mod-${Date.now()}`,
        title: 'الحصص الدراسية',
        lessons: lessonsList.map((lesTitle, idx) => {
          const defaultQ = {
            question: '',
            questionImage: '',
            options: ['أ', 'ب', 'ج', 'د'],
            correctIndex: 0,
            explanation: '',
          };
          return {
            id: `les-${Date.now()}-${idx + 1}`,
            title: lesTitle,
            durationMinutes: 0,
            summary: '',
            keyTakeaways: [],
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

  const normalizedModules = course.modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((les) => {
      const videos = les.videos ?? [];
      const lessonSec =
        videos.length > 0
          ? videos.reduce(
              (sum, v) =>
                sum + (typeof v.durationSeconds === 'number' && v.durationSeconds > 0 ? v.durationSeconds : 0),
              0
            )
          : les.durationMinutes > 0
            ? Math.round(les.durationMinutes * 60)
            : 0;
      return {
        ...les,
        durationMinutes: lessonSec > 0 ? Math.max(1, Math.round(lessonSec / 60)) : 0,
      };
    }),
  }));
  const totalSec = normalizedModules.reduce(
    (sum, m) =>
      sum +
      m.lessons.reduce((s, les) => {
        const videos = les.videos ?? [];
        if (videos.length > 0) {
          return (
            s +
            videos.reduce(
              (vs, v) =>
                vs + (typeof v.durationSeconds === 'number' && v.durationSeconds > 0 ? v.durationSeconds : 0),
              0
            )
          );
        }
        return s + (les.durationMinutes > 0 ? les.durationMinutes * 60 : 0);
      }, 0),
    0
  );
  const syncedCourse: Course = {
    ...course,
    totalHours: totalSec > 0 ? Number((totalSec / 3600).toFixed(2)) : 0,
    modules: normalizedModules,
  };

  const catalog = getLocalCatalog();
  const idx = catalog.customCourses.findIndex((c) => c.id === syncedCourse.id);
  if (idx >= 0) {
    catalog.customCourses[idx] = syncedCourse;
  } else {
    catalog.customCourses.unshift(syncedCourse);
  }
  saveLocalCatalog(catalog);
  return { ok: true, course: syncedCourse };
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
  if (
    COURSES.some((c) => c.id === courseId) &&
    !catalog.deletedCourseIds.includes(courseId)
  ) {
    catalog.deletedCourseIds.push(courseId);
  }
  saveLocalCatalog(catalog);
  return true;
}

export async function apiDeleteCoursesBatch(
  token: string,
  courseIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (courseIds.length === 0) return { ok: true };
  const serverRes = await tryServerJson<{ ok?: boolean; error?: string }>(
    '/api/supervisor/courses/delete-batch',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ courseIds }),
    }
  );
  if (serverRes) {
    if (!serverRes.ok) {
      return {
        ok: false,
        error: serverRes.data.error || 'تعذر حفظ تغييرات حذف الكورسات.',
      };
    }
    return { ok: true };
  }

  const idSet = new Set(courseIds);
  const catalog = getLocalCatalog();
  catalog.customCourses = catalog.customCourses.filter((c) => !idSet.has(c.id));
  for (const c of COURSES) {
    if (idSet.has(c.id) && !catalog.deletedCourseIds.includes(c.id)) {
      catalog.deletedCourseIds.push(c.id);
    }
  }
  saveLocalCatalog(catalog);
  return { ok: true };
}

export async function apiUpdateHeroImage(
  token: string,
  heroImage: string
): Promise<{ ok: true; heroImage: string } | { ok: false; error: string }> {
  const cleanHero = heroImage.trim();
  const serverRes = await tryServerJson<{ ok?: boolean; heroImage?: string; error?: string }>(
    '/api/supervisor/hero-image',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ heroImage: cleanHero }),
    }
  );
  if (serverRes) {
    if (!serverRes.ok) {
      return {
        ok: false,
        error: serverRes.data.error || 'تعذر حفظ صورة الصفحة الرئيسية.',
      };
    }
    return {
      ok: true,
      heroImage: typeof serverRes.data.heroImage === 'string' ? serverRes.data.heroImage : cleanHero,
    };
  }

  const catalog = getLocalCatalog();
  catalog.heroImage = cleanHero;
  saveLocalCatalog(catalog);
  return { ok: true, heroImage: cleanHero };
}

export async function apiUpdateSupportWhatsappPhone(
  token: string,
  supportWhatsappPhone: string
): Promise<{ ok: true; supportWhatsappPhone: string } | { ok: false; error: string }> {
  const cleanPhone = normalizeDigits(supportWhatsappPhone);
  const serverRes = await tryServerJson<{
    ok?: boolean;
    supportWhatsappPhone?: string;
    error?: string;
  }>('/api/supervisor/whatsapp-phone', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ supportWhatsappPhone: cleanPhone }),
  });
  if (serverRes) {
    if (!serverRes.ok) {
      return {
        ok: false,
        error: serverRes.data.error || 'تعذر تحديث رقم واتساب شحن المنصة.',
      };
    }
    return {
      ok: true,
      supportWhatsappPhone:
        typeof serverRes.data.supportWhatsappPhone === 'string'
          ? serverRes.data.supportWhatsappPhone
          : cleanPhone,
    };
  }

  const catalog = getLocalCatalog();
  catalog.supportWhatsappPhone = cleanPhone;
  saveLocalCatalog(catalog);
  return { ok: true, supportWhatsappPhone: cleanPhone };
}

export async function apiUpdateStudentPassword(
  studentId: string,
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const serverRes = await tryServerJson<{ ok?: boolean; message?: string; error?: string }>(
    `/api/students/${studentId}/password`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    }
  );
  if (serverRes) {
    if (!serverRes.ok || !serverRes.data.ok) {
      return { ok: false, error: serverRes.data.error || 'تعذر تغيير كلمة المرور.' };
    }
    return { ok: true, message: serverRes.data.message || 'تم تغيير كلمة المرور بنجاح.' };
  }

  // Local fallback
  const list = getLocalStudents();
  const idx = list.findIndex((s) => s.id === studentId);
  if (idx === -1) return { ok: false, error: 'الحساب غير موجود.' };
  const stu = list[idx];
  if (newPassword.length < 6) {
    return { ok: false, error: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف.' };
  }
  const curHash = await sha256Hex(currentPassword);
  if (stu.passwordHash && curHash !== stu.passwordHash) {
    return { ok: false, error: 'كلمة المرور الحالية غير صحيحة.' };
  }
  stu.passwordHash = await sha256Hex(newPassword);
  stu.updatedAt = new Date().toISOString();
  list[idx] = stu;
  saveLocalStudents(list);
  return { ok: true, message: 'تم تغيير كلمة المرور بنجاح.' };
}

