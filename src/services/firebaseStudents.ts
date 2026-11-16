import { signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { StudentNotification, StudentRecord } from '../types/student';
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
  contactData?: Record<string, unknown>,
  notifications: StudentNotification[] = []
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
      typeof profileData.attendanceRate === 'number' ? profileData.attendanceRate : 0,
    attendanceDates:
      profileData.attendanceDates && typeof profileData.attendanceDates === 'object'
        ? (profileData.attendanceDates as Record<string, string>)
        : {},
    walletBalance:
      typeof profileData.walletBalance === 'number' ? profileData.walletBalance : 0,
    isBlocked: profileData.isBlocked === true,
    activeDeviceIds: Array.isArray(profileData.activeDeviceIds)
      ? (profileData.activeDeviceIds as string[])
      : [],
    notifications,
    createdAt: toIsoString(profileData.createdAt),
    updatedAt: toIsoString(profileData.updatedAt),
  };
}

export async function fetchFirebaseStudentNotifications(
  uid: string
): Promise<StudentNotification[]> {
  if (!ID_PATTERN.test(uid)) return [];
  const notifPath = `students/${uid}/notifications`;
  try {
    const q = query(
      collection(db, 'students', uid, 'notifications'),
      where('studentUid', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: String(data.id ?? d.id),
          title: String(data.title ?? ''),
          message: String(data.message ?? ''),
          read: data.read === true,
          createdAt: toIsoString(data.createdAt),
        };
      })
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, notifPath);
  }
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

  let notifications: StudentNotification[] = [];
  try {
    notifications = await fetchFirebaseStudentNotifications(uid);
  } catch {
    notifications = [];
  }

  return mapFirestoreToStudentRecord(
    uid,
    profileSnap.data() as Record<string, unknown>,
    contactSnap.exists() ? (contactSnap.data() as Record<string, unknown>) : undefined,
    notifications
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
      if (existing.isBlocked) {
        await signOut(auth).catch(() => {});
        return {
          ok: false,
          error: 'تم حظر هذا الحساب من قِبل الإدارة. تواصل مع الدعم الفني.',
        };
      }
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
    attendanceRate: 0,
    attendanceDates: {},
    walletBalance: 0,
    isBlocked: false,
    activeDeviceIds: [],
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
      attendanceRate: 0,
      attendanceDates: {},
      walletBalance: 0,
      isBlocked: false,
      activeDeviceIds: [],
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
    attendanceRate: number;
    attendanceDates?: Record<string, string>;
    walletBalance?: number;
    activeDeviceIds?: string[];
  }
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !ID_PATTERN.test(uid)) {
    return;
  }
  const path = `students/${uid}`;
  const cleanAttendance = Math.max(0, Math.min(100, Math.round(updates.attendanceRate)));
  const cleanAttendanceDates: Record<string, string> = {};
  if (updates.attendanceDates && typeof updates.attendanceDates === 'object') {
    for (const [k, v] of Object.entries(updates.attendanceDates).slice(0, 200)) {
      if (typeof k === 'string' && typeof v === 'string' && k.trim() && v.trim()) {
        cleanAttendanceDates[k.slice(0, 128)] = v.trim().slice(0, 32);
      }
    }
  }
  const updatePayload: Record<string, unknown> = {
    unlockedCourseIds: updates.unlockedCourseIds.slice(0, 20),
    completedLessonIds: updates.completedLessonIds.slice(0, 200),
    notesByLesson: updates.notesByLesson,
    quizAnswers: updates.quizAnswers,
    attendanceRate: cleanAttendance,
    attendanceDates: cleanAttendanceDates,
    updatedAt: serverTimestamp(),
  };
  if (typeof updates.walletBalance === 'number' && Number.isFinite(updates.walletBalance)) {
    updatePayload.walletBalance = Math.max(0, Math.round(updates.walletBalance));
  }
  if (Array.isArray(updates.activeDeviceIds)) {
    updatePayload.activeDeviceIds = updates.activeDeviceIds
      .filter((d) => typeof d === 'string' && d.trim().length > 0)
      .slice(0, 20);
  }
  try {
    await updateDoc(doc(db, 'students', uid), updatePayload);
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
      let notifications: StudentNotification[] = [];
      try {
        notifications = await fetchFirebaseStudentNotifications(studentDoc.id);
      } catch {
        notifications = [];
      }
      return mapFirestoreToStudentRecord(
        studentDoc.id,
        studentDoc.data() as Record<string, unknown>,
        contactData,
        notifications
      );
    })
  );

  return records;
}

export async function updateFirebaseStudentBySupervisor(
  studentUid: string,
  updates: {
    supervisorNotes?: string;
    attendanceRate?: number;
    unlockedCourseIds?: string[];
    walletBalance?: number;
    isBlocked?: boolean;
    activeDeviceIds?: string[];
  }
): Promise<StudentRecord> {
  if (!ID_PATTERN.test(studentUid)) {
    throw new Error('معرف الطالب غير صالح.');
  }
  const path = `students/${studentUid}`;
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof updates.supervisorNotes === 'string') {
    updatePayload.supervisorNotes = sanitizeText(updates.supervisorNotes, MAX_NOTES_LENGTH);
  }
  if (typeof updates.attendanceRate === 'number') {
    updatePayload.attendanceRate = Math.max(0, Math.min(100, Math.round(updates.attendanceRate)));
  }
  if (Array.isArray(updates.unlockedCourseIds)) {
    updatePayload.unlockedCourseIds = updates.unlockedCourseIds.slice(0, 20);
  }
  if (typeof updates.walletBalance === 'number' && Number.isFinite(updates.walletBalance)) {
    updatePayload.walletBalance = Math.max(0, Math.min(1000000, Math.round(updates.walletBalance)));
  }
  if (typeof updates.isBlocked === 'boolean') {
    updatePayload.isBlocked = updates.isBlocked;
  }
  if (Array.isArray(updates.activeDeviceIds)) {
    updatePayload.activeDeviceIds = updates.activeDeviceIds.slice(0, 20);
  }

  try {
    await updateDoc(doc(db, 'students', studentUid), updatePayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  const refreshed = await loadFirebaseStudentByUid(studentUid);
  if (!refreshed) {
    throw new Error('تعذر قراءة ملف الطالب بعد التحديث.');
  }
  return refreshed;
}

export async function sendFirebaseStudentAlerts(
  studentUids: string[],
  payload: { title: string; message: string }
): Promise<number> {
  const cleanTitle = sanitizeText(payload.title, 120);
  const cleanMessage = sanitizeText(payload.message, 500);
  if (cleanTitle.length < 2 || cleanMessage.length < 2) {
    throw new Error('يرجى إدخال عنوان ونص التنبيه.');
  }
  const validUids = studentUids.filter((id) => ID_PATTERN.test(id));
  if (validUids.length === 0) return 0;

  const batch = writeBatch(db);
  const ts = Date.now();
  validUids.forEach((uid, idx) => {
    const notifId = `notif-${ts}-${idx}`;
    const ref = doc(db, 'students', uid, 'notifications', notifId);
    batch.set(ref, {
      id: notifId,
      studentUid: uid,
      title: cleanTitle,
      message: cleanMessage,
      read: false,
      createdAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'students/*/notifications');
  }
  return validUids.length;
}

export async function markFirebaseNotificationsRead(
  uid: string,
  notificationIds: string[]
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !ID_PATTERN.test(uid)) {
    return;
  }
  const validIds = notificationIds.filter((id) => ID_PATTERN.test(id));
  if (validIds.length === 0) return;

  const batch = writeBatch(db);
  for (const notifId of validIds.slice(0, 50)) {
    batch.update(doc(db, 'students', uid, 'notifications', notifId), {
      read: true,
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `students/${uid}/notifications`);
  }
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
