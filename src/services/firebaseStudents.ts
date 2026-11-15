import { signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { StudentRecord } from '../types/student';
import { normalizeDigits } from '../utils/apiClient';

const ADMIN_EMAIL = 'fatmasoltan1972@gmail.com';

const MAX_NAME_LENGTH = 120;
const MIN_PHONE_LENGTH = 8;
const MAX_PHONE_LENGTH = 20;
const MAX_NOTES_LENGTH = 1000;
const MAX_EMAIL_LENGTH = 160;
const PHONE_PATTERN = /^[0-9+]+$/;
const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function sanitizeText(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

function sanitizePhone(val: string): string {
  const normalized = normalizeDigits(val).replace(/[^0-9+]/g, '');
  return normalized.slice(0, MAX_PHONE_LENGTH);
}

function mapFirestoreToStudentRecord(
  uid: string,
  profileData: Record<string, unknown>,
  contactData?: Record<string, unknown>
): StudentRecord {
  return {
    id: uid,
    studentName: String(profileData.studentName ?? ''),
    studentPhone: String(contactData?.studentPhone ?? ''),
    parentName: String(contactData?.parentName ?? ''),
    parentPhone: String(contactData?.parentPhone ?? ''),
    motherName: String(contactData?.motherName ?? ''),
    stage: String(profileData.stage ?? 'الصف الثالث الثانوي'),
    specializationType:
      profileData.specializationType === 'مسار' ? 'مسار' : 'شعبة',
    specialization: String(profileData.specialization ?? ''),
    unlockedCourseIds: Array.isArray(profileData.unlockedCourseIds)
      ? (profileData.unlockedCourseIds as string[])
      : ['course-sec3-pure-applied', 'course-sec1-math'],
    completedLessonIds: Array.isArray(profileData.completedLessonIds)
      ? (profileData.completedLessonIds as string[])
      : [],
    quizAnswers:
      profileData.quizAnswers && typeof profileData.quizAnswers === 'object'
        ? (profileData.quizAnswers as Record<string, number>)
        : {},
    notesByLesson:
      profileData.notesByLesson && typeof profileData.notesByLesson === 'object'
        ? (profileData.notesByLesson as Record<string, string>)
        : {},
    supervisorNotes: String(profileData.supervisorNotes ?? ''),
    attendanceRate:
      typeof profileData.attendanceRate === 'number' ? profileData.attendanceRate : 100,
    createdAt: toIsoString(profileData.createdAt),
    updatedAt: toIsoString(profileData.updatedAt),
  };
}

export async function loadFirebaseStudentByUid(uid: string): Promise<StudentRecord | null> {
  if (!ID_PATTERN.test(uid)) return null;
  const profilePath = `students/${uid}`;
  let profileSnap;
  try {
    profileSnap = await getDoc(doc(db, 'students', uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, profilePath);
  }
  if (!profileSnap.exists()) return null;

  const contactPath = `students/${uid}/private/contact`;
  let contactSnap;
  try {
    contactSnap = await getDoc(doc(db, 'students', uid, 'private', 'contact'));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, contactPath);
  }

  return mapFirestoreToStudentRecord(
    uid,
    profileSnap.data() as Record<string, unknown>,
    contactSnap.exists() ? (contactSnap.data() as Record<string, unknown>) : undefined
  );
}

export async function signInWithGooglePopup(): Promise<
  | {
      ok: true;
      role: 'supervisor';
      name: string;
      phone: string;
      email: string;
      token: string;
    }
  | {
      ok: true;
      role: 'student';
      needsProfile: false;
      student: StudentRecord;
      token: string;
    }
  | {
      ok: true;
      role: 'student';
      needsProfile: true;
      uid: string;
      email: string;
      displayName: string;
    }
  | { ok: false; error: string }
> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;
    if (!user.emailVerified) {
      return {
        ok: false,
        error: 'يرجى استخدام حساب Google موثّق البريد الإلكتروني.',
      };
    }

    if (user.email?.toLowerCase() === ADMIN_EMAIL) {
      return {
        ok: true,
        role: 'supervisor',
        name: user.displayName || 'المشرف العام — Ezz Academy',
        phone: '01022193514',
        email: user.email,
        token: 'firebase-google-session',
      };
    }

    const existing = await loadFirebaseStudentByUid(user.uid);
    if (existing) {
      return {
        ok: true,
        role: 'student',
        needsProfile: false,
        student: existing,
        token: 'firebase-google-session',
      };
    }

    return {
      ok: true,
      role: 'student',
      needsProfile: true,
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('popup-closed-by-user') || msg.includes('cancelled-popup-request')) {
      return { ok: false, error: 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.' };
    }
    if (msg.includes('popup-blocked')) {
      return {
        ok: false,
        error: 'المتصفح حظر نافذة تسجيل الدخول. يرجى السماح بالنوافذ المنبثقة ثم المحاولة مجددًا.',
      };
    }
    return {
      ok: false,
      error: 'تعذر إتمام تسجيل الدخول عبر Google. تأكد من الاتصال وحاول مجددًا.',
    };
  }
}

export async function createFirebaseStudentProfile(
  uid: string,
  email: string,
  payload: {
    studentName: string;
    studentPhone: string;
    parentName: string;
    parentPhone: string;
    motherName: string;
    stage: string;
    specialization: string;
  }
): Promise<{ ok: true; student: StudentRecord; token: string } | { ok: false; error: string }> {
  if (!ID_PATTERN.test(uid)) {
    return { ok: false, error: 'معرف الحساب غير صالح.' };
  }

  const studentName = sanitizeText(payload.studentName, MAX_NAME_LENGTH);
  const studentPhone = sanitizePhone(payload.studentPhone);
  const parentName = sanitizeText(payload.parentName, MAX_NAME_LENGTH);
  const parentPhone = sanitizePhone(payload.parentPhone);
  const motherName = sanitizeText(payload.motherName, MAX_NAME_LENGTH);
  const stage = sanitizeText(payload.stage, MAX_NAME_LENGTH);
  const specialization = sanitizeText(payload.specialization, MAX_NAME_LENGTH);
  const specializationType = stage === 'البكالوريا' ? 'مسار' : 'شعبة';

  if (
    studentName.length < 2 ||
    parentName.length < 2 ||
    motherName.length < 2 ||
    studentPhone.length < MIN_PHONE_LENGTH ||
    parentPhone.length < MIN_PHONE_LENGTH ||
    !PHONE_PATTERN.test(studentPhone) ||
    !PHONE_PATTERN.test(parentPhone)
  ) {
    return {
      ok: false,
      error: 'يرجى إدخال جميع الأسماء وأرقام الهواتف بشكل صحيح (٨ أرقام على الأقل).',
    };
  }

  const unlockedCourseIds = ['course-sec3-pure-applied', 'course-sec1-math'];
  const supervisorNotes = 'حساب جديد — في انتظار المراجعة الأولى.';
  const batch = writeBatch(db);

  batch.set(doc(db, 'students', uid), {
    uid,
    studentName,
    stage,
    specializationType,
    specialization,
    unlockedCourseIds,
    completedLessonIds: [],
    quizAnswers: {},
    notesByLesson: {},
    supervisorNotes,
    attendanceRate: 100,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const contactDoc: Record<string, unknown> = {
    uid,
    studentPhone,
    parentName,
    parentPhone,
    motherName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (email.trim()) {
    contactDoc.email = email.trim().slice(0, MAX_EMAIL_LENGTH);
  }
  batch.set(doc(db, 'students', uid, 'private', 'contact'), contactDoc);

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `students/${uid}`);
  }

  const now = new Date().toISOString();
  return {
    ok: true,
    token: 'firebase-google-session',
    student: {
      id: uid,
      studentName,
      studentPhone,
      parentName,
      parentPhone,
      motherName,
      stage,
      specializationType,
      specialization,
      unlockedCourseIds,
      completedLessonIds: [],
      quizAnswers: {},
      notesByLesson: {},
      supervisorNotes,
      attendanceRate: 100,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export async function syncFirebaseStudentProgress(
  uid: string,
  updates: {
    unlockedCourseIds: string[];
    completedLessonIds: string[];
    notesByLesson: Record<string, string>;
    quizAnswers: Record<string, number>;
  }
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !ID_PATTERN.test(uid)) {
    return;
  }
  const path = `students/${uid}`;
  try {
    await updateDoc(doc(db, 'students', uid), {
      unlockedCourseIds: updates.unlockedCourseIds.slice(0, 20),
      completedLessonIds: updates.completedLessonIds.slice(0, 200),
      notesByLesson: updates.notesByLesson,
      quizAnswers: updates.quizAnswers,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchAllFirebaseStudents(): Promise<StudentRecord[]> {
  const path = 'students';
  let snapshot;
  try {
    snapshot = await getDocs(collection(db, path));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }

  const records = await Promise.all(
    snapshot.docs.map(async (studentDoc) => {
      const contactPath = `students/${studentDoc.id}/private/contact`;
      let contactData: Record<string, unknown> | undefined;
      try {
        const contactSnap = await getDoc(
          doc(db, 'students', studentDoc.id, 'private', 'contact')
        );
        if (contactSnap.exists()) {
          contactData = contactSnap.data() as Record<string, unknown>;
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, contactPath);
      }
      return mapFirestoreToStudentRecord(
        studentDoc.id,
        studentDoc.data() as Record<string, unknown>,
        contactData
      );
    })
  );

  return records;
}

export async function updateFirebaseStudentBySupervisor(
  studentUid: string,
  updates: {
    supervisorNotes: string;
    attendanceRate: number;
    unlockedCourseIds: string[];
  }
): Promise<StudentRecord> {
  if (!ID_PATTERN.test(studentUid)) {
    throw new Error('معرف الطالب غير صالح.');
  }
  const path = `students/${studentUid}`;
  const cleanNotes = sanitizeText(updates.supervisorNotes, MAX_NOTES_LENGTH);
  const cleanAttendance = Math.max(0, Math.min(100, Math.round(updates.attendanceRate)));
  const cleanCourses = updates.unlockedCourseIds.slice(0, 20);

  try {
    await updateDoc(doc(db, 'students', studentUid), {
      supervisorNotes: cleanNotes,
      attendanceRate: cleanAttendance,
      unlockedCourseIds: cleanCourses,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  const refreshed = await loadFirebaseStudentByUid(studentUid);
  if (!refreshed) {
    throw new Error('تعذر قراءة ملف الطالب بعد التحديث.');
  }
  return refreshed;
}

export async function signOutFirebase(): Promise<void> {
  try {
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch {
    // Ignore sign-out errors
  }
}
