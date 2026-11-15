import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'students-db.json');

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
  createdAt: string;
  updatedAt: string;
}

function sanitizeStudent(student: StudentRecord): Omit<StudentRecord, 'passwordHash'> {
  const { passwordHash: _ignored, ...safe } = student;
  return safe;
}

const SEED_STUDENTS: StudentRecord[] = [
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
    passwordHash: hashStudentPassword('123456'),
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
    passwordHash: hashStudentPassword('123456'),
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
    passwordHash: hashStudentPassword('123456'),
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
  const app = express();
  app.use(express.json());

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
      const student = students.find((s) => s.studentPhone === phone);
      if (!student) {
        res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' });
        return;
      }

      if (student.passwordHash && !verifyStudentPassword(password, student.passwordHash)) {
        res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' });
        return;
      }

      const token = signToken({ role: 'student', sub: student.id });
      res.json({
        role: 'student',
        student: sanitizeStudent(student),
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
        attendanceRate: 100,
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
      const updated: StudentRecord = {
        ...existing,
        unlockedCourseIds: Array.isArray(req.body?.unlockedCourseIds)
          ? req.body.unlockedCourseIds
          : existing.unlockedCourseIds,
        completedLessonIds: Array.isArray(req.body?.completedLessonIds)
          ? req.body.completedLessonIds
          : existing.completedLessonIds,
        quizAnswers:
          req.body?.quizAnswers && typeof req.body.quizAnswers === 'object'
            ? req.body.quizAnswers
            : existing.quizAnswers,
        notesByLesson:
          req.body?.notesByLesson && typeof req.body.notesByLesson === 'object'
            ? req.body.notesByLesson
            : existing.notesByLesson,
        updatedAt: new Date().toISOString(),
      };

      students[idx] = updated;
      await saveDb(students);
      res.json({ student: sanitizeStudent(updated) });
    } catch (err) {
      console.error('Progress update error:', err);
      res.status(500).json({ error: 'تعذر حفظ التقدم.' });
    }
  });

  // Supervisor: list all students
  app.get('/api/supervisor/students', requireSupervisor, async (_req: Request, res: Response) => {
    try {
      const students = await ensureDb();
      res.json({ students: students.map(sanitizeStudent) });
    } catch (err) {
      console.error('Supervisor list error:', err);
      res.status(500).json({ error: 'تعذر تحميل قائمة الطلاب.' });
    }
  });

  // Supervisor: update student follow-up notes, attendance, or unlocked courses
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
        const updated: StudentRecord = {
          ...existing,
          supervisorNotes:
            typeof req.body?.supervisorNotes === 'string'
              ? req.body.supervisorNotes
              : existing.supervisorNotes,
          attendanceRate:
            typeof req.body?.attendanceRate === 'number'
              ? Math.max(0, Math.min(100, req.body.attendanceRate))
              : existing.attendanceRate,
          unlockedCourseIds: Array.isArray(req.body?.unlockedCourseIds)
            ? req.body.unlockedCourseIds
            : existing.unlockedCourseIds,
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
