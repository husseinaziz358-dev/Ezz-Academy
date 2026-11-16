import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  COURSES,
  normalizeSubjectCategory,
  type Course,
} from './src/data/academyData';
import { computeStudentAttendance } from './src/utils/attendance';
import type { StudentDeviceInfo } from './src/types/student';
import {
  mergeStudentDeviceEntry,
  parseUserAgentDetails,
  sanitizeDeviceInfo,
} from './src/utils/deviceInfo';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'students-db.json');
const CATALOG_FILE = path.join(DATA_DIR, 'academy-db.json');

const PORT = Number(process.env.PORT) || 3000;
const TOKEN_SECRET =
  process.env.SESSION_SECRET || 'ezz-academy-session-signing-key-2026';

// Supervisor credentials hashed with scrypt
const SUPERVISOR_PHONE = '01022193514';
const SUPERVISOR_SALT = 'ezz_sup_salt_2026';
const SUPERVISOR_PASSWORD_HASH = crypto
  .scryptSync('Husse123##', SUPERVISOR_SALT, 64)
  .toString('hex');

const STUDENT_SALT = 'ezz_student_salt_2026';

function hashStudentPassword(password: string): string {
  return crypto.scryptSync(password, STUDENT_SALT, 64).toString('hex');
}

function verifyStudentPassword(password: string, storedHash: string): boolean {
  const inputBuf = crypto.scryptSync(password, STUDENT_SALT, 64);
  const storedBuf = Buffer.from(storedHash, 'hex');
  return inputBuf.length === storedBuf.length && crypto.timingSafeEqual(inputBuf, storedBuf);
}

export interface StudentNotificationRecord {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface StudentRecord {
  id: string;
  studentName: string;
  studentPhone: string;
  parentName: string;
  parentPhone: string;
  motherName: string;
  stage: string;
  specializationType: 'شعبة' | 'مسار';
  specialization: string;
  passwordHash?: string;
  unlockedCourseIds: string[];
  completedLessonIds: string[];
  quizAnswers: Record<string, number>;
  notesByLesson: Record<string, string>;
  supervisorNotes: string;
  attendanceRate: number;
  attendanceDates?: Record<string, string>;
  walletBalance?: number;
  isBlocked?: boolean;
  autoBlockExempt?: boolean;
  blockReason?: string;
  activeDeviceIds?: string[];
  deviceDetails?: Record<string, StudentDeviceInfo>;
  notifications?: StudentNotificationRecord[];
  createdAt: string;
  updatedAt: string;
}

const AUTO_BLOCK_WARNING_TITLE = 'إنذار الحظر التلقائي — تعدد الأجهزة';
const AUTO_BLOCK_REASON =
  'تم حظر الحساب تلقائيًا لتجاوز الحد المسموح للأجهزة (٣ أجهزة أو أكثر).';

function evaluateMultiDevicePolicy(
  student: StudentRecord,
  activeDeviceIds: string[]
): {
  isBlocked: boolean;
  blockReason: string;
  notifications: StudentNotificationRecord[];
  justBlocked: boolean;
} {
  const existingNotifs = Array.isArray(student.notifications) ? student.notifications : [];
  if (student.autoBlockExempt) {
    return {
      isBlocked: Boolean(student.isBlocked),
      blockReason: student.blockReason || '',
      notifications: existingNotifs,
      justBlocked: false,
    };
  }

  if (activeDeviceIds.length >= 3) {
    const alreadyBlockedNotif = existingNotifs.some(
      (n) => n.id.startsWith('autoblk-lock-')
    );
    const nextNotifs = alreadyBlockedNotif
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
      isBlocked: true,
      blockReason: student.blockReason || AUTO_BLOCK_REASON,
      notifications: nextNotifs,
      justBlocked: !student.isBlocked,
    };
  }

  if (activeDeviceIds.length === 2) {
    const secondDeviceTag = `warn-autoblk-${activeDeviceIds[1].slice(0, 24)}`;
    const alreadyWarned = existingNotifs.some((n) => n.id.startsWith(secondDeviceTag));
    if (!alreadyWarned) {
      const warnNotif: StudentNotificationRecord = {
        id: `${secondDeviceTag}-${Date.now()}`,
        title: AUTO_BLOCK_WARNING_TITLE,
        message:
          'تم رصد فتح حسابك من جهاز ثانٍ. يُسمح بحد أقصى جهازين، وفي حالة الدخول من جهاز ثالث سيتم حظر حسابك تلقائيًا لحماية اشتراكاتك.',
        read: false,
        createdAt: new Date().toISOString(),
      };
      return {
        isBlocked: Boolean(student.isBlocked),
        blockReason: student.blockReason || '',
        notifications: [warnNotif, ...existingNotifs].slice(0, 30),
        justBlocked: false,
      };
    }
  }

  return {
    isBlocked: Boolean(student.isBlocked),
    blockReason: student.blockReason || '',
    notifications: existingNotifs,
    justBlocked: false,
  };
}

function applyStudentRequestDevice(
  student: Pick<StudentRecord, 'activeDeviceIds' | 'deviceDetails'>,
  deviceId: string,
  rawDeviceInfo: unknown,
  userAgent: string
): {
  activeDeviceIds: string[];
  deviceDetails: Record<string, StudentDeviceInfo>;
} {
  const cleanId = deviceId.trim().slice(0, 100);
  if (!cleanId) {
    return {
      activeDeviceIds: Array.isArray(student.activeDeviceIds) ? student.activeDeviceIds : [],
      deviceDetails: student.deviceDetails ?? {},
    };
  }
  const info = rawDeviceInfo
    ? sanitizeDeviceInfo(rawDeviceInfo, cleanId, userAgent)
    : parseUserAgentDetails(userAgent, cleanId);
  return mergeStudentDeviceEntry(
    student.activeDeviceIds,
    student.deviceDetails,
    cleanId,
    info
  );
}

function sanitizeStudent(student: StudentRecord): Omit<StudentRecord, 'passwordHash'> {
  const { passwordHash: _ignored, ...safe } = student;
  return safe;
}

const SEED_STUDENTS: StudentRecord[] = [];

async function ensureDb(): Promise<StudentRecord[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as StudentRecord[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Initialize with seed data if missing or invalid
  }
  await fs.writeFile(DB_FILE, JSON.stringify(SEED_STUDENTS, null, 2), 'utf-8');
  return [...SEED_STUDENTS];
}

async function saveDb(students: StudentRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(students, null, 2), 'utf-8');
}

interface DynamicTeacherRecord {
  id: string;
  name: string;
  subject: string;
  grades: string[];
  image: string;
  createdAt: string;
}

interface LessonVideoRecord {
  id: string;
  title: string;
  url: string;
  sourceType: 'link' | 'upload';
  durationSeconds?: number;
}

interface LessonAttachmentRecord {
  id: string;
  title: string;
  url: string;
  fileName?: string;
}

interface QuizQuestionRecord {
  question?: string;
  questionImage?: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface CustomCourseLessonRecord {
  id: string;
  title: string;
  durationMinutes: number;
  summary: string;
  keyTakeaways: string[];
  videos?: LessonVideoRecord[];
  attachments?: LessonAttachmentRecord[];
  examQuestions?: QuizQuestionRecord[];
  simulationKind: 'math-calculus' | 'neural-convergence' | 'web-architecture';
  quiz: QuizQuestionRecord;
}

interface CustomCourseRecord {
  id: string;
  title: string;
  subtitle: string;
  grade: string;
  category: string;
  studyMode: 'أونلاين' | 'سنتر وأونلاين';
  priceEgp: number;
  totalHours: number;
  instructorId: string;
  image: string;
  fallbackTitle: string;
  modules: {
    id: string;
    title: string;
    lessons: CustomCourseLessonRecord[];
  }[];
}

interface AcademyCatalogDb {
  teachers: DynamicTeacherRecord[];
  customCourses: CustomCourseRecord[];
  deletedCourseIds: string[];
}

async function ensureCatalogDb(): Promise<AcademyCatalogDb> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(CATALOG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AcademyCatalogDb>;
    return {
      teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
      customCourses: Array.isArray(parsed.customCourses) ? parsed.customCourses : [],
      deletedCourseIds: Array.isArray(parsed.deletedCourseIds) ? parsed.deletedCourseIds : [],
    };
  } catch {
    const empty: AcademyCatalogDb = { teachers: [], customCourses: [], deletedCourseIds: [] };
    await fs.writeFile(CATALOG_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
}

async function saveCatalogDb(catalog: AcademyCatalogDb): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CATALOG_FILE, JSON.stringify(catalog, null, 2), 'utf-8');
}

function getMergedCourses(catalog: AcademyCatalogDb): Course[] {
  const deletedSet = new Set(catalog.deletedCourseIds || []);
  const custom = catalog.customCourses as unknown as Course[];
  const overrideMap = new Map(custom.map((c) => [c.id, c]));
  const builtInIds = new Set(COURSES.map((c) => c.id));
  const customOnly = custom.filter((c) => !builtInIds.has(c.id) && !deletedSet.has(c.id));
  const mergedBuiltIn = COURSES.filter((c) => !deletedSet.has(c.id)).map(
    (c) => overrideMap.get(c.id) ?? c
  );
  return [...customOnly, ...mergedBuiltIn];
}

function signToken(payload: { role: 'supervisor' | 'student'; sub: string }): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: Date.now() }),
    'utf-8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(
  token: string
): { role: 'supervisor' | 'student'; sub: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(body)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as {
      role: 'supervisor' | 'student';
      sub: string;
    };
  } catch {
    return null;
  }
}

function normalizePhone(phone: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  let normalized = phone
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

function requireSupervisor(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'supervisor') {
    res.status(403).json({ error: 'صلاحية المشرف مطلوبة للوصول لهذه البيانات.' });
    return;
  }
  next();
}

async function startServer() {
  await ensureDb();
  await ensureCatalogDb();
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const app = express();
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Unified login endpoint: authenticates either supervisor or student seamlessly
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const phone = normalizePhone(String(req.body?.phone ?? ''));
      const password = String(req.body?.password ?? '');

      if (!phone || !password) {
        res.status(400).json({ error: 'يرجى إدخال رقم الهاتف وكلمة المرور.' });
        return;
      }

      if (phone === SUPERVISOR_PHONE) {
        const inputHash = crypto.scryptSync(password, SUPERVISOR_SALT, 64);
        const targetHash = Buffer.from(SUPERVISOR_PASSWORD_HASH, 'hex');
        const passwordMatch =
          inputHash.length === targetHash.length &&
          crypto.timingSafeEqual(inputHash, targetHash);

        if (!passwordMatch) {
          res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' });
          return;
        }

        const token = signToken({ role: 'supervisor', sub: SUPERVISOR_PHONE });
        res.json({
          role: 'supervisor',
          phone: SUPERVISOR_PHONE,
          name: 'المشرف العام — Ezz Academy',
          token,
        });
        return;
      }

      const students = await ensureDb();
      const studentIdx = students.findIndex((s) => s.studentPhone === phone);
      if (studentIdx === -1) {
        res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' });
        return;
      }

      const student = students[studentIdx];
      if (student.passwordHash && !verifyStudentPassword(password, student.passwordHash)) {
        res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' });
        return;
      }

      if (student.isBlocked) {
        res.status(403).json({
          error:
            student.blockReason ||
            'تم حظر هذا الحساب من قِبل الإدارة. تواصل مع الدعم الفني.',
        });
        return;
      }

      const deviceId = String(req.body?.deviceId ?? '').trim().slice(0, 100);
      if (deviceId) {
        const ua = String(req.headers['user-agent'] ?? '');
        const mergedDevices = applyStudentRequestDevice(
          student,
          deviceId,
          req.body?.deviceInfo,
          ua
        );
        const policy = evaluateMultiDevicePolicy(student, mergedDevices.activeDeviceIds);
        students[studentIdx] = {
          ...student,
          activeDeviceIds: mergedDevices.activeDeviceIds,
          deviceDetails: mergedDevices.deviceDetails,
          isBlocked: policy.isBlocked,
          blockReason: policy.blockReason,
          notifications: policy.notifications,
          updatedAt: new Date().toISOString(),
        };
        await saveDb(students);

        if (policy.isBlocked) {
          res.status(403).json({
            error:
              policy.blockReason ||
              'تم حظر هذا الحساب تلقائيًا لتجاوز الحد المسموح للأجهزة. تواصل مع المشرف لإيقاف الحظر.',
          });
          return;
        }
      }

      const token = signToken({ role: 'student', sub: student.id });
      res.json({
        role: 'student',
        student: sanitizeStudent(students[studentIdx]),
        token,
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'تعذر إتمام تسجيل الدخول على الخادم.' });
    }
  });

  // Register a new student account
  app.post('/api/students/register', async (req: Request, res: Response) => {
    try {
      const studentName = String(req.body?.studentName ?? '').trim();
      const studentPhone = normalizePhone(String(req.body?.studentPhone ?? ''));
      const parentName = String(req.body?.parentName ?? '').trim();
      const parentPhone = normalizePhone(String(req.body?.parentPhone ?? ''));
      const motherName = String(req.body?.motherName ?? '').trim();
      const stage = String(req.body?.stage ?? '').trim();
      const specialization = String(req.body?.specialization ?? '').trim();
      const password = String(req.body?.password ?? '');

      if (
        !studentName ||
        studentPhone.length < 8 ||
        !parentName ||
        parentPhone.length < 8 ||
        !motherName ||
        !stage ||
        !specialization ||
        password.length < 4
      ) {
        res.status(400).json({
          error: 'يرجى استيفاء جميع البيانات وكلمة مرور لا تقل عن ٤ أحرف.',
        });
        return;
      }

      if (studentPhone === SUPERVISOR_PHONE) {
        res.status(409).json({
          error: 'هذا الرقم مسجل بالفعل في النظام.',
        });
        return;
      }

      const students = await ensureDb();
      const duplicate = students.find((s) => s.studentPhone === studentPhone);
      if (duplicate) {
        res.status(409).json({
          error: 'رقم الطالب مسجل بالفعل. يمكنك تسجيل الدخول مباشرة.',
        });
        return;
      }

      const specializationType = stage === 'البكالوريا' ? 'مسار' : 'شعبة';
      const deviceId = String(req.body?.deviceId ?? '').trim().slice(0, 100);
      const ua = String(req.headers['user-agent'] ?? '');
      const mergedDevices = applyStudentRequestDevice(
        { activeDeviceIds: [], deviceDetails: {} },
        deviceId,
        req.body?.deviceInfo,
        ua
      );
      const now = new Date().toISOString();
      const newStudent: StudentRecord = {
        id: `stu-${Date.now()}`,
        studentName,
        studentPhone,
        parentName,
        parentPhone,
        motherName,
        stage,
        specializationType,
        specialization,
        passwordHash: hashStudentPassword(password),
        unlockedCourseIds: ['course-sec3-pure-applied', 'course-sec1-math'],
        completedLessonIds: [],
        quizAnswers: {},
        notesByLesson: {},
        supervisorNotes: 'حساب جديد — في انتظار المراجعة الأولى.',
        attendanceRate: 0,
        attendanceDates: {},
        walletBalance: 0,
        isBlocked: false,
        autoBlockExempt: false,
        blockReason: '',
        activeDeviceIds: mergedDevices.activeDeviceIds,
        deviceDetails: mergedDevices.deviceDetails,
        createdAt: now,
        updatedAt: now,
      };

      students.unshift(newStudent);
      await saveDb(students);

      const token = signToken({ role: 'student', sub: newStudent.id });
      res.status(201).json({ student: sanitizeStudent(newStudent), token });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'تعذر تسجيل الحساب على الخادم.' });
    }
  });

  // Sync student learning progress
  app.patch('/api/students/:id/progress', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const decoded = verifyToken(token);
      if (!decoded) {
        res.status(401).json({ error: 'غير مصرح.' });
        return;
      }
      const targetId = req.params.id;
      if (decoded.role === 'student' && decoded.sub !== targetId) {
        res.status(403).json({ error: 'لا يمكنك تعديل بيانات طالب آخر.' });
        return;
      }

      const students = await ensureDb();
      const idx = students.findIndex((s) => s.id === targetId);
      if (idx === -1) {
        res.status(404).json({ error: 'الطالب غير موجود.' });
        return;
      }

      const existing = students[idx];
      if (existing.isBlocked) {
        res.status(403).json({ error: 'تم حظر هذا الحساب من قِبل الإدارة.' });
        return;
      }
      const nextUnlocked = Array.isArray(req.body?.unlockedCourseIds)
        ? req.body.unlockedCourseIds
        : existing.unlockedCourseIds;
      const nextCompleted = Array.isArray(req.body?.completedLessonIds)
        ? req.body.completedLessonIds
        : existing.completedLessonIds;

      const catalog = await ensureCatalogDb();
      const autoAttendance = computeStudentAttendance(
        {
          unlockedCourseIds: nextUnlocked,
          completedLessonIds: nextCompleted,
          stage: existing.stage,
        },
        getMergedCourses(catalog)
      );

      const nextAttendanceDates =
        req.body?.attendanceDates && typeof req.body.attendanceDates === 'object'
          ? (req.body.attendanceDates as Record<string, string>)
          : existing.attendanceDates ?? {};

      const deviceId = String(req.body?.deviceId ?? '').trim().slice(0, 100);
      const ua = String(req.headers['user-agent'] ?? '');
      const mergedDevices = applyStudentRequestDevice(
        existing,
        deviceId,
        req.body?.deviceInfo,
        ua
      );
      const policy = evaluateMultiDevicePolicy(existing, mergedDevices.activeDeviceIds);

      const updated: StudentRecord = {
        ...existing,
        unlockedCourseIds: nextUnlocked,
        completedLessonIds: nextCompleted,
        quizAnswers:
          req.body?.quizAnswers && typeof req.body.quizAnswers === 'object'
            ? req.body.quizAnswers
            : existing.quizAnswers,
        notesByLesson:
          req.body?.notesByLesson && typeof req.body.notesByLesson === 'object'
            ? req.body.notesByLesson
            : existing.notesByLesson,
        attendanceRate: autoAttendance.rate,
        attendanceDates: nextAttendanceDates,
        activeDeviceIds: mergedDevices.activeDeviceIds,
        deviceDetails: mergedDevices.deviceDetails,
        isBlocked: policy.isBlocked,
        blockReason: policy.blockReason,
        notifications: policy.notifications,
        updatedAt: new Date().toISOString(),
      };

      students[idx] = updated;
      await saveDb(students);
      if (policy.isBlocked) {
        res.status(403).json({
          error:
            policy.blockReason ||
            'تم حظر هذا الحساب تلقائيًا لتجاوز الحد المسموح للأجهزة.',
        });
        return;
      }
      res.json({ student: sanitizeStudent(updated) });
    } catch (err) {
      console.error('Progress update error:', err);
      res.status(500).json({ error: 'تعذر حفظ التقدم.' });
    }
  });

  // Get fresh student profile (walletBalance, isBlocked, activeDeviceIds, unlockedCourseIds)
  app.get('/api/students/:id/me', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const decoded = verifyToken(token);
      if (!decoded) {
        res.status(401).json({ error: 'غير مصرح.' });
        return;
      }
      const targetId = req.params.id;
      if (decoded.role === 'student' && decoded.sub !== targetId) {
        res.status(403).json({ error: 'غير مصرح.' });
        return;
      }
      const students = await ensureDb();
      const idx = students.findIndex((s) => s.id === targetId);
      if (idx === -1) {
        res.status(404).json({ error: 'الطالب غير موجود.' });
        return;
      }
      const deviceId = String(req.query.deviceId ?? '').trim().slice(0, 100);
      if (deviceId && !students[idx].isBlocked) {
        const ua = String(req.headers['user-agent'] ?? '');
        const queryDeviceInfo =
          req.query.deviceBrowser || req.query.deviceOs || req.query.deviceType
            ? {
                id: deviceId,
                browser: String(req.query.deviceBrowser ?? ''),
                os: String(req.query.deviceOs ?? ''),
                deviceType: String(req.query.deviceType ?? ''),
                lastSeenAt: new Date().toISOString(),
              }
            : undefined;
        const mergedDevices = applyStudentRequestDevice(
          students[idx],
          deviceId,
          queryDeviceInfo,
          ua
        );
        const policy = evaluateMultiDevicePolicy(
          students[idx],
          mergedDevices.activeDeviceIds
        );
        students[idx] = {
          ...students[idx],
          activeDeviceIds: mergedDevices.activeDeviceIds,
          deviceDetails: mergedDevices.deviceDetails,
          isBlocked: policy.isBlocked,
          blockReason: policy.blockReason,
          notifications: policy.notifications,
          updatedAt: new Date().toISOString(),
        };
        await saveDb(students);
      }
      res.json({ student: sanitizeStudent(students[idx]) });
    } catch (err) {
      console.error('Fetch student me error:', err);
      res.status(500).json({ error: 'تعذر تحميل بيانات الحساب.' });
    }
  });

  // Purchase/enroll a course using student wallet balance
  app.post('/api/students/:id/purchase-course', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const decoded = verifyToken(token);
      if (!decoded) {
        res.status(401).json({ error: 'غير مصرح.' });
        return;
      }
      const targetId = req.params.id;
      if (decoded.role === 'student' && decoded.sub !== targetId) {
        res.status(403).json({ error: 'لا يمكنك تنفيذ عملية على حساب آخر.' });
        return;
      }

      const courseId = String(req.body?.courseId ?? '').trim();
      if (!courseId) {
        res.status(400).json({ error: 'معرف الكورس مطلوب.' });
        return;
      }

      const [students, catalog] = await Promise.all([ensureDb(), ensureCatalogDb()]);
      const idx = students.findIndex((s) => s.id === targetId);
      if (idx === -1) {
        res.status(404).json({ error: 'الطالب غير موجود.' });
        return;
      }
      const existing = students[idx];
      if (existing.isBlocked) {
        res.status(403).json({ error: 'تم حظر هذا الحساب من قِبل الإدارة.' });
        return;
      }

      const merged = getMergedCourses(catalog);
      const course = merged.find((c) => c.id === courseId);
      if (!course) {
        res.status(404).json({ error: 'الكورس المطلوب غير موجود.' });
        return;
      }
      if (existing.unlockedCourseIds.includes(courseId)) {
        res.json({ student: sanitizeStudent(existing), alreadyUnlocked: true });
        return;
      }

      const price = Math.max(0, Number(course.priceEgp) || 0);
      const balance = Math.max(0, Number(existing.walletBalance) || 0);
      if (balance < price) {
        res.status(400).json({
          error: `رصيد المحفظة غير كافٍ. الرصيد الحالي ${balance} ج.م وسعر الكورس ${price} ج.م.`,
        });
        return;
      }

      const nextUnlocked = [...existing.unlockedCourseIds, courseId];
      const autoAttendance = computeStudentAttendance(
        {
          unlockedCourseIds: nextUnlocked,
          completedLessonIds: existing.completedLessonIds,
          stage: existing.stage,
        },
        merged
      );

      const updated: StudentRecord = {
        ...existing,
        walletBalance: balance - price,
        unlockedCourseIds: nextUnlocked,
        attendanceRate: autoAttendance.rate,
        updatedAt: new Date().toISOString(),
      };
      students[idx] = updated;
      await saveDb(students);
      res.json({ student: sanitizeStudent(updated) });
    } catch (err) {
      console.error('Purchase course error:', err);
      res.status(500).json({ error: 'تعذر إتمام شراء الكورس من المحفظة.' });
    }
  });

  // Supervisor: list all students
  app.get('/api/supervisor/students', requireSupervisor, async (_req: Request, res: Response) => {
    try {
      const [students, catalog] = await Promise.all([ensureDb(), ensureCatalogDb()]);
      const mergedCourses = getMergedCourses(catalog);
      const computed = students.map((stu) => {
        const auto = computeStudentAttendance(stu, mergedCourses);
        return sanitizeStudent({
          ...stu,
          attendanceRate: auto.rate,
        });
      });
      res.json({ students: computed });
    } catch (err) {
      console.error('Supervisor list error:', err);
      res.status(500).json({ error: 'تعذر تحميل قائمة الطلاب.' });
    }
  });

  // Supervisor: update student block status, wallet balance, active devices, notes or unlocked courses
  app.patch(
    '/api/supervisor/students/:id',
    requireSupervisor,
    async (req: Request, res: Response) => {
      try {
        const students = await ensureDb();
        const idx = students.findIndex((s) => s.id === req.params.id);
        if (idx === -1) {
          res.status(404).json({ error: 'الطالب غير موجود.' });
          return;
        }

        const existing = students[idx];
        const nextUnlocked = Array.isArray(req.body?.unlockedCourseIds)
          ? req.body.unlockedCourseIds
          : existing.unlockedCourseIds;
        const catalog = await ensureCatalogDb();
        const autoAttendance = computeStudentAttendance(
          {
            unlockedCourseIds: nextUnlocked,
            completedLessonIds: existing.completedLessonIds,
            stage: existing.stage,
          },
          getMergedCourses(catalog)
        );

        let nextWallet = Math.max(0, Number(existing.walletBalance) || 0);
        if (typeof req.body?.walletBalance === 'number' && Number.isFinite(req.body.walletBalance)) {
          nextWallet = Math.max(0, Math.round(req.body.walletBalance));
        }
        if (typeof req.body?.addWalletAmount === 'number' && Number.isFinite(req.body.addWalletAmount)) {
          nextWallet = Math.max(0, Math.round(nextWallet + req.body.addWalletAmount));
        }

        const nextBlocked =
          typeof req.body?.isBlocked === 'boolean'
            ? req.body.isBlocked
            : Boolean(existing.isBlocked);

        const nextDevices =
          req.body?.resetDevices === true
            ? []
            : Array.isArray(req.body?.activeDeviceIds)
              ? req.body.activeDeviceIds
              : existing.activeDeviceIds ?? [];

        const nextDeviceDetails =
          req.body?.resetDevices === true
            ? {}
            : existing.deviceDetails ?? {};

        const nextAutoBlockExempt =
          typeof req.body?.autoBlockExempt === 'boolean'
            ? req.body.autoBlockExempt
            : Boolean(existing.autoBlockExempt) ||
              (existing.isBlocked === true &&
                nextBlocked === false &&
                nextDevices.length >= 3);

        const nextBlockReason = nextBlocked
          ? typeof req.body?.blockReason === 'string'
            ? req.body.blockReason
            : existing.blockReason || 'تم حظر الحساب من قِبل الإدارة.'
          : '';

        const updated: StudentRecord = {
          ...existing,
          supervisorNotes:
            typeof req.body?.supervisorNotes === 'string'
              ? req.body.supervisorNotes
              : existing.supervisorNotes,
          attendanceRate: autoAttendance.rate,
          unlockedCourseIds: nextUnlocked,
          walletBalance: nextWallet,
          isBlocked: nextBlocked,
          autoBlockExempt: nextAutoBlockExempt,
          blockReason: nextBlockReason,
          activeDeviceIds: nextDevices,
          deviceDetails: nextDeviceDetails,
          updatedAt: new Date().toISOString(),
        };

        students[idx] = updated;
        await saveDb(students);
        res.json({ student: sanitizeStudent(updated) });
      } catch (err) {
        console.error('Supervisor update error:', err);
        res.status(500).json({ error: 'تعذر تحديث بيانات الطالب.' });
      }
    }
  );

  // Supervisor: send in-platform attendance/follow-up alert to selected students
  app.post('/api/supervisor/alerts', requireSupervisor, async (req: Request, res: Response) => {
    try {
      const studentIds = Array.isArray(req.body?.studentIds)
        ? req.body.studentIds.map((id: unknown) => String(id).trim()).filter(Boolean)
        : [];
      const title = String(req.body?.title ?? '').trim().slice(0, 120);
      const message = String(req.body?.message ?? '').trim().slice(0, 500);

      if (studentIds.length === 0) {
        res.status(400).json({ error: 'يرجى تحديد طالب واحد على الأقل.' });
        return;
      }
      if (title.length < 2 || message.length < 2) {
        res.status(400).json({ error: 'يرجى إدخال عنوان ونص التنبيه.' });
        return;
      }

      const [students, catalog] = await Promise.all([ensureDb(), ensureCatalogDb()]);
      const mergedCourses = getMergedCourses(catalog);
      const idSet = new Set(studentIds);
      const now = new Date().toISOString();
      let sentCount = 0;

      const nextStudents = students.map((stu) => {
        if (!idSet.has(stu.id)) return stu;
        const notif: StudentNotificationRecord = {
          id: `notif-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          title,
          message,
          read: false,
          createdAt: now,
        };
        sentCount += 1;
        const existingNotifs = Array.isArray(stu.notifications) ? stu.notifications : [];
        return {
          ...stu,
          notifications: [notif, ...existingNotifs].slice(0, 30),
          updatedAt: now,
        };
      });

      await saveDb(nextStudents);
      const computed = nextStudents.map((stu) => {
        const auto = computeStudentAttendance(stu, mergedCourses);
        return sanitizeStudent({
          ...stu,
          attendanceRate: auto.rate,
        });
      });

      res.status(201).json({ ok: true, sentCount, students: computed });
    } catch (err) {
      console.error('Send supervisor alert error:', err);
      res.status(500).json({ error: 'تعذر إرسال التنبيه للطلاب.' });
    }
  });

  // Student: mark notifications as read
  app.patch('/api/students/:id/notifications/read', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const decoded = verifyToken(token);
      if (!decoded) {
        res.status(401).json({ error: 'غير مصرح.' });
        return;
      }
      const targetId = req.params.id;
      if (decoded.role === 'student' && decoded.sub !== targetId) {
        res.status(403).json({ error: 'غير مصرح.' });
        return;
      }

      const students = await ensureDb();
      const idx = students.findIndex((s) => s.id === targetId);
      if (idx === -1) {
        res.status(404).json({ error: 'الطالب غير موجود.' });
        return;
      }

      const targetIds = Array.isArray(req.body?.notificationIds)
        ? new Set(req.body.notificationIds.map((id: unknown) => String(id)))
        : null;

      const existingNotifs = Array.isArray(students[idx].notifications)
        ? students[idx].notifications!
        : [];
      const nextNotifs = existingNotifs.map((n) =>
        !targetIds || targetIds.size === 0 || targetIds.has(n.id)
          ? { ...n, read: true }
          : n
      );

      students[idx] = {
        ...students[idx],
        notifications: nextNotifs,
        updatedAt: new Date().toISOString(),
      };
      await saveDb(students);
      res.json({ student: sanitizeStudent(students[idx]) });
    } catch (err) {
      console.error('Mark notifications read error:', err);
      res.status(500).json({ error: 'تعذر تحديث حالة التنبيهات.' });
    }
  });

  // Parent lookup by parentPhone or studentPhone
  app.get('/api/parent/lookup', async (req: Request, res: Response) => {
    try {
      const phone = normalizePhone(String(req.query.phone ?? ''));
      if (!phone) {
        res.status(400).json({ error: 'يرجى إدخال رقم الهاتف.' });
        return;
      }
      const students = await ensureDb();
      const found = students.find(
        (s) => s.parentPhone === phone || s.studentPhone === phone
      );
      if (!found) {
        res.status(404).json({ error: 'لم يتم العثور على طالب مرتبط بهذا الرقم.' });
        return;
      }
      res.json({ student: sanitizeStudent(found) });
    } catch (err) {
      console.error('Parent lookup error:', err);
      res.status(500).json({ error: 'تعذر الاستعلام عن بيانات الطالب.' });
    }
  });

  // Public catalog of admin-added teachers and custom courses
  app.get('/api/academy/catalog', async (_req: Request, res: Response) => {
    try {
      const catalog = await ensureCatalogDb();
      res.json(catalog);
    } catch (err) {
      console.error('Catalog read error:', err);
      res.status(500).json({ error: 'تعذر تحميل بيانات المدرسين والكورسات.' });
    }
  });

  // Admin: add a teacher with photo, name, subject, and grades
  app.post('/api/supervisor/teachers', requireSupervisor, async (req: Request, res: Response) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      const subject = String(req.body?.subject ?? '').trim();
      const image = String(req.body?.image ?? '').trim();
      const grades = Array.isArray(req.body?.grades)
        ? req.body.grades.map((g: unknown) => String(g).trim()).filter(Boolean)
        : [];

      if (!name || !subject) {
        res.status(400).json({ error: 'يرجى إدخال اسم المدرس والمادة التي يدرسها.' });
        return;
      }

      const catalog = await ensureCatalogDb();
      const teacher: DynamicTeacherRecord = {
        id: `teacher-${Date.now()}`,
        name,
        subject,
        grades: grades.length > 0 ? grades : ['الصف الثالث الثانوي'],
        image: image || '/src/assets/images/hero_academy_studio_1794779037349.jpg',
        createdAt: new Date().toISOString(),
      };
      catalog.teachers.push(teacher);
      await saveCatalogDb(catalog);
      res.status(201).json({ teacher });
    } catch (err) {
      console.error('Add teacher error:', err);
      res.status(500).json({ error: 'تعذر إضافة المدرس.' });
    }
  });

  app.delete(
    '/api/supervisor/teachers/:id',
    requireSupervisor,
    async (req: Request, res: Response) => {
      try {
        const catalog = await ensureCatalogDb();
        catalog.teachers = catalog.teachers.filter((t) => t.id !== req.params.id);
        await saveCatalogDb(catalog);
        res.json({ ok: true });
      } catch (err) {
        console.error('Delete teacher error:', err);
        res.status(500).json({ error: 'تعذر حذف المدرس.' });
      }
    }
  );

  // Admin: upload a video or document file for lessons
  app.post(
    '/api/supervisor/upload',
    requireSupervisor,
    express.raw({ type: '*/*', limit: '80mb' }),
    async (req: Request, res: Response) => {
      try {
        const bodyBuf = req.body;
        if (!Buffer.isBuffer(bodyBuf) || bodyBuf.length === 0) {
          res.status(400).json({ error: 'لم يتم استلام أي ملف للرفع.' });
          return;
        }
        const headerName = String(req.headers['x-file-name'] || 'file.bin');
        let decodedName = 'file.bin';
        try {
          decodedName = decodeURIComponent(headerName);
        } catch {
          decodedName = headerName;
        }
        const extMatch = path.extname(decodedName).match(/^\.[a-zA-Z0-9]{1,8}$/);
        const safeExt = extMatch ? extMatch[0].toLowerCase() : '.bin';
        const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`;
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        await fs.writeFile(path.join(UPLOADS_DIR, uniqueName), bodyBuf);
        res.status(201).json({
          url: `/uploads/${uniqueName}`,
          fileName: decodedName,
        });
      } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'تعذر رفع الملف على الخادم.' });
      }
    }
  );

  // Admin: add a course linked to a teacher and a single educational stage/year
  app.post('/api/supervisor/courses', requireSupervisor, async (req: Request, res: Response) => {
    try {
      const title = String(req.body?.title ?? '').trim();
      const subtitle = String(req.body?.subtitle ?? '').trim();
      const grade = String(req.body?.grade ?? '').trim();
      const category = String(req.body?.category ?? '').trim() || 'محتوى المنهج';
      const instructorId = String(req.body?.instructorId ?? '').trim();
      const studyMode = req.body?.studyMode === 'أونلاين' ? 'أونلاين' : 'سنتر وأونلاين';
      const priceEgp = Number(req.body?.priceEgp) || 250;
      const image = String(req.body?.image ?? '').trim();
      const lessonTitles: string[] = Array.isArray(req.body?.lessonTitles)
        ? req.body.lessonTitles.map((l: unknown) => String(l).trim()).filter(Boolean)
        : [];
      const incomingModules = Array.isArray(req.body?.modules) ? req.body.modules : null;

      if (!title || !grade || !instructorId) {
        res.status(400).json({ error: 'يرجى إدخال اسم الكورس واختيار المرحلة الدراسية والمدرس.' });
        return;
      }

      const courseId = `course-custom-${Date.now()}`;
      const lessonsList =
        lessonTitles.length > 0
          ? lessonTitles
          : ['الحصة الأولى: شرح الأساسيات والتطبيقات'];

      const defaultQuiz = (): QuizQuestionRecord => ({
        question: '',
        questionImage: '',
        options: ['أ', 'ب', 'ج', 'د'],
        correctIndex: 0,
        explanation: '',
      });

      const resolvedModules =
        incomingModules && incomingModules.length > 0
          ? incomingModules
          : [
              {
                id: `mod-${Date.now()}`,
                title: 'الحصص الدراسية',
                lessons: lessonsList.map((lesTitle, idx) => ({
                  id: `les-${Date.now()}-${idx + 1}`,
                  title: lesTitle,
                  durationMinutes: 0,
                  summary: '',
                  keyTakeaways: [],
                  videos: [],
                  attachments: [],
                  examQuestions: [defaultQuiz()],
                  simulationKind: 'math-calculus' as const,
                  quiz: defaultQuiz(),
                })),
              },
            ];

      const totalMinutes = resolvedModules.reduce(
        (acc: number, m: { lessons?: CustomCourseLessonRecord[] }) =>
          acc +
          (Array.isArray(m.lessons)
            ? m.lessons.reduce((s, l) => s + (Number(l.durationMinutes) || 0), 0)
            : 0),
        0
      );

      const catalog = await ensureCatalogDb();
      const linkedTeacher = catalog.teachers.find((t) => t.id === instructorId);
      const resolvedCategory =
        category && category !== 'محتوى المنهج'
          ? normalizeSubjectCategory(category)
          : linkedTeacher
            ? normalizeSubjectCategory(linkedTeacher.subject)
            : 'Mathematics';

      const newCourse: CustomCourseRecord = {
        id: courseId,
        title,
        subtitle: subtitle || '',
        grade,
        category: resolvedCategory,
        studyMode,
        priceEgp,
        totalHours: totalMinutes > 0 ? Math.max(1, Math.round(totalMinutes / 60)) : 0,
        instructorId,
        image:
          image ||
          linkedTeacher?.image ||
          '/src/assets/images/course_math_calculus_1794779284413.jpg',
        fallbackTitle: title,
        modules: resolvedModules,
      };

      catalog.customCourses.unshift(newCourse);
      await saveCatalogDb(catalog);
      res.status(201).json({ course: newCourse });
    } catch (err) {
      console.error('Add course error:', err);
      res.status(500).json({ error: 'تعذر إضافة الكورس.' });
    }
  });

  // Admin: update an existing course and its vertical lessons, videos, files & exams
  app.put(
    '/api/supervisor/courses/:id',
    requireSupervisor,
    async (req: Request, res: Response) => {
      try {
        const courseId = req.params.id;
        const body = req.body as Partial<CustomCourseRecord>;
        const title = String(body?.title ?? '').trim();
        const grade = String(body?.grade ?? '').trim();
        const instructorId = String(body?.instructorId ?? '').trim();

        if (!title || !grade || !instructorId || !Array.isArray(body?.modules)) {
          res.status(400).json({ error: 'بيانات الكورس غير مكتملة.' });
          return;
        }

        const totalMinutes = body.modules.reduce(
          (acc, m) =>
            acc +
            (Array.isArray(m.lessons)
              ? m.lessons.reduce((s, l) => s + (Number(l.durationMinutes) || 0), 0)
              : 0),
          0
        );

        const catalog = await ensureCatalogDb();
        const linkedTeacher = catalog.teachers.find((t) => t.id === instructorId);
        const rawCategory = String(body.category ?? '').trim();
        const resolvedCategory =
          rawCategory && rawCategory !== 'محتوى المنهج'
            ? normalizeSubjectCategory(rawCategory)
            : linkedTeacher
              ? normalizeSubjectCategory(linkedTeacher.subject)
              : 'Mathematics';

        const updatedCourse: CustomCourseRecord = {
          id: courseId,
          title,
          subtitle: String(body.subtitle ?? '').trim(),
          grade,
          category: resolvedCategory,
          studyMode: body.studyMode === 'أونلاين' ? 'أونلاين' : 'سنتر وأونلاين',
          priceEgp: Number(body.priceEgp) || 0,
          totalHours:
            totalMinutes > 0
              ? Math.max(1, Math.round(totalMinutes / 60))
              : Number(body.totalHours) || 0,
          instructorId,
          image:
            String(body.image ?? '').trim() ||
            linkedTeacher?.image ||
            '/src/assets/images/course_math_calculus_1794779284413.jpg',
          fallbackTitle: String(body.fallbackTitle ?? '').trim() || title,
          modules: body.modules,
        };
        const existingIdx = catalog.customCourses.findIndex((c) => c.id === courseId);
        if (existingIdx >= 0) {
          catalog.customCourses[existingIdx] = updatedCourse;
        } else {
          catalog.customCourses.unshift(updatedCourse);
        }
        await saveCatalogDb(catalog);
        res.json({ course: updatedCourse });
      } catch (err) {
        console.error('Update course error:', err);
        res.status(500).json({ error: 'تعذر تحديث بيانات الكورس والحصص.' });
      }
    }
  );

  app.post(
    '/api/supervisor/courses/delete-batch',
    requireSupervisor,
    async (req: Request, res: Response) => {
      try {
        const rawIds: unknown[] = Array.isArray(req.body?.courseIds)
          ? req.body.courseIds
          : [];
        const courseIds = rawIds.map((id) => String(id).trim()).filter(Boolean);
        if (courseIds.length === 0) {
          res.status(400).json({ error: 'لم يتم تحديد أي كورس للحذف.' });
          return;
        }
        const idSet = new Set(courseIds);
        const catalog = await ensureCatalogDb();
        catalog.customCourses = catalog.customCourses.filter((c) => !idSet.has(c.id));
        for (const c of COURSES) {
          if (idSet.has(c.id) && !catalog.deletedCourseIds.includes(c.id)) {
            catalog.deletedCourseIds.push(c.id);
          }
        }
        await saveCatalogDb(catalog);
        res.json({ ok: true, deletedCount: courseIds.length });
      } catch (err) {
        console.error('Batch delete course error:', err);
        res.status(500).json({ error: 'تعذر حفظ تغييرات حذف الكورسات.' });
      }
    }
  );

  app.delete(
    '/api/supervisor/courses/:id',
    requireSupervisor,
    async (req: Request, res: Response) => {
      try {
        const targetId = req.params.id;
        const catalog = await ensureCatalogDb();
        catalog.customCourses = catalog.customCourses.filter((c) => c.id !== targetId);
        if (
          COURSES.some((c) => c.id === targetId) &&
          !catalog.deletedCourseIds.includes(targetId)
        ) {
          catalog.deletedCourseIds.push(targetId);
        }
        await saveCatalogDb(catalog);
        res.json({ ok: true });
      } catch (err) {
        console.error('Delete course error:', err);
        res.status(500).json({ error: 'تعذر حذف الكورس.' });
      }
    }
  );

  // Ensure unmatched /api/* routes always return JSON
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'المسار المطلوب غير موجود.' });
  });

  // Express JSON error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'حدث خطأ داخلي في الخادم.' });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ezz Academy server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
