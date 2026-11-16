/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Lock,
  Menu,
  Moon,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sun,
  Upload,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  Course,
  COURSES,
  getCourseAllLessons,
  getCourseTotalLessons,
  getInstructorById,
  GradeStage,
  HERO_IMAGE,
  INSTRUCTORS,
  normalizeSubjectCategory,
  PLATFORM_SUBJECTS,
  PlatformSubject,
} from './data/academyData';
import {
  DynamicTeacher,
  EDUCATIONAL_STAGES,
  StudentDeviceInfo,
  StudentNotification,
  StudentRecord,
} from './types/student';
import { ResilientImage } from './components/ResilientImage';
import { ClassroomView } from './components/ClassroomView';
import { ProgressDashboard } from './components/ProgressDashboard';
import { StudentAuthModal } from './components/StudentAuthModal';
import { AdminTab, SupervisorDashboard } from './components/SupervisorDashboard';
import {
  apiFetchAcademyCatalog,
  apiFetchStudentProfile,
  apiMarkStudentNotificationsRead,
  apiPurchaseCourseWithWallet,
  apiSyncPendingStudentSession,
  apiSyncStudentProgress,
  apiUpdateHeroImage,
  apiUploadMediaFile,
  getOrCreateDeviceId,
  mergeCatalogCourses,
} from './utils/apiClient';
import { computeStudentAttendance, getTodayDateKey } from './utils/attendance';
import { getClientDeviceInfo, mergeStudentDeviceEntry } from './utils/deviceInfo';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import {
  loadFirebaseStudentByUid,
  markFirebaseNotificationsRead,
  signOutFirebase,
  syncFirebaseStudentProgress,
} from './services/firebaseStudents';

type AppView =
  | 'home'
  | 'courses'
  | 'subscriptions'
  | 'classroom'
  | 'dashboard'
  | 'supervisor';

interface SessionState {
  role: 'guest' | 'student' | 'supervisor';
  token: string;
  studentId: string | null;
  studentName: string;
  studentPhone: string;
  studentGrade: string;
  studentSpecialization: string;
  supervisorName: string;
  supervisorPhone: string;
  unlockedCourseIds: string[];
  completedLessonIds: string[];
  attendanceDates: Record<string, string>;
  notesByLesson: Record<string, string>;
  quizAnswers: Record<string, number>;
  walletBalance: number;
  autoBlockExempt: boolean;
  activeDeviceIds: string[];
  deviceDetails: Record<string, StudentDeviceInfo>;
  notifications: StudentNotification[];
}

const STORAGE_KEY = 'ezz_academy_session_v3';
const THEME_STORAGE_KEY = 'ezz_academy_theme';

const DEFAULT_SESSION: SessionState = {
  role: 'guest',
  token: '',
  studentId: null,
  studentName: 'طالب Ezz Academy',
  studentPhone: '',
  studentGrade: 'الصف الثالث الثانوي',
  studentSpecialization: 'علمي رياضة',
  supervisorName: '',
  supervisorPhone: '',
  unlockedCourseIds: [],
  completedLessonIds: [],
  attendanceDates: {},
  notesByLesson: {},
  quizAnswers: {},
  walletBalance: 0,
  autoBlockExempt: false,
  activeDeviceIds: [],
  deviceDetails: {},
  notifications: [],
};

const CATEGORIES: ('الكل' | PlatformSubject)[] = [
  'الكل',
  ...PLATFORM_SUBJECTS,
];

const GRADE_FILTERS: ('كل المراحل' | GradeStage)[] = [
  'كل المراحل',
  ...EDUCATIONAL_STAGES,
];

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [adminTab, setAdminTab] = useState<AdminTab>('students');
  const [activeCourseId, setActiveCourseId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<'كل المراحل' | GradeStage>('كل المراحل');
  const [selectedCategory, setSelectedCategory] = useState<'الكل' | PlatformSubject>('الكل');
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('الكل');
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [purchasingCourseId, setPurchasingCourseId] = useState<string | null>(null);
  const [purchaseFeedback, setPurchaseFeedback] = useState<{
    type: 'ok' | 'error';
    text: string;
  } | null>(null);
  const [blockedBanner, setBlockedBanner] = useState<string>('');
  const [dismissedAutoBlockWarning, setDismissedAutoBlockWarning] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [teachers, setTeachers] = useState<DynamicTeacher[]>([]);
  const [customCourses, setCustomCourses] = useState<Course[]>([]);
  const [deletedCourseIds, setDeletedCourseIds] = useState<string[]>([]);
  const [heroImage, setHeroImage] = useState<string>('');
  const [showHeroEditorModal, setShowHeroEditorModal] = useState<boolean>(false);
  const [heroImageDraft, setHeroImageDraft] = useState<string>('');
  const [heroUploading, setHeroUploading] = useState<boolean>(false);
  const [heroSaving, setHeroSaving] = useState<boolean>(false);
  const [heroEditorError, setHeroEditorError] = useState<string>('');
  const teachersScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
  }, [isDarkMode]);

  const [session, setSession] = useState<SessionState>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SessionState>;
        return {
          ...DEFAULT_SESSION,
          ...parsed,
          unlockedCourseIds: Array.isArray(parsed.unlockedCourseIds)
            ? parsed.unlockedCourseIds
            : DEFAULT_SESSION.unlockedCourseIds,
          completedLessonIds: Array.isArray(parsed.completedLessonIds)
            ? parsed.completedLessonIds
            : DEFAULT_SESSION.completedLessonIds,
          attendanceDates:
            parsed.attendanceDates && typeof parsed.attendanceDates === 'object'
              ? parsed.attendanceDates
              : DEFAULT_SESSION.attendanceDates,
          notesByLesson: parsed.notesByLesson ?? DEFAULT_SESSION.notesByLesson,
          quizAnswers: parsed.quizAnswers ?? DEFAULT_SESSION.quizAnswers,
          walletBalance:
            typeof parsed.walletBalance === 'number' ? parsed.walletBalance : 0,
          autoBlockExempt: parsed.autoBlockExempt === true,
          activeDeviceIds: Array.isArray(parsed.activeDeviceIds)
            ? parsed.activeDeviceIds
            : [],
          deviceDetails:
            parsed.deviceDetails && typeof parsed.deviceDetails === 'object'
              ? parsed.deviceDetails
              : {},
          notifications: Array.isArray(parsed.notifications)
            ? parsed.notifications
            : [],
        };
      }
    } catch {
      // Fallback to default session
    }
    return DEFAULT_SESSION;
  });

  const sessionRef = useRef<SessionState>(session);
  sessionRef.current = session;

  const loadCatalog = async () => {
    const catalog = await apiFetchAcademyCatalog();
    setTeachers(catalog.teachers);
    setCustomCourses(catalog.customCourses);
    setDeletedCourseIds(catalog.deletedCourseIds);
    setHeroImage(catalog.heroImage || '');
  };

  const openHeroEditor = () => {
    setHeroImageDraft(heroImage || '');
    setHeroEditorError('');
    setShowHeroEditorModal(true);
  };

  const handleHeroImageFileUpload = async (file: File | undefined) => {
    if (!file || session.role !== 'supervisor') return;
    setHeroUploading(true);
    setHeroEditorError('');
    try {
      const res = await apiUploadMediaFile(session.token, file);
      if (!res.ok) {
        setHeroEditorError(res.error);
        return;
      }
      setHeroImageDraft(res.url);
    } finally {
      setHeroUploading(false);
    }
  };

  const handleSaveHeroImage = async (overrideImage?: string) => {
    if (session.role !== 'supervisor' || heroSaving) return;
    const nextValue = typeof overrideImage === 'string' ? overrideImage : heroImageDraft;
    setHeroSaving(true);
    setHeroEditorError('');
    try {
      const res = await apiUpdateHeroImage(session.token, nextValue);
      if (!res.ok) {
        setHeroEditorError(res.error);
        return;
      }
      setHeroImage(res.heroImage);
      setShowHeroEditorModal(false);
    } finally {
      setHeroSaving(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore quota errors
    }
  }, [session]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      // Keep Firebase Auth session synchronized with client state
    });
    return () => unsubscribe();
  }, []);

  const allCourses = useMemo(
    () => mergeCatalogCourses(customCourses, COURSES, deletedCourseIds),
    [customCourses, deletedCourseIds]
  );

  const resolveInstructorInfo = (instructorId: string) => {
    const dynamic = teachers.find((t) => t.id === instructorId);
    if (dynamic) {
      return {
        name: dynamic.name,
        subject: dynamic.subject,
        image: dynamic.image,
      };
    }
    const builtIn = getInstructorById(instructorId);
    return {
      name: builtIn.name,
      subject: builtIn.specialty,
      image: builtIn.image,
    };
  };

  const resolveInstructorName = (instructorId: string): string =>
    resolveInstructorInfo(instructorId).name;

  const syncStudentProgressToServer = async (nextSession: SessionState) => {
    if (nextSession.role !== 'student' || !nextSession.studentId || !nextSession.token) {
      return;
    }
    const autoAttendance = computeStudentAttendance(
      {
        unlockedCourseIds: nextSession.unlockedCourseIds,
        completedLessonIds: nextSession.completedLessonIds,
        stage: nextSession.studentGrade,
      },
      allCourses
    );
    const payload = {
      unlockedCourseIds: nextSession.unlockedCourseIds,
      completedLessonIds: nextSession.completedLessonIds,
      notesByLesson: nextSession.notesByLesson,
      quizAnswers: nextSession.quizAnswers,
      attendanceRate: autoAttendance.rate,
      attendanceDates: nextSession.attendanceDates,
    };
    if (nextSession.token === 'firebase-google-session') {
      await syncFirebaseStudentProgress(nextSession.studentId, {
        ...payload,
        activeDeviceIds: nextSession.activeDeviceIds,
        deviceDetails: nextSession.deviceDetails,
      });
      return;
    }
    await apiSyncStudentProgress(nextSession.studentId, nextSession.token, payload);
  };

  const refreshStudentAccount = async () => {
    const cur = sessionRef.current;
    if (cur.role !== 'student' || !cur.studentId || !cur.token) return;
    const deviceId = getOrCreateDeviceId();
    const deviceInfo = getClientDeviceInfo(deviceId);

    if (cur.token === 'firebase-google-session') {
      try {
        const fresh = await loadFirebaseStudentByUid(cur.studentId);
        if (!fresh) return;
        if (fresh.isBlocked) {
          setBlockedBanner(
            fresh.blockReason || 'تم حظر هذا الحساب من قِبل الإدارة. تواصل مع الدعم الفني.'
          );
          handleLogout();
          return;
        }
        const devices = Array.isArray(fresh.activeDeviceIds) ? fresh.activeDeviceIds : [];
        const hasDetails = Boolean(fresh.deviceDetails && fresh.deviceDetails[deviceId]);
        const mergedDevices = mergeStudentDeviceEntry(
          devices,
          fresh.deviceDetails,
          deviceId,
          deviceInfo
        );
        const shouldAutoBlock =
          !fresh.autoBlockExempt && mergedDevices.activeDeviceIds.length >= 3;
        const autoBlockReason =
          'تم حظر الحساب تلقائيًا لتجاوز الحد المسموح للأجهزة (٣ أجهزة أو أكثر). تواصل مع المشرف لإيقاف الحظر.';

        if (!devices.includes(deviceId) || !hasDetails || shouldAutoBlock) {
          await syncFirebaseStudentProgress(cur.studentId, {
            unlockedCourseIds: fresh.unlockedCourseIds,
            completedLessonIds: fresh.completedLessonIds,
            notesByLesson: fresh.notesByLesson,
            quizAnswers: fresh.quizAnswers,
            attendanceRate: fresh.attendanceRate,
            attendanceDates: fresh.attendanceDates,
            activeDeviceIds: mergedDevices.activeDeviceIds,
            deviceDetails: mergedDevices.deviceDetails,
            ...(shouldAutoBlock
              ? { isBlocked: true, blockReason: autoBlockReason }
              : {}),
          });
        }
        if (shouldAutoBlock) {
          setBlockedBanner(autoBlockReason);
          handleLogout();
          return;
        }
        setSession((prev) => ({
          ...prev,
          walletBalance: fresh.walletBalance ?? 0,
          autoBlockExempt: fresh.autoBlockExempt === true,
          unlockedCourseIds: fresh.unlockedCourseIds,
          activeDeviceIds: mergedDevices.activeDeviceIds,
          deviceDetails: mergedDevices.deviceDetails,
          notifications: fresh.notifications ?? prev.notifications,
        }));
      } catch {
        // Ignore transient offline sync errors
      }
      return;
    }

    if (cur.token.startsWith('local-student-')) {
      const upgraded = await apiSyncPendingStudentSession(cur.studentId, cur.token);
      if (upgraded) {
        if (upgraded.student.isBlocked) {
          setBlockedBanner(
            upgraded.student.blockReason ||
              'تم حظر هذا الحساب من قِبل الإدارة. تواصل مع الدعم الفني.'
          );
          handleLogout();
          return;
        }
        setSession((prev) => ({
          ...prev,
          token: upgraded.token,
          walletBalance: upgraded.student.walletBalance ?? prev.walletBalance,
          autoBlockExempt: upgraded.student.autoBlockExempt === true,
          unlockedCourseIds: upgraded.student.unlockedCourseIds,
          activeDeviceIds: upgraded.student.activeDeviceIds ?? prev.activeDeviceIds,
          deviceDetails: upgraded.student.deviceDetails ?? prev.deviceDetails,
          notifications: upgraded.student.notifications ?? prev.notifications,
        }));
        return;
      }
    }

    const fresh = await apiFetchStudentProfile(cur.studentId, cur.token);
    if (!fresh) return;
    if (fresh.isBlocked) {
      setBlockedBanner(
        fresh.blockReason || 'تم حظر هذا الحساب من قِبل الإدارة. تواصل مع الدعم الفني.'
      );
      handleLogout();
      return;
    }
    setSession((prev) => ({
      ...prev,
      walletBalance: fresh.walletBalance ?? 0,
      autoBlockExempt: fresh.autoBlockExempt === true,
      unlockedCourseIds: fresh.unlockedCourseIds,
      activeDeviceIds: fresh.activeDeviceIds ?? prev.activeDeviceIds,
      deviceDetails: fresh.deviceDetails ?? prev.deviceDetails,
      notifications: fresh.notifications ?? prev.notifications,
    }));
  };

  useEffect(() => {
    if (session.role === 'student' && session.studentId) {
      void refreshStudentAccount();
      const handleFocus = () => {
        void refreshStudentAccount();
      };
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.role, session.studentId, session.token]);

  const activeCourse: Course | undefined =
    allCourses.find((c) => c.id === activeCourseId) ?? allCourses[0];

  const isStudentLoggedIn = session.role === 'student';

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allCourses.filter((course) => {
      const matchesGrade = isStudentLoggedIn
        ? course.grade === session.studentGrade
        : selectedGrade === 'كل المراحل' || course.grade === selectedGrade;
      const instructorInfo = resolveInstructorInfo(course.instructorId);
      const matchesCat =
        selectedCategory === 'الكل' ||
        normalizeSubjectCategory(course.category) === selectedCategory ||
        normalizeSubjectCategory(instructorInfo.subject) === selectedCategory;
      const matchesInstructor =
        selectedInstructorId === 'الكل' || course.instructorId === selectedInstructorId;
      const matchesQuery =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.grade.toLowerCase().includes(query) ||
        instructorInfo.name.toLowerCase().includes(query) ||
        instructorInfo.subject.toLowerCase().includes(query);
      return matchesGrade && matchesCat && matchesInstructor && matchesQuery;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allCourses,
    searchQuery,
    selectedGrade,
    selectedCategory,
    selectedInstructorId,
    isStudentLoggedIn,
    session.studentGrade,
    teachers,
  ]);

  const navigateTo = (nextView: AppView) => {
    setView(nextView);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    navigateTo('classroom');
  };

  const openTeacherCourses = (teacherId: string) => {
    setSelectedInstructorId(teacherId);
    setSelectedCategory('الكل');
    setSearchQuery('');
    navigateTo('courses');
  };

  const scrollTeachers = (direction: 'right' | 'left') => {
    const el = teachersScrollRef.current;
    if (!el) return;
    const distance = direction === 'right' ? 320 : -320;
    el.scrollBy({ left: distance, behavior: 'smooth' });
  };

  const commitStudentSessionUpdate = (
    updater: (prev: SessionState) => SessionState | null
  ) => {
    const prev = sessionRef.current;
    const next = updater(prev);
    if (!next) return;
    sessionRef.current = next;
    setSession(next);
    void syncStudentProgressToServer(next);
  };

  const handleRecordLessonAttendance = (lessonId: string, dateKey: string) => {
    const resolvedDate = dateKey || getTodayDateKey();
    commitStudentSessionUpdate((prev) => {
      if (prev.role === 'supervisor') return null;
      const alreadyCompleted = prev.completedLessonIds.includes(lessonId);
      const alreadyDated = prev.attendanceDates[lessonId] === resolvedDate;
      if (alreadyCompleted && alreadyDated) return null;
      return {
        ...prev,
        completedLessonIds: alreadyCompleted
          ? prev.completedLessonIds
          : [...prev.completedLessonIds, lessonId],
        attendanceDates: {
          ...prev.attendanceDates,
          [lessonId]: resolvedDate,
        },
      };
    });
  };

  const handleToggleLessonComplete = (lessonId: string) => {
    const todayKey = getTodayDateKey();
    commitStudentSessionUpdate((prev) => {
      const exists = prev.completedLessonIds.includes(lessonId);
      return {
        ...prev,
        completedLessonIds: exists
          ? prev.completedLessonIds.filter((id) => id !== lessonId)
          : [...prev.completedLessonIds, lessonId],
        attendanceDates: exists
          ? prev.attendanceDates
          : {
              ...prev.attendanceDates,
              [lessonId]: prev.attendanceDates[lessonId] || todayKey,
            },
      };
    });
  };

  const handleMarkLessonComplete = (lessonId: string) => {
    handleRecordLessonAttendance(lessonId, getTodayDateKey());
  };

  const handleSaveNote = (lessonId: string, note: string) => {
    commitStudentSessionUpdate((prev) => ({
      ...prev,
      notesByLesson: {
        ...prev.notesByLesson,
        [lessonId]: note,
      },
    }));
  };

  const handleRecordQuizAnswer = (lessonId: string, optionIndex: number) => {
    commitStudentSessionUpdate((prev) => ({
      ...prev,
      quizAnswers: {
        ...prev.quizAnswers,
        [lessonId]: optionIndex,
      },
    }));
  };

  const handleStudentAuthenticated = (student: StudentRecord, token: string) => {
    if (student.isBlocked) {
      setBlockedBanner(
        student.blockReason || 'تم حظر هذا الحساب من قِبل الإدارة. تواصل مع الدعم الفني.'
      );
      return;
    }
    setBlockedBanner('');
    setDismissedAutoBlockWarning(false);
    const deviceId = getOrCreateDeviceId();
    const deviceInfo = getClientDeviceInfo(deviceId);
    const existingDevices = Array.isArray(student.activeDeviceIds) ? student.activeDeviceIds : [];
    const hasDetails = Boolean(student.deviceDetails && student.deviceDetails[deviceId]);
    const mergedDevices = mergeStudentDeviceEntry(
      existingDevices,
      student.deviceDetails,
      deviceId,
      deviceInfo
    );
    const shouldAutoBlock =
      !student.autoBlockExempt && mergedDevices.activeDeviceIds.length >= 3;
    const autoBlockReason =
      'تم حظر الحساب تلقائيًا لتجاوز الحد المسموح للأجهزة (٣ أجهزة أو أكثر). تواصل مع المشرف لإيقاف الحظر.';

    if (shouldAutoBlock) {
      if (token === 'firebase-google-session') {
        void syncFirebaseStudentProgress(student.id, {
          unlockedCourseIds: student.unlockedCourseIds,
          completedLessonIds: student.completedLessonIds,
          notesByLesson: student.notesByLesson,
          quizAnswers: student.quizAnswers,
          attendanceRate: student.attendanceRate,
          attendanceDates: student.attendanceDates ?? {},
          activeDeviceIds: mergedDevices.activeDeviceIds,
          deviceDetails: mergedDevices.deviceDetails,
          isBlocked: true,
          blockReason: autoBlockReason,
        });
      }
      setBlockedBanner(autoBlockReason);
      return;
    }

    const nextSession: SessionState = {
      role: 'student',
      token,
      studentId: student.id,
      studentName: student.studentName,
      studentPhone: student.studentPhone,
      studentGrade: student.stage,
      studentSpecialization: `${student.specializationType}: ${student.specialization}`,
      supervisorName: '',
      supervisorPhone: '',
      unlockedCourseIds: student.unlockedCourseIds,
      completedLessonIds: student.completedLessonIds,
      attendanceDates: student.attendanceDates ?? {},
      notesByLesson: student.notesByLesson,
      quizAnswers: student.quizAnswers,
      walletBalance: student.walletBalance ?? 0,
      autoBlockExempt: student.autoBlockExempt === true,
      activeDeviceIds: mergedDevices.activeDeviceIds,
      deviceDetails: mergedDevices.deviceDetails,
      notifications: student.notifications ?? [],
    };
    sessionRef.current = nextSession;
    setSession(nextSession);
    if (token === 'firebase-google-session' && (!existingDevices.includes(deviceId) || !hasDetails)) {
      void syncFirebaseStudentProgress(student.id, {
        unlockedCourseIds: student.unlockedCourseIds,
        completedLessonIds: student.completedLessonIds,
        notesByLesson: student.notesByLesson,
        quizAnswers: student.quizAnswers,
        attendanceRate: student.attendanceRate,
        attendanceDates: student.attendanceDates ?? {},
        activeDeviceIds: mergedDevices.activeDeviceIds,
        deviceDetails: mergedDevices.deviceDetails,
      });
    }
    navigateTo('dashboard');
  };

  const handleSupervisorAuthenticated = (info: {
    name: string;
    phone: string;
    token: string;
  }) => {
    setBlockedBanner('');
    setSession((prev) => ({
      ...prev,
      role: 'supervisor',
      token: info.token,
      supervisorName: info.name,
      supervisorPhone: info.phone,
    }));
    setAdminTab('students');
    navigateTo('supervisor');
  };

  const handleLogout = () => {
    void signOutFirebase();
    setShowWalletModal(false);
    setShowNotificationsModal(false);
    setPurchaseFeedback(null);
    setSession(DEFAULT_SESSION);
    navigateTo('home');
  };

  const handleOpenNotificationsModal = () => {
    setShowNotificationsModal(true);
    void refreshStudentAccount();
  };

  const handleMarkNotificationsRead = async (notificationIds?: string[]) => {
    const cur = sessionRef.current;
    if (cur.role !== 'student' || !cur.studentId || !cur.token) return;
    const targetIds =
      notificationIds && notificationIds.length > 0
        ? notificationIds
        : cur.notifications.filter((n) => !n.read).map((n) => n.id);
    if (targetIds.length === 0) return;

    const targetSet = new Set(targetIds);
    setSession((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        targetSet.has(n.id) ? { ...n, read: true } : n
      ),
    }));

    if (cur.token === 'firebase-google-session') {
      await markFirebaseNotificationsRead(cur.studentId, targetIds);
      return;
    }
    await apiMarkStudentNotificationsRead(cur.studentId, cur.token, targetIds);
  };

  const handleOpenWalletModal = () => {
    setPurchaseFeedback(null);
    setShowWalletModal(true);
    void refreshStudentAccount();
  };

  const handlePurchaseCourse = async (course: Course) => {
    const cur = sessionRef.current;
    if (cur.role !== 'student' || !cur.studentId) {
      setShowAuthModal(true);
      return;
    }
    if (cur.unlockedCourseIds.includes(course.id)) return;
    setPurchaseFeedback(null);

    const price = Math.max(0, Number(course.priceEgp) || 0);
    if (cur.walletBalance < price) {
      setPurchaseFeedback({
        type: 'error',
        text: `رصيد المحفظة غير كافٍ. الرصيد الحالي ${cur.walletBalance} ج.م وسعر الكورس ${price} ج.م. تواصل مع المشرف لإضافة رصيد لمحفظتك.`,
      });
      return;
    }

    setPurchasingCourseId(course.id);
    try {
      if (cur.token === 'firebase-google-session') {
        const fresh = await loadFirebaseStudentByUid(cur.studentId);
        if (fresh?.isBlocked) {
          setBlockedBanner('تم حظر هذا الحساب من قِبل الإدارة. تواصل مع الدعم الفني.');
          handleLogout();
          return;
        }
        const liveBalance = Math.max(0, fresh?.walletBalance ?? cur.walletBalance);
        if (liveBalance < price) {
          setSession((prev) => ({ ...prev, walletBalance: liveBalance }));
          setPurchaseFeedback({
            type: 'error',
            text: `رصيد المحفظة غير كافٍ (${liveBalance} ج.م). سعر الكورس ${price} ج.م.`,
          });
          return;
        }
        const nextBalance = liveBalance - price;
        const baseUnlocked = fresh?.unlockedCourseIds ?? cur.unlockedCourseIds;
        const nextUnlocked = baseUnlocked.includes(course.id)
          ? baseUnlocked
          : [...baseUnlocked, course.id];
        const autoAttendance = computeStudentAttendance(
          {
            unlockedCourseIds: nextUnlocked,
            completedLessonIds: cur.completedLessonIds,
            stage: cur.studentGrade,
          },
          allCourses
        );
        await syncFirebaseStudentProgress(cur.studentId, {
          unlockedCourseIds: nextUnlocked,
          completedLessonIds: cur.completedLessonIds,
          notesByLesson: cur.notesByLesson,
          quizAnswers: cur.quizAnswers,
          attendanceRate: autoAttendance.rate,
          attendanceDates: cur.attendanceDates,
          walletBalance: nextBalance,
          activeDeviceIds: cur.activeDeviceIds,
          deviceDetails: cur.deviceDetails,
        });
        const nextSession: SessionState = {
          ...cur,
          walletBalance: nextBalance,
          unlockedCourseIds: nextUnlocked,
        };
        sessionRef.current = nextSession;
        setSession(nextSession);
        setPurchaseFeedback({
          type: 'ok',
          text: `تم شراء وتفعيل كورس «${course.title}» بنجاح!`,
        });
        return;
      }

      const res = await apiPurchaseCourseWithWallet(cur.studentId, cur.token, course.id);
      if (!res.ok) {
        if (res.error.includes('حظر')) {
          setBlockedBanner(res.error);
          handleLogout();
          return;
        }
        setPurchaseFeedback({ type: 'error', text: res.error });
        return;
      }

      const nextSession: SessionState = {
        ...cur,
        walletBalance: res.student.walletBalance ?? 0,
        unlockedCourseIds: res.student.unlockedCourseIds,
        completedLessonIds: res.student.completedLessonIds,
        attendanceDates: res.student.attendanceDates ?? cur.attendanceDates,
      };
      sessionRef.current = nextSession;
      setSession(nextSession);
      setPurchaseFeedback({
        type: 'ok',
        text: `تم شراء وتفعيل كورس «${course.title}» بنجاح!`,
      });
    } finally {
      setPurchasingCourseId(null);
    }
  };

  const studentFirstName = session.studentName.trim().split(/\s+/)[0] || 'الطالب';
  const headerPrimaryLabel =
    session.role === 'supervisor'
      ? 'حسابي'
      : session.role === 'student'
        ? `حسابي · ${studentFirstName}`
        : 'تسجيل الدخول';

  const handleHeaderPrimaryClick = () => {
    setMobileNavOpen(false);
    if (session.role === 'supervisor') {
      navigateTo('supervisor');
    } else if (session.role === 'student') {
      navigateTo('dashboard');
    } else {
      setShowAuthModal(true);
    }
  };

  const subscribedCourses = useMemo(() => {
    if (session.role !== 'student') return [];
    return allCourses.filter((course) =>
      session.unlockedCourseIds.includes(course.id)
    );
  }, [allCourses, session.role, session.unlockedCourseIds]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-clip max-w-full transition-colors duration-200">
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ezz Academy
          </button>

          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedInstructorId('الكل');
                navigateTo('courses');
              }}
              className={`hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'courses' ? 'text-slate-900 dark:text-white font-semibold' : ''
              }`}
            >
              الكورسات
            </button>

            <button
              type="button"
              onClick={() => navigateTo('subscriptions')}
              className={`hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-8 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'subscriptions' ? 'text-slate-900 dark:text-white font-semibold' : ''
              }`}
            >
              اشتراكاتي مع المدرسين
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsDarkMode((prev) => !prev)}
              aria-pressed={isDarkMode}
              aria-label={isDarkMode ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع المظلم'}
              title={isDarkMode ? 'الوضع النهاري' : 'الوضع المظلم للدراسة الليلية'}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 shrink-0" />
              )}
              <span className="hidden lg:inline">
                {isDarkMode ? 'الوضع النهاري' : 'الوضع المظلم'}
              </span>
            </button>

            {session.role === 'student' && (
              <>
                <button
                  type="button"
                  onClick={handleOpenNotificationsModal}
                  aria-label="التنبيهات والإشعارات"
                  title="التنبيهات والإشعارات"
                  className="relative inline-flex items-center justify-center p-2 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                  {session.notifications.filter((n) => !n.read).length > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full flex items-center justify-center tabular-nums">
                      {session.notifications.filter((n) => !n.read).length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenWalletModal}
                  aria-label="محفظة حسابي"
                  title="محفظة حسابي وشراء الكورسات"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-900 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Wallet className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                  <span className="font-mono font-bold tabular-nums">
                    {session.walletBalance} ج.م
                  </span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleHeaderPrimaryClick}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {session.role !== 'guest' && <UserCheck className="w-3.5 h-3.5 shrink-0" />}
              <span className="sm:hidden">
                {session.role === 'guest' ? 'دخول' : 'حسابي'}
              </span>
              <span className="hidden sm:inline">{headerPrimaryLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label={mobileNavOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              className="md:hidden p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                setSelectedInstructorId('الكل');
                navigateTo('courses');
              }}
              className="block w-full text-right px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              الكورسات
            </button>
            <button
              type="button"
              onClick={() => navigateTo('subscriptions')}
              className="block w-full text-right px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              اشتراكاتي مع المدرسين
            </button>
            <button
              type="button"
              onClick={handleHeaderPrimaryClick}
              className="block w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              {headerPrimaryLabel}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 min-w-0">
        {blockedBanner && (
          <div className="bg-red-50 dark:bg-red-950/70 border-b border-red-200 dark:border-red-800 px-4 py-3 text-xs sm:text-sm font-semibold text-red-800 dark:text-red-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>{blockedBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setBlockedBanner('')}
              className="p-1 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 rounded"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {session.role === 'student' &&
          !session.autoBlockExempt &&
          session.activeDeviceIds.length >= 2 &&
          !dismissedAutoBlockWarning && (
            <div
              role="alert"
              className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-300 dark:border-amber-800 px-4 py-3 text-xs sm:text-sm font-semibold text-amber-950 dark:text-amber-100 flex items-center justify-between gap-3"
            >
              <div className="flex items-start sm:items-center gap-2.5 max-w-6xl mx-auto flex-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  إنذار الحظر التلقائي: تم تسجيل دخول حسابك من{' '}
                  <span className="font-bold tabular-nums">
                    {session.activeDeviceIds.length} أجهزة
                  </span>
                  . الحد الأقصى المسموح به هو جهازان، وفي حال فتح الحساب من جهاز ثالث سيتم حظر الحساب تلقائيًا.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDismissedAutoBlockWarning(true)}
                className="p-1 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded shrink-0"
                aria-label="إغلاق إنذار الحظر التلقائي"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

        {view === 'supervisor' && session.role === 'supervisor' ? (
          <SupervisorDashboard
            supervisorName={session.supervisorName}
            supervisorPhone={session.supervisorPhone}
            token={session.token}
            initialTab={adminTab}
            teachers={teachers}
            customCourses={customCourses}
            deletedCourseIds={deletedCourseIds}
            onCatalogUpdated={loadCatalog}
            onLogout={handleLogout}
          />
        ) : view === 'classroom' && activeCourse ? (
          <ClassroomView
            course={activeCourse}
            instructorName={resolveInstructorName(activeCourse.instructorId)}
            isUnlocked={
              session.role === 'supervisor' ||
              session.unlockedCourseIds.includes(activeCourse.id)
            }
            completedLessonIds={session.completedLessonIds}
            attendanceDates={session.attendanceDates}
            notesByLesson={session.notesByLesson}
            quizAnswers={session.quizAnswers}
            studentName={session.studentName}
            onUpdateStudentName={(name) =>
              setSession((prev) => ({ ...prev, studentName: name }))
            }
            onToggleLessonComplete={handleToggleLessonComplete}
            onMarkLessonComplete={handleMarkLessonComplete}
            onRecordLessonAttendance={handleRecordLessonAttendance}
            onSaveNote={handleSaveNote}
            onRecordQuizAnswer={handleRecordQuizAnswer}
            onBackToCatalog={() => navigateTo('courses')}
            isStudent={session.role === 'student'}
            walletBalance={session.walletBalance}
            onPurchaseCourse={() => handlePurchaseCourse(activeCourse)}
            purchaseFeedback={purchaseFeedback}
          />
        ) : view === 'dashboard' ? (
          <ProgressDashboard
            studentName={session.studentName}
            studentPhone={session.studentPhone}
            studentGrade={session.studentGrade}
            studentSpecialization={session.studentSpecialization}
            courses={allCourses}
            teachers={teachers}
            unlockedCourseIds={session.unlockedCourseIds}
            onUpdateStudentName={(name) =>
              setSession((prev) => ({ ...prev, studentName: name }))
            }
            completedLessonIds={session.completedLessonIds}
            attendanceDates={session.attendanceDates}
            notesByLesson={session.notesByLesson}
            quizAnswers={session.quizAnswers}
            notifications={session.notifications}
            onMarkNotificationsRead={handleMarkNotificationsRead}
            onOpenCourse={openCourse}
            onLogout={handleLogout}
          />
        ) : view === 'subscriptions' ? (
          <section className="py-10 sm:py-14 bg-white dark:bg-slate-950 min-h-[75vh]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => navigateTo('home')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>العودة للرئيسية</span>
                  </button>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                    اشتراكاتي مع المدرسين
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    جميع الكورسات والحصص المفعلة لك مع مدرسيك في المنصة.
                  </p>
                </div>
              </div>

              {session.role === 'guest' ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-8 sm:p-12 text-center space-y-4 max-w-xl mx-auto">
                  <Lock className="w-9 h-9 text-blue-700 dark:text-blue-400 mx-auto" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    سجّل دخولك لعرض اشتراكاتك مع المدرسين
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    بعد تسجيل الدخول بحساب الطالب، ستظهر هنا جميع المواد والمدرسين المشترك معهم للوصول السريع للحصص والامتحانات.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                </div>
              ) : session.role === 'supervisor' ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-8 text-center space-y-4 max-w-xl mx-auto">
                  <BookOpen className="w-9 h-9 text-blue-700 dark:text-blue-400 mx-auto" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    أنت مسجل حاليًا بحساب الإدارة
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    يمكنك تفعيل اشتراكات الطلاب أو التحكم في الكورسات والحصص من لوحة الإدارة.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminTab('courses');
                        navigateTo('supervisor');
                      }}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
                    >
                      إدارة الكورسات والحصص
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminTab('students');
                        navigateTo('supervisor');
                      }}
                      className="px-5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      تفعيل اشتراكات الطلاب
                    </button>
                  </div>
                </div>
              ) : subscribedCourses.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-10 text-center space-y-4">
                  <BookOpen className="w-9 h-9 text-slate-400 mx-auto" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    لا توجد اشتراكات مفعلة في حسابك حتى الآن
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    تصفح كورسات {session.studentGrade} وتواصل مع الإدارة لتفعيل اشتراكاتك مع المدرسين.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateTo('courses')}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
                  >
                    استعرض الكورسات
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {subscribedCourses.map((course) => {
                    const inst = resolveInstructorInfo(course.instructorId);
                    const lessons = getCourseAllLessons(course);
                    const doneCount = lessons.filter((l) =>
                      session.completedLessonIds.includes(l.id)
                    ).length;
                    const pct =
                      lessons.length > 0
                        ? Math.round((doneCount / lessons.length) * 100)
                        : 0;

                    return (
                      <article
                        key={course.id}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 overflow-hidden">
                            <ResilientImage
                              src={course.image}
                              alt={course.title}
                              fallbackTitle={course.fallbackTitle}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="p-5 space-y-3">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
                                <ResilientImage
                                  src={inst.image}
                                  alt={inst.name}
                                  fallbackTitle={inst.name}
                                  className="w-full h-full object-cover object-top"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {inst.name}
                                </div>
                                <div className="text-xs text-blue-700 dark:text-blue-400 truncate">
                                  {inst.subject}
                                </div>
                              </div>
                            </div>

                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                              {course.title}
                            </h3>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                                <span>
                                  {doneCount} من {lessons.length} حصص
                                </span>
                                <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                                  {pct}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-700 dark:bg-blue-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="px-5 pb-5">
                          <button
                            type="button"
                            onClick={() => openCourse(course.id)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                          >
                            <BookOpen className="w-4 h-4" />
                            <span>دخول الحصص</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : view === 'courses' ? (
          <section className="py-12 lg:py-16 bg-white dark:bg-slate-950 min-h-[75vh]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => navigateTo('home')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>العودة للرئيسية</span>
                  </button>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                    {isStudentLoggedIn
                      ? `كورسات ${session.studentGrade}`
                      : selectedInstructorId === 'الكل'
                        ? 'جميع كورسات المنصة'
                        : `كورسات ${resolveInstructorName(selectedInstructorId)}`}
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {isStudentLoggedIn
                      ? `تظهر هنا الكورسات المخصصة لمرحلتك الدراسية (${session.studentGrade}) فقط.`
                      : 'اختر المرحلة الدراسية أو المدرس لتصفح الكورسات المتاحة.'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث عن كورس أو مادة..."
                      aria-label="ابحث عن كورس"
                      className="w-full sm:w-64 pr-10 pl-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>

                  {!isStudentLoggedIn && (
                    <select
                      aria-label="تصفية حسب الصف الدراسي"
                      value={selectedGrade}
                      onChange={(e) =>
                        setSelectedGrade(e.target.value as 'كل المراحل' | GradeStage)
                      }
                      className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    >
                      {GRADE_FILTERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  )}

                  <select
                    aria-label="تصفية حسب المدرس"
                    value={selectedInstructorId}
                    onChange={(e) => setSelectedInstructorId(e.target.value)}
                    className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  >
                    <option value="الكل">جميع المدرسين</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subject})
                      </option>
                    ))}
                    {INSTRUCTORS.filter((inst) =>
                      allCourses.some((c) => c.instructorId === inst.id)
                    ).map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                role="tablist"
                aria-label="تصفية الكورسات حسب المسار"
                className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-lg overflow-x-auto"
              >
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedCategory === category
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {filteredCourses.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-10 text-center space-y-3">
                  <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {allCourses.length === 0
                      ? 'لا توجد كورسات مضافة على المنصة حاليًا'
                      : 'لا توجد كورسات مضافة لهذه المرحلة حاليًا'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {allCourses.length === 0
                      ? session.role === 'supervisor'
                        ? 'يمكنك إضافة المدرسين والكورسات من لوحة المشرف لتظهر هنا فورًا للطلاب.'
                        : 'سيتم عرض الكورسات هنا فور إضافتها من قِبل إدارة المنصة.'
                      : isStudentLoggedIn
                        ? `لم يتم نشر كورسات إضافية لـ ${session.studentGrade} بهذه التصفية بعد.`
                        : 'جرّب تغيير المدرس أو المرحلة الدراسية أو إعادة تعيين الفلاتر.'}
                  </p>
                  {allCourses.length === 0 && session.role === 'supervisor' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAdminTab('courses');
                        navigateTo('supervisor');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة كورس جديد</span>
                    </button>
                  ) : allCourses.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('الكل');
                        setSelectedGrade('كل المراحل');
                        setSelectedInstructorId('الكل');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                    >
                      إعادة تعيين التصفية
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  {filteredCourses.map((course) => {
                    const inst = resolveInstructorInfo(course.instructorId);
                    const lessons = getCourseAllLessons(course);
                    const totalLessons = getCourseTotalLessons(course);
                    const doneCount = lessons.filter((l) =>
                      session.completedLessonIds.includes(l.id)
                    ).length;
                    const isUnlocked = session.unlockedCourseIds.includes(course.id);

                    return (
                      <article
                        key={course.id}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                      >
                        <div>
                          <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 overflow-hidden">
                            <ResilientImage
                              src={course.image}
                              alt={course.title}
                              fallbackTitle={course.fallbackTitle}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="p-6 space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-medium text-blue-700 dark:text-blue-400">{course.grade}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {normalizeSubjectCategory(course.category) || course.category}
                              </span>
                              {course.totalHours > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="tabular-nums">{course.totalHours} ساعة</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{totalLessons} حصص</span>
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                              {course.title}
                            </h3>
                          </div>
                        </div>

                        <div className="px-6 pb-6 pt-2 space-y-4">
                          <div className="flex items-center justify-between gap-2 text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => openTeacherCourses(course.instructorId)}
                              className="flex items-center gap-2 min-w-0 text-right hover:text-blue-700 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            >
                              <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
                                <ResilientImage
                                  src={inst.image}
                                  alt={inst.name}
                                  fallbackTitle={inst.name}
                                  className="w-full h-full object-cover object-top"
                                />
                              </div>
                              <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                                {inst.name}
                              </span>
                            </button>
                            <span className="font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                              {course.priceEgp} ج.م / الشهر
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openCourse(course.id)}
                              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                isUnlocked
                                  ? 'bg-blue-700 text-white hover:bg-blue-800'
                                  : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700'
                              }`}
                            >
                              {!isUnlocked && <Lock className="w-3.5 h-3.5" />}
                              <span>
                                {isUnlocked
                                  ? doneCount > 0
                                    ? 'متابعة الحصص'
                                    : 'دخول القاعة'
                                  : 'معاينة الحصة الأولى'}
                              </span>
                            </button>

                            {!isUnlocked && isStudentLoggedIn && (
                              <button
                                type="button"
                                disabled={purchasingCourseId === course.id}
                                onClick={() => {
                                  setPurchaseFeedback(null);
                                  setShowWalletModal(true);
                                  void handlePurchaseCourse(course);
                                }}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer disabled:opacity-60"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                <span>شراء ({course.priceEgp} ج.م)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="bg-white dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
                  <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-400">
                      منصة التعليم الثانوي المتكاملة · أونلاين
                    </div>

                    <h1
                      dir="ltr"
                      className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight w-fit"
                    >
                      Ezz <span className="text-blue-700 dark:text-blue-400">Academy</span>
                    </h1>

                    <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                      منصة متخصصة لطلاب المرحلة الثانوية والبكالوريا؛ شرح منهجي، وكورسات مخصصة لكل مرحلة دراسية.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInstructorId('الكل');
                          navigateTo('courses');
                        }}
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>
                          {isStudentLoggedIn
                            ? `كورسات ${session.studentGrade}`
                            : 'استعرض الكورسات'}
                        </span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleHeaderPrimaryClick}
                        className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>{headerPrimaryLabel}</span>
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    <div className="relative h-full min-h-[280px] lg:min-h-[380px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                      <ResilientImage
                        src={heroImage || HERO_IMAGE}
                        alt="قاعة دراسة حديثة لمنصة Ezz Academy"
                        fallbackTitle="Ezz Academy"
                        className="w-full h-full object-cover"
                      />
                      {session.role === 'supervisor' && (
                        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-end gap-2">
                          {heroImage && (
                            <button
                              type="button"
                              disabled={heroSaving}
                              onClick={() => void handleSaveHeroImage('')}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>استعادة الافتراضية</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={openHeroEditor}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700/95 hover:bg-blue-800 border border-blue-600 rounded-lg shadow-md transition-colors cursor-pointer"
                          >
                            <ImagePlus className="w-4 h-4" />
                            <span>تعديل الصورة</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="py-14 lg:py-16 bg-slate-50 dark:bg-slate-950">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                      الهيئة التدريسية في Ezz Academy
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                      تصفح المدرسين يمينًا ويسارًا واختر المدرس لعرض كورسات مرحلتك الدراسية.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {session.role === 'supervisor' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminTab('teachers');
                          navigateTo('supervisor');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة مدرس</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => scrollTeachers('right')}
                      aria-label="تمرير لليمين"
                      className="p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollTeachers('left')}
                      aria-label="تمرير لليسار"
                      className="p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {teachers.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      سيتم عرض المدرسين وموادهم الدراسية هنا فور إضافتهم.
                    </p>
                    {session.role === 'supervisor' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminTab('teachers');
                          navigateTo('supervisor');
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>أضف أول مدرس الآن</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    ref={teachersScrollRef}
                    className="flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth"
                  >
                    {teachers.map((teacher) => (
                      <article
                        key={teacher.id}
                        className="min-w-[270px] sm:min-w-[300px] max-w-[300px] shrink-0 snap-start bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                      >
                        <div>
                          <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 overflow-hidden">
                            <ResilientImage
                              src={teacher.image}
                              alt={teacher.name}
                              fallbackTitle={teacher.name}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>

                          <div className="p-5 space-y-2">
                            <div className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                              مدرس مادة: {teacher.subject}
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{teacher.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {teacher.grades.join(' · ')}
                            </p>
                          </div>
                        </div>

                        <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => openTeacherCourses(teacher.id)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            <span>
                              {isStudentLoggedIn
                                ? `كورسات ${session.studentGrade}`
                                : 'عرض الكورسات'}
                            </span>
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="font-display font-bold text-sm text-slate-900 dark:text-white">Ezz Academy</div>
          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              الرئيسية
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedInstructorId('الكل');
                navigateTo('courses');
              }}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              الكورسات
            </button>
            <button
              type="button"
              onClick={() => navigateTo('subscriptions')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              اشتراكاتي مع المدرسين
            </button>
          </div>
          <div className="tabular-nums">© 2026 Ezz Academy. جميع الحقوق محفوظة.</div>
        </div>
      </footer>

      {showAuthModal && (
        <StudentAuthModal
          onStudentAuthenticated={handleStudentAuthenticated}
          onSupervisorAuthenticated={handleSupervisorAuthenticated}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {showWalletModal && session.role === 'student' && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-3 sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-wallet-title"
        >
          <div className="min-h-full flex items-center justify-center py-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      id="student-wallet-title"
                      className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                    >
                      محفظة حسابي
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      شراء وتفعيل كورسات {session.studentGrade} من رصيد المحفظة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWalletModal(false)}
                  aria-label="إغلاق"
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">الرصيد المتاح في محفظتك</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-200 font-mono tabular-nums mt-0.5">
                    {session.walletBalance} ج.م
                  </div>
                </div>
                <div className="text-xs text-blue-800 dark:text-blue-300 max-w-[200px] leading-relaxed">
                  يتم شحن الرصيد عبر إدارة المنصة لشراء الكورسات الخاصة بك.
                </div>
              </div>

              {purchaseFeedback && (
                <div
                  className={`p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                    purchaseFeedback.type === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                  }`}
                >
                  {purchaseFeedback.type === 'ok' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  )}
                  <span>{purchaseFeedback.text}</span>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  كورسات {session.studentGrade}
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {allCourses
                    .filter((c) => c.grade === session.studentGrade)
                    .map((course) => {
                      const unlocked = session.unlockedCourseIds.includes(course.id);
                      const teacherName = resolveInstructorName(course.instructorId);
                      const busy = purchasingCourseId === course.id;
                      return (
                        <div
                          key={course.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {course.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {teacherName} ·{' '}
                              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                {course.priceEgp} ج.م
                              </span>
                            </div>
                          </div>

                          {unlocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                              <span>مُفعّل</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handlePurchaseCourse(course)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors shrink-0 cursor-pointer disabled:opacity-60"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>
                                {busy ? 'جاري الشراء...' : 'شراء وتفعيل الكورس'}
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNotificationsModal && session.role === 'student' && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-3 sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-notifications-title"
        >
          <div className="min-h-full flex items-center justify-center py-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      id="student-notifications-title"
                      className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                    >
                      التنبيهات والإشعارات
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      رسائل وتنبيهات المتابعة المرسلة لك من إدارة المنصة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotificationsModal(false)}
                  aria-label="إغلاق"
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {session.activeDeviceIds.length >= 2 && !session.autoBlockExempt && (
                <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>إنذار الحظر التلقائي — تعدد الأجهزة</span>
                  </div>
                  <p className="text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed">
                    حسابك مفتوح حاليًا على {session.activeDeviceIds.length} أجهزة. يُسمح بحد أقصى جهازين فقط، وعند محاولة الفتح من جهاز ثالث سيتم حظر الحساب تلقائيًا لحماية بياناتك واشتراكاتك.
                  </p>
                </div>
              )}

              {session.notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  لا توجد تنبيهات مرسلة لحسابك حتى الآن.
                </div>
              ) : (
                <div className="space-y-3">
                  {session.notifications.some((n) => !n.read) && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleMarkNotificationsRead()}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تحديد الكل كمقروء</span>
                      </button>
                    </div>
                  )}

                  <div className="space-y-2.5 max-h-80 overflow-y-auto">
                    {session.notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-3.5 rounded-xl border space-y-1.5 ${
                          notif.read
                            ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {notif.title}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                            {new Date(notif.createdAt).toLocaleDateString('ar-EG')}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {notif.message}
                        </p>
                        {!notif.read && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => void handleMarkNotificationsRead([notif.id])}
                              className="text-xs font-semibold text-amber-900 dark:text-amber-300 hover:underline cursor-pointer"
                            >
                              تم الاطلاع
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showHeroEditorModal && session.role === 'supervisor' && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-3 sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hero-image-editor-title"
        >
          <div className="min-h-full flex items-center justify-center py-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 shrink-0">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      id="hero-image-editor-title"
                      className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                    >
                      تعديل صورة الصفحة الرئيسية
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ارفع صورة جديدة من جهازك أو أدخل رابط الصورة ثم اضغط حفظ التغييرات.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHeroEditorModal(false)}
                  aria-label="إغلاق"
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="aspect-[16/10] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                <ResilientImage
                  src={heroImageDraft || HERO_IMAGE}
                  alt="معاينة صورة الصفحة الرئيسية"
                  fallbackTitle="Ezz Academy"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-3">
                <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  <span>
                    {heroUploading
                      ? 'جاري رفع الصورة...'
                      : 'رفع صورة من الجهاز'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={heroUploading || heroSaving}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      void handleHeroImageFileUpload(file);
                    }}
                  />
                </label>

                <div>
                  <label
                    htmlFor="hero-image-url-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    أو رابط الصورة المباشر
                  </label>
                  <input
                    id="hero-image-url-input"
                    type="text"
                    dir="ltr"
                    value={heroImageDraft}
                    onChange={(e) => setHeroImageDraft(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              </div>

              {heroEditorError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-800 dark:text-red-200">
                  {heroEditorError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                {heroImageDraft ? (
                  <button
                    type="button"
                    disabled={heroUploading || heroSaving}
                    onClick={() => setHeroImageDraft('')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة الصورة الافتراضية</span>
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={heroSaving}
                    onClick={() => setShowHeroEditorModal(false)}
                    className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={heroUploading || heroSaving}
                    onClick={() => void handleSaveHeroImage()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{heroSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
