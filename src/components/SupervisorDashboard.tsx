import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Ban,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FilePlus2,
  FileText,
  Film,
  Globe,
  GraduationCap,
  HelpCircle,
  ImagePlus,
  Laptop,
  Link2,
  LogOut,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
  UserCheck,
  Users,
  UserX,
  Video,
  Wallet,
  X,
} from 'lucide-react';
import {
  Course,
  COURSES,
  formatArabicDurationFromSeconds,
  getCourseAllLessons,
  getCourseEffectiveSeconds,
  getLessonEffectiveSeconds,
  INSTRUCTORS,
  Lesson,
  LessonAttachment,
  LessonVideo,
  normalizeSubjectCategory,
  PLATFORM_SUBJECTS,
  QuizQuestion,
} from '../data/academyData';
import {
  DynamicTeacher,
  EDUCATIONAL_STAGES,
  EducationalStage,
  StudentApprovalStatus,
  StudentRecord,
} from '../types/student';
import {
  apiAddCourse,
  apiAddTeacher,
  apiDeleteCoursesBatch,
  apiDeleteSupervisorStudent,
  apiDeleteTeacher,
  apiFetchSupervisorStudents,
  apiSendSupervisorAlerts,
  apiUpdateCourse,
  apiUpdateSupervisorStudent,
  apiUpdateSupportWhatsappPhone,
  apiUpdateTeacher,
  apiUploadMediaFile,
  formatTelegramUrl,
  formatWhatsappUrl,
  mergeCatalogCourses,
  normalizeDigits,
} from '../utils/apiClient';
import {
  computeStudentAttendance,
  formatAttendanceDateArabic,
  getDistinctAttendanceDays,
} from '../utils/attendance';
import {
  deleteFirebaseStudent,
  fetchAllFirebaseStudents,
  sendFirebaseStudentAlerts,
  updateFirebaseStudentBySupervisor,
} from '../services/firebaseStudents';
import { getStudentDevicesDisplay, NormalizedDeviceDisplay } from '../utils/deviceInfo';
import { ResilientImage } from './ResilientImage';
import {
  extractCleanVideoUrl,
  isExternalEmbedPlatformUrl,
  isPdfAttachment,
  normalizeExternalUrl,
  parseYouTubeVideo,
  readYouTubeDurationSeconds,
  resolvePdfAttachment,
} from '../utils/mediaHelpers';

export type AdminTab = 'students' | 'approvals' | 'low-attendance' | 'teachers' | 'courses';

interface SupervisorDashboardProps {
  supervisorName: string;
  supervisorPhone: string;
  token: string;
  initialTab?: AdminTab;
  teachers: DynamicTeacher[];
  customCourses: Course[];
  deletedCourseIds?: string[];
  supportWhatsappPhone?: string;
  onCatalogUpdated: () => Promise<void> | void;
  onLogout: () => void;
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 640;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('تعذر تحميل الملف.'));
    reader.readAsDataURL(file);
  });
}

function readVideoDurationSeconds(src: string | File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const isFile = src instanceof File;
    const objectUrl = isFile ? URL.createObjectURL(src) : src;
    let settled = false;

    const finish = (seconds: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (isFile) {
        URL.revokeObjectURL(objectUrl);
      }
      video.removeAttribute('src');
      video.load();
      resolve(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0);
    };

    const timer = window.setTimeout(() => finish(0), 3500);
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(0);
    video.src = objectUrl;
  });
}

function calcLessonDurationMinutes(videos: LessonVideo[]): number {
  const totalSeconds = videos.reduce(
    (sum, v) =>
      sum + (typeof v.durationSeconds === 'number' && v.durationSeconds > 0 ? v.durationSeconds : 0),
    0
  );
  return totalSeconds > 0 ? Math.max(1, Math.round(totalSeconds / 60)) : 0;
}

function createEmptyQuizQuestion(): QuizQuestion {
  return {
    question: '',
    questionImage: '',
    options: ['أ', 'ب', 'ج', 'د'],
    correctIndex: 0,
    explanation: '',
  };
}

function normalizeLessonForEditor(lesson: Lesson): Lesson {
  const examQuestions =
    lesson.examQuestions && lesson.examQuestions.length > 0
      ? lesson.examQuestions.map((q) => ({
          question: q.question ?? '',
          questionImage: q.questionImage ?? '',
          options: q.options.length >= 2 ? [...q.options] : ['أ', 'ب', 'ج', 'د'],
          correctIndex: q.correctIndex ?? 0,
          explanation: q.explanation ?? '',
        }))
      : [
          {
            question: lesson.quiz.question ?? '',
            questionImage: lesson.quiz.questionImage ?? '',
            options: [...lesson.quiz.options],
            correctIndex: lesson.quiz.correctIndex,
            explanation: lesson.quiz.explanation ?? '',
          },
        ];

  const videos = lesson.videos ? [...lesson.videos] : [];
  const derivedMinutes =
    videos.length > 0 ? calcLessonDurationMinutes(videos) : lesson.durationMinutes || 0;

  return {
    ...lesson,
    durationMinutes: derivedMinutes,
    videos,
    attachments: lesson.attachments ? [...lesson.attachments] : [],
    examQuestions,
    quiz: examQuestions[0],
  };
}

export function SupervisorDashboard({
  supervisorName,
  supervisorPhone,
  token,
  initialTab = 'students',
  teachers,
  customCourses,
  deletedCourseIds = [],
  supportWhatsappPhone = '01022193514',
  onCatalogUpdated,
  onLogout,
}: SupervisorDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneSearchQuery, setPhoneSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('جميع المراحل');
  const [multiDeviceOnly, setMultiDeviceOnly] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  // Supervisor WhatsApp top-up phone configuration state
  const [whatsappPhoneDraft, setWhatsappPhoneDraft] = useState(supportWhatsappPhone);
  const [whatsappPhoneSaving, setWhatsappPhoneSaving] = useState(false);
  const [whatsappPhoneNotice, setWhatsappPhoneNotice] = useState<string | null>(null);

  const [editWalletAdd, setEditWalletAdd] = useState('');
  const [editBlocked, setEditBlocked] = useState(false);
  const [editAutoBlockExempt, setEditAutoBlockExempt] = useState(false);
  const [editDevicesCount, setEditDevicesCount] = useState(0);
  const [resetDevicesFlag, setResetDevicesFlag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instantActionLoading, setInstantActionLoading] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [followUpActionNotice, setFollowUpActionNotice] = useState('');
  const [approvalActionLoadingId, setApprovalActionLoadingId] = useState<string | null>(null);
  const [approvalFeedback, setApprovalFeedback] = useState<{
    type: 'ok' | 'error';
    text: string;
  } | null>(null);

  // Low-attendance alert composer state
  const [alertTargets, setAlertTargets] = useState<StudentRecord[] | null>(null);
  const [alertTitle, setAlertTitle] = useState('تنبيه هام بخصوص نسبة الحضور');
  const [alertMessage, setAlertMessage] = useState(
    'نسبة حضورك الحالية أقل من 50%. يرجى الدخول ومتابعة الحصص المسجلة بانتظام لرفع نسبة الحضور والاستفادة الكاملة من المنهج.'
  );
  const [alertSending, setAlertSending] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<{
    type: 'ok' | 'error';
    text: string;
  } | null>(null);

  // Teacher form state
  const [teacherName, setTeacherName] = useState('');
  const [teacherSubject, setTeacherSubject] = useState<string>(PLATFORM_SUBJECTS[0]);
  const [teacherImage, setTeacherImage] = useState('');
  const [teacherTelegramSupport, setTeacherTelegramSupport] = useState('');
  const [teacherTelegramDrafts, setTeacherTelegramDrafts] = useState<Record<string, string>>({});
  const [savingTeacherTelegramId, setSavingTeacherTelegramId] = useState<string | null>(null);
  const [teacherGrades, setTeacherGrades] = useState<EducationalStage[]>([
    'الصف الثالث الثانوي',
  ]);
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [teacherFeedback, setTeacherFeedback] = useState('');

  // Teacher edit modal state
  const [editingTeacher, setEditingTeacher] = useState<DynamicTeacher | null>(null);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherSubject, setEditTeacherSubject] = useState<string>(PLATFORM_SUBJECTS[0]);
  const [editTeacherImage, setEditTeacherImage] = useState('');
  const [editTeacherTelegram, setEditTeacherTelegram] = useState('');
  const [editTeacherGrades, setEditTeacherGrades] = useState<EducationalStage[]>(['الصف الثالث الثانوي']);
  const [editTeacherSaving, setEditTeacherSaving] = useState(false);
  const [editTeacherFeedback, setEditTeacherFeedback] = useState('');

  const handleSaveTeacherEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    setEditTeacherSaving(true);
    setEditTeacherFeedback('');
    try {
      const res = await apiUpdateTeacher(token, editingTeacher.id, {
        name: editTeacherName,
        subject: editTeacherSubject,
        image: editTeacherImage,
        telegramSupport: editTeacherTelegram,
        grades: editTeacherGrades,
      });
      if (!res.ok) {
        setEditTeacherFeedback(res.error);
      } else {
        setEditTeacherFeedback('تم حفظ تعديلات المدرس بنجاح.');
        await onCatalogUpdated();
        setTimeout(() => {
          setEditingTeacher(null);
        }, 800);
      }
    } catch {
      setEditTeacherFeedback('حدث خطأ أثناء حفظ تعديلات المدرس.');
    } finally {
      setEditTeacherSaving(false);
    }
  };

  // Course creation form state
  const [courseTitle, setCourseTitle] = useState('');
  const [courseGrade, setCourseGrade] =
    useState<EducationalStage>('الصف الثالث الثانوي');
  const [courseTeacherId, setCourseTeacherId] = useState('');
  const [courseCategory, setCourseCategory] = useState<string>(PLATFORM_SUBJECTS[0]);
  const [coursePrice, setCoursePrice] = useState('250');
  const [courseImage, setCourseImage] = useState('');
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseFeedback, setCourseFeedback] = useState('');
  const [pendingDeleteCourseIds, setPendingDeleteCourseIds] = useState<string[]>([]);
  const [deletingCoursesSaving, setDeletingCoursesSaving] = useState(false);
  const [coursesActionNotice, setCoursesActionNotice] = useState<{
    type: 'ok' | 'error';
    text: string;
  } | null>(null);

  // Full Course & Lesson Content Editor state
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingLessons, setEditingLessons] = useState<Lesson[]>([]);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorFeedback, setEditorFeedback] = useState('');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Per-lesson draft inputs for adding video links & file links
  const [videoLinkTitleDraft, setVideoLinkTitleDraft] = useState<Record<string, string>>({});
  const [videoLinkUrlDraft, setVideoLinkUrlDraft] = useState<Record<string, string>>({});
  const [videoLinkDurationDraft, setVideoLinkDurationDraft] = useState<Record<string, string>>({});
  const [probingVideoLessonId, setProbingVideoLessonId] = useState<string | null>(null);
  const [videoUploadTitleDraft, setVideoUploadTitleDraft] = useState<Record<string, string>>({});
  const [fileLinkTitleDraft, setFileLinkTitleDraft] = useState<Record<string, string>>({});
  const [fileLinkUrlDraft, setFileLinkUrlDraft] = useState<Record<string, string>>({});
  const [fileUploadTitleDraft, setFileUploadTitleDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (supportWhatsappPhone) {
      setWhatsappPhoneDraft(supportWhatsappPhone);
    }
  }, [supportWhatsappPhone]);

  useEffect(() => {
    if (teachers.length > 0 && !teachers.some((t) => t.id === courseTeacherId)) {
      setCourseTeacherId(teachers[0].id);
      const norm = normalizeSubjectCategory(teachers[0].subject);
      if (norm) setCourseCategory(norm);
    }
  }, [teachers, courseTeacherId]);

  const editingCourseId = editingCourse?.id ?? null;

  // Auto-detect missing video durations when opening a course in the editor
  useEffect(() => {
    if (!editingCourseId) return;
    let cancelled = false;
    const toProbe: Array<{ lessonId: string; videoId: string; ytId?: string; url?: string }> = [];
    for (const les of editingLessons) {
      for (const vid of les.videos ?? []) {
        if (!vid.durationSeconds || vid.durationSeconds <= 0) {
          const yt = parseYouTubeVideo(vid.url);
          if (yt) {
            toProbe.push({ lessonId: les.id, videoId: vid.id, ytId: yt.id });
          } else if (!isExternalEmbedPlatformUrl(vid.url)) {
            toProbe.push({ lessonId: les.id, videoId: vid.id, url: vid.url });
          }
        }
      }
    }
    if (toProbe.length === 0) return;

    const runProbe = async () => {
      for (const item of toProbe) {
        if (cancelled) return;
        const sec = item.ytId
          ? await readYouTubeDurationSeconds(item.ytId, 4500)
          : item.url
            ? await readVideoDurationSeconds(item.url)
            : 0;
        if (cancelled) return;
        if (sec > 0) {
          setEditingLessons((prev) =>
            prev.map((les) => {
              if (les.id !== item.lessonId) return les;
              const nextVideos = (les.videos ?? []).map((v) =>
                v.id === item.videoId && (!v.durationSeconds || v.durationSeconds <= 0)
                  ? { ...v, durationSeconds: sec }
                  : v
              );
              return {
                ...les,
                videos: nextVideos,
                durationMinutes: calcLessonDurationMinutes(nextVideos),
              };
            })
          );
        }
      }
    };
    void runProbe();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCourseId]);

  const editingCourseTotalSeconds = useMemo(
    () => editingLessons.reduce((sum, les) => sum + getLessonEffectiveSeconds(les), 0),
    [editingLessons]
  );

  const allCourses = useMemo(
    () => mergeCatalogCourses(customCourses, COURSES, deletedCourseIds),
    [customCourses, deletedCourseIds]
  );

  const loadStudents = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setErrorMsg('');
    }
    try {
      if (token === 'firebase-google-session') {
        const fbStudents = await fetchAllFirebaseStudents();
        setStudents(fbStudents);
        return;
      }
      const result = await apiFetchSupervisorStudents(token);
      if (!result.ok) {
        if (!silent) setErrorMsg(result.error);
        return;
      }
      setStudents(result.students);
    } catch {
      if (!silent) setErrorMsg('تعذر تحميل بيانات الطلاب من قاعدة البيانات.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (activeTab === 'students' || activeTab === 'approvals' || activeTab === 'low-attendance') {
      loadStudents(true);
    }
    const handleFocus = () => {
      if (activeTab === 'students' || activeTab === 'approvals' || activeTab === 'low-attendance') {
        loadStudents(true);
      }
    };
    const intervalId = window.setInterval(() => {
      if (activeTab === 'students' || activeTab === 'approvals' || activeTab === 'low-attendance') {
        loadStudents(true);
      }
    }, 10000);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token]);

  const multiDeviceStudentsCount = useMemo(
    () => students.filter((s) => getStudentDevicesDisplay(s).length > 1).length,
    [students]
  );

  const pendingStudents = useMemo(
    () => students.filter((s) => s.approvalStatus === 'pending'),
    [students]
  );

  const approvedStudentsCount = useMemo(
    () => students.filter((s) => !s.approvalStatus || s.approvalStatus === 'approved').length,
    [students]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qPhoneDigits = normalizeDigits(searchQuery).replace(/[^0-9]/g, '');
    const explicitPhoneDigits = normalizeDigits(phoneSearchQuery).replace(/[^0-9]/g, '');

    return students.filter((s) => {
      const devices = getStudentDevicesDisplay(s);
      if (multiDeviceOnly && devices.length <= 1) return false;
      const matchesStage = stageFilter === 'جميع المراحل' || s.stage === stageFilter;

      const stuPhoneNorm = normalizeDigits(s.studentPhone).replace(/[^0-9]/g, '');
      const parPhoneNorm = normalizeDigits(s.parentPhone).replace(/[^0-9]/g, '');

      if (explicitPhoneDigits) {
        const matchesExplicitPhone =
          stuPhoneNorm.includes(explicitPhoneDigits) ||
          parPhoneNorm.includes(explicitPhoneDigits);
        if (!matchesExplicitPhone) return false;
      }

      const matchesDevice = devices.some(
        (d) =>
          d.browser.toLowerCase().includes(q) ||
          d.os.toLowerCase().includes(q) ||
          d.deviceType.includes(q) ||
          d.label.toLowerCase().includes(q)
      );
      const matchesQuery =
        !q ||
        s.studentName.toLowerCase().includes(q) ||
        s.studentPhone.includes(q) ||
        (qPhoneDigits.length >= 2 &&
          (stuPhoneNorm.includes(qPhoneDigits) || parPhoneNorm.includes(qPhoneDigits))) ||
        s.parentName.toLowerCase().includes(q) ||
        s.parentPhone.includes(q) ||
        (s.parentJob ?? '').toLowerCase().includes(q) ||
        s.motherName.toLowerCase().includes(q) ||
        s.specialization.toLowerCase().includes(q) ||
        matchesDevice;
      return matchesStage && matchesQuery;
    });
  }, [students, searchQuery, phoneSearchQuery, stageFilter, multiDeviceOnly]);

  const computeStudentActivityDetails = (stu: StudentRecord) => {
    const unlockedSet = new Set(stu.unlockedCourseIds);
    const enrolledCourses = allCourses.filter((c) => unlockedSet.has(c.id));
    const targetCourses =
      enrolledCourses.length > 0
        ? enrolledCourses
        : allCourses.filter((c) => c.grade === stu.stage);

    const openedLessons: Array<{
      lessonId: string;
      lessonTitle: string;
      courseId: string;
      courseTitle: string;
      openedDate?: string;
    }> = [];
    const unopenedLessons: Array<{
      lessonId: string;
      lessonTitle: string;
      courseId: string;
      courseTitle: string;
    }> = [];
    const submittedExams: Array<{
      lessonId: string;
      lessonTitle: string;
      courseId: string;
      courseTitle: string;
      scorePercent: number;
      correctCount: number;
      totalQuestions: number;
      passed: boolean;
      submittedAt: string;
    }> = [];

    const completedSet = new Set(stu.completedLessonIds ?? []);
    const attendanceDates = stu.attendanceDates ?? {};
    const examResults = stu.examResults ?? {};

    // Check across all courses for any lesson the student opened or submitted an exam for
    const allCoursesMap = new Map(allCourses.map((c) => [c.id, c]));
    const visitedCourseIds = new Set<string>(targetCourses.map((c) => c.id));
    for (const c of allCourses) {
      for (const les of getCourseAllLessons(c)) {
        if (completedSet.has(les.id) || attendanceDates[les.id] || examResults[les.id]) {
          visitedCourseIds.add(c.id);
        }
      }
    }

    for (const cid of visitedCourseIds) {
      const course = allCoursesMap.get(cid);
      if (!course) continue;
      for (const les of getCourseAllLessons(course)) {
        const isOpened = completedSet.has(les.id) || Boolean(attendanceDates[les.id]);
        if (isOpened) {
          openedLessons.push({
            lessonId: les.id,
            lessonTitle: les.title,
            courseId: course.id,
            courseTitle: course.title,
            openedDate: attendanceDates[les.id],
          });
        } else {
          unopenedLessons.push({
            lessonId: les.id,
            lessonTitle: les.title,
            courseId: course.id,
            courseTitle: course.title,
          });
        }

        const examRes = examResults[les.id];
        if (examRes) {
          submittedExams.push({
            lessonId: les.id,
            lessonTitle: les.title,
            courseId: course.id,
            courseTitle: course.title,
            scorePercent: examRes.scorePercent,
            correctCount: examRes.correctCount,
            totalQuestions: examRes.totalQuestions,
            passed: examRes.passed,
            submittedAt: examRes.submittedAt,
          });
        }
      }
    }

    openedLessons.sort((a, b) => (b.openedDate || '').localeCompare(a.openedDate || ''));
    submittedExams.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));

    return {
      openedLessons,
      unopenedLessons,
      submittedExams,
      lastOpenedLesson: openedLessons[0] ?? null,
    };
  };

  const renderDeviceIcon = (
    deviceType: NormalizedDeviceDisplay['deviceType'],
    className = 'w-3.5 h-3.5 shrink-0'
  ) => {
    if (deviceType === 'موبايل') return <Smartphone className={className} />;
    if (deviceType === 'تابلت') return <Tablet className={className} />;
    return <Laptop className={className} />;
  };

  const openStudentFollowUp = (student: StudentRecord) => {
    setSelectedStudent(student);
    setEditWalletAdd('');
    setEditBlocked(Boolean(student.isBlocked));
    setEditAutoBlockExempt(Boolean(student.autoBlockExempt));
    setEditDevicesCount(getStudentDevicesDisplay(student).length);
    setResetDevicesFlag(false);
    setSavedNotice(false);
    setFollowUpActionNotice('');
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    setSavedNotice(false);
    setFollowUpActionNotice('');
    const addAmount = Math.max(0, Math.round(Number(editWalletAdd) || 0));
    const currentWallet = Math.max(0, Number(selectedStudent.walletBalance) || 0);
    const nextBalance = Math.min(1000000, currentWallet + addAmount);
    const devicesCount = getStudentDevicesDisplay(selectedStudent).length;
    const effectiveExempt =
      !editBlocked && !resetDevicesFlag && devicesCount >= 3 ? true : editAutoBlockExempt;
    try {
      if (token === 'firebase-google-session') {
        const updated = await updateFirebaseStudentBySupervisor(selectedStudent.id, {
          walletBalance: nextBalance,
          isBlocked: editBlocked,
          autoBlockExempt: effectiveExempt,
          ...(editBlocked ? {} : { blockReason: '' }),
          ...(resetDevicesFlag ? { activeDeviceIds: [], deviceDetails: {} } : {}),
        });
        setStudents((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        setSelectedStudent(updated);
        setEditWalletAdd('');
        setEditBlocked(Boolean(updated.isBlocked));
        setEditAutoBlockExempt(Boolean(updated.autoBlockExempt));
        setEditDevicesCount(getStudentDevicesDisplay(updated).length);
        setResetDevicesFlag(false);
        setSavedNotice(true);
        return;
      }

      const result = await apiUpdateSupervisorStudent(selectedStudent.id, token, {
        walletBalance: nextBalance,
        isBlocked: editBlocked,
        autoBlockExempt: effectiveExempt,
        ...(editBlocked ? {} : { blockReason: '' }),
        resetDevices: resetDevicesFlag,
      });
      if (result.ok) {
        setStudents((prev) =>
          prev.map((s) => (s.id === result.student.id ? result.student : s))
        );
        setSelectedStudent(result.student);
        setEditWalletAdd('');
        setEditBlocked(Boolean(result.student.isBlocked));
        setEditAutoBlockExempt(Boolean(result.student.autoBlockExempt));
        setEditDevicesCount(getStudentDevicesDisplay(result.student).length);
        setResetDevicesFlag(false);
        setSavedNotice(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlockImmediate = async (targetBlocked: boolean) => {
    if (!selectedStudent || instantActionLoading) return;
    setInstantActionLoading(true);
    setSavedNotice(false);
    setFollowUpActionNotice('');
    const devicesCount = getStudentDevicesDisplay(selectedStudent).length;
    const shouldEnableExempt =
      !targetBlocked && !resetDevicesFlag && devicesCount >= 3
        ? true
        : editAutoBlockExempt;
    try {
      if (token === 'firebase-google-session') {
        const updated = await updateFirebaseStudentBySupervisor(selectedStudent.id, {
          isBlocked: targetBlocked,
          autoBlockExempt: shouldEnableExempt,
          ...(targetBlocked ? {} : { blockReason: '' }),
        });
        setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setSelectedStudent(updated);
        setEditBlocked(Boolean(updated.isBlocked));
        setEditAutoBlockExempt(Boolean(updated.autoBlockExempt));
        setFollowUpActionNotice(
          targetBlocked
            ? 'تم حظر الحساب بنجاح.'
            : 'تم إيقاف الحظر عن الطالب وتفعيل الحساب بنجاح.'
        );
        return;
      }

      const result = await apiUpdateSupervisorStudent(selectedStudent.id, token, {
        isBlocked: targetBlocked,
        autoBlockExempt: shouldEnableExempt,
        ...(targetBlocked ? {} : { blockReason: '' }),
      });
      if (result.ok) {
        setStudents((prev) =>
          prev.map((s) => (s.id === result.student.id ? result.student : s))
        );
        setSelectedStudent(result.student);
        setEditBlocked(Boolean(result.student.isBlocked));
        setEditAutoBlockExempt(Boolean(result.student.autoBlockExempt));
        setFollowUpActionNotice(
          targetBlocked
            ? 'تم حظر الحساب بنجاح.'
            : 'تم إيقاف الحظر عن الطالب وتفعيل الحساب بنجاح.'
        );
      }
    } finally {
      setInstantActionLoading(false);
    }
  };

  const handleToggleAutoBlockExemptImmediate = async () => {
    if (!selectedStudent || instantActionLoading) return;
    const nextExempt = !editAutoBlockExempt;
    setInstantActionLoading(true);
    setSavedNotice(false);
    setFollowUpActionNotice('');
    try {
      if (token === 'firebase-google-session') {
        const updated = await updateFirebaseStudentBySupervisor(selectedStudent.id, {
          autoBlockExempt: nextExempt,
        });
        setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setSelectedStudent(updated);
        setEditAutoBlockExempt(Boolean(updated.autoBlockExempt));
        setFollowUpActionNotice(
          nextExempt
            ? 'تم إيقاف الحظر التلقائي لهذا الحساب.'
            : 'تم إعادة تفعيل الحظر التلقائي عند تعدد الأجهزة.'
        );
        return;
      }

      const result = await apiUpdateSupervisorStudent(selectedStudent.id, token, {
        autoBlockExempt: nextExempt,
      });
      if (result.ok) {
        setStudents((prev) =>
          prev.map((s) => (s.id === result.student.id ? result.student : s))
        );
        setSelectedStudent(result.student);
        setEditAutoBlockExempt(Boolean(result.student.autoBlockExempt));
        setFollowUpActionNotice(
          nextExempt
            ? 'تم إيقاف الحظر التلقائي لهذا الحساب.'
            : 'تم إعادة تفعيل الحظر التلقائي عند تعدد الأجهزة.'
        );
      }
    } finally {
      setInstantActionLoading(false);
    }
  };

  const handleSetApprovalStatus = async (
    student: StudentRecord,
    nextStatus: StudentApprovalStatus
  ) => {
    if (approvalActionLoadingId) return;
    setApprovalActionLoadingId(student.id);
    setApprovalFeedback(null);
    setFollowUpActionNotice('');
    try {
      if (token === 'firebase-google-session') {
        const nextNotes =
          nextStatus === 'approved'
            ? 'تمت الموافقة وتفعيل الحساب.'
            : nextStatus === 'rejected'
              ? 'تم رفض طلب إنشاء الحساب من قِبل المشرف.'
              : 'تم تعليق الحساب — في انتظار مراجعة المشرف.';
        const updated = await updateFirebaseStudentBySupervisor(student.id, {
          approvalStatus: nextStatus,
          supervisorNotes: nextNotes,
        });
        setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        if (selectedStudent?.id === updated.id) {
          setSelectedStudent(updated);
          setFollowUpActionNotice(
            nextStatus === 'approved'
              ? 'تمت الموافقة على الحساب وتفعيله بنجاح.'
              : nextStatus === 'rejected'
                ? 'تم رفض طلب إنشاء الحساب.'
                : 'تم تعليق الحساب وإعادته لقائمة الانتظار.'
          );
        }
        setApprovalFeedback({
          type: 'ok',
          text:
            nextStatus === 'approved'
              ? `تمت الموافقة على حساب «${student.studentName}» وتفعيله بنجاح.`
              : nextStatus === 'rejected'
                ? `تم رفض طلب «${student.studentName}».`
                : `تم تحويل حساب «${student.studentName}» إلى قيد المراجعة.`,
        });
        return;
      }

      const result = await apiUpdateSupervisorStudent(student.id, token, {
        approvalStatus: nextStatus,
      });
      if (!result.ok) {
        setApprovalFeedback({ type: 'error', text: result.error });
        return;
      }
      setStudents((prev) =>
        prev.map((s) => (s.id === result.student.id ? result.student : s))
      );
      if (selectedStudent?.id === result.student.id) {
        setSelectedStudent(result.student);
        setFollowUpActionNotice(
          nextStatus === 'approved'
            ? 'تمت الموافقة على الحساب وتفعيله بنجاح.'
            : nextStatus === 'rejected'
              ? 'تم رفض طلب إنشاء الحساب.'
              : 'تم تعليق الحساب وإعادته لقائمة الانتظار.'
        );
      }
      setApprovalFeedback({
        type: 'ok',
        text:
          nextStatus === 'approved'
            ? `تمت الموافقة على حساب «${student.studentName}» وتفعيله بنجاح.`
            : nextStatus === 'rejected'
              ? `تم رفض طلب «${student.studentName}».`
              : `تم تحويل حساب «${student.studentName}» إلى قيد المراجعة.`,
      });
    } catch {
      setApprovalFeedback({
        type: 'error',
        text: 'تعذر تحديث حالة الموافقة على الحساب. حاول مرة أخرى.',
      });
    } finally {
      setApprovalActionLoadingId(null);
    }
  };

  const handleDeleteStudentRequest = async (student: StudentRecord) => {
    if (approvalActionLoadingId) return;
    setApprovalActionLoadingId(student.id);
    setApprovalFeedback(null);
    try {
      if (token === 'firebase-google-session') {
        await deleteFirebaseStudent(student.id);
      } else {
        const ok = await apiDeleteSupervisorStudent(student.id, token);
        if (!ok) {
          setApprovalFeedback({ type: 'error', text: 'تعذر حذف طلب الطالب.' });
          return;
        }
      }
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      if (selectedStudent?.id === student.id) {
        setSelectedStudent(null);
      }
      setApprovalFeedback({
        type: 'ok',
        text: `تم حذف طلب الطالب «${student.studentName}» نهائيًا.`,
      });
    } catch {
      setApprovalFeedback({ type: 'error', text: 'تعذر حذف طلب الطالب.' });
    } finally {
      setApprovalActionLoadingId(null);
    }
  };

  const handleTeacherFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setTeacherImage(compressed);
    } catch {
      setTeacherFeedback('تعذر معالجة الصورة المختارة. جرّب صورة أخرى.');
    }
  };

  const toggleTeacherGrade = (stage: EducationalStage) => {
    setTeacherGrades((prev) =>
      prev.includes(stage) ? prev.filter((g) => g !== stage) : [...prev, stage]
    );
  };

  const handleAddTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherFeedback('');
    setTeacherSaving(true);
    try {
      const res = await apiAddTeacher(token, {
        name: teacherName,
        subject: teacherSubject,
        grades: teacherGrades,
        image: teacherImage,
        telegramSupport: teacherTelegramSupport.trim(),
      });
      if (!res.ok) {
        setTeacherFeedback(res.error);
        return;
      }
      setTeacherName('');
      setTeacherSubject(PLATFORM_SUBJECTS[0]);
      setTeacherImage('');
      setTeacherTelegramSupport('');
      setTeacherGrades(['الصف الثالث الثانوي']);
      setTeacherFeedback('تمت إضافة المدرس ورقم الدعم العلمي على تليجرام بنجاح.');
      await onCatalogUpdated();
    } finally {
      setTeacherSaving(false);
    }
  };

  const handleSaveTeacherTelegram = async (teacher: DynamicTeacher) => {
    const draft = (teacherTelegramDrafts[teacher.id] ?? teacher.telegramSupport ?? '').trim();
    setSavingTeacherTelegramId(teacher.id);
    setTeacherFeedback('');
    try {
      const res = await apiUpdateTeacher(token, teacher.id, {
        telegramSupport: draft,
      });
      if (!res.ok) {
        setTeacherFeedback(res.error);
        return;
      }
      setTeacherFeedback(`تم حفظ رقم/حساب الدعم العلمي لتليجرام للمدرس ${teacher.name} بنجاح.`);
      await onCatalogUpdated();
    } finally {
      setSavingTeacherTelegramId(null);
    }
  };

  const handleSaveSupportWhatsappPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeDigits(whatsappPhoneDraft);
    if (cleaned.length < 8) {
      setWhatsappPhoneNotice('يرجى إدخال رقم هاتف صحيح لشحن المنصة.');
      return;
    }
    setWhatsappPhoneSaving(true);
    setWhatsappPhoneNotice(null);
    try {
      const res = await apiUpdateSupportWhatsappPhone(token, cleaned);
      if (!res.ok) {
        setWhatsappPhoneNotice(res.error);
        return;
      }
      setWhatsappPhoneDraft(res.supportWhatsappPhone);
      setWhatsappPhoneNotice('تم حفظ رقم واتساب ومكالمات المشرف لشحن المنصة بنجاح.');
      await onCatalogUpdated();
    } finally {
      setWhatsappPhoneSaving(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    const ok = await apiDeleteTeacher(token, teacherId);
    if (ok) {
      await onCatalogUpdated();
    }
  };

  const openCourseEditor = (course: Course) => {
    const flatLessons = getCourseAllLessons(course).map(normalizeLessonForEditor);
    setEditingCourse({ ...course });
    setEditingLessons(flatLessons);
    setExpandedLessonId(flatLessons[0]?.id ?? null);
    setEditorFeedback('');
  };

  const handleUploadCourseImage = async (
    file: File | undefined,
    target: 'new' | 'edit'
  ) => {
    if (!file) return;
    const key = target === 'new' ? 'new-course-img' : 'edit-course-img';
    setUploadingKey(key);
    if (target === 'new') setCourseFeedback('');
    else setEditorFeedback('');
    try {
      const res = await apiUploadMediaFile(token, file);
      if (!res.ok) {
        if (target === 'new') setCourseFeedback(res.error);
        else setEditorFeedback(res.error);
        return;
      }
      if (target === 'new') {
        setCourseImage(res.url);
      } else {
        setEditingCourse((prev) => (prev ? { ...prev, image: res.url } : prev));
      }
    } finally {
      setUploadingKey(null);
    }
  };

  const handleAddCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseFeedback('');
    if (teachers.length === 0) {
      setCourseFeedback('أضف مدرسًا أولًا من تبويب إدارة المدرسين لربط الكورس به.');
      return;
    }
    const chosenTeacher =
      teachers.find((t) => t.id === courseTeacherId) || teachers[0];
    setCourseSaving(true);
    try {
      const resolvedCategory =
        normalizeSubjectCategory(courseCategory) ||
        normalizeSubjectCategory(chosenTeacher.subject) ||
        PLATFORM_SUBJECTS[0];

      const parsedPrice = coursePrice.trim() !== '' ? Number(coursePrice) : 250;

      const res = await apiAddCourse(token, {
        title: courseTitle,
        subtitle: '',
        grade: courseGrade,
        category: resolvedCategory,
        instructorId: chosenTeacher.id,
        studyMode: 'أونلاين',
        priceEgp: Number.isFinite(parsedPrice) ? Math.max(0, parsedPrice) : 250,
        image: courseImage || chosenTeacher.image || '',
        lessonTitles: [],
      });
      if (!res.ok) {
        setCourseFeedback(res.error);
        return;
      }
      setCourseTitle('');
      setCourseImage('');
      setCourseFeedback(`تمت إضافة الكورس وربطه بالمدرس ${chosenTeacher.name} لطلاب ${courseGrade}.`);
      await onCatalogUpdated();
      openCourseEditor(res.course);
    } finally {
      setCourseSaving(false);
    }
  };

  const handleTogglePendingDeleteCourse = (courseId: string) => {
    setCoursesActionNotice(null);
    setPendingDeleteCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSaveCourseDeletions = async () => {
    if (pendingDeleteCourseIds.length === 0 || deletingCoursesSaving) return;
    setDeletingCoursesSaving(true);
    setCoursesActionNotice(null);
    try {
      const res = await apiDeleteCoursesBatch(token, pendingDeleteCourseIds);
      if (!res.ok) {
        setCoursesActionNotice({ type: 'error', text: res.error });
        return;
      }
      if (editingCourse && pendingDeleteCourseIds.includes(editingCourse.id)) {
        setEditingCourse(null);
      }
      const deletedCount = pendingDeleteCourseIds.length;
      setPendingDeleteCourseIds([]);
      await onCatalogUpdated();
      setCoursesActionNotice({
        type: 'ok',
        text: `تم حفظ التغييرات وحذف ${deletedCount} ${deletedCount === 1 ? 'كورس' : 'كورسات'} بنجاح.`,
      });
    } finally {
      setDeletingCoursesSaving(false);
    }
  };

  // --- Vertical Lesson Builder Helpers ---
  const updateLessonField = (lessonId: string, updater: (les: Lesson) => Lesson) => {
    setEditingLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? updater(l) : l))
    );
  };

  const handleAddNewLesson = () => {
    const nextNum = editingLessons.length + 1;
    const newId = `les-${Date.now()}-${nextNum}`;
    const defaultTitle = `الحصة ${nextNum}: درس جديد`;
    const q = createEmptyQuizQuestion();
    const newLesson: Lesson = {
      id: newId,
      title: defaultTitle,
      durationMinutes: 0,
      summary: '',
      keyTakeaways: [],
      videos: [],
      attachments: [],
      examQuestions: [q],
      simulationKind: 'math-calculus',
      quiz: q,
    };
    setEditingLessons((prev) => [...prev, newLesson]);
    setExpandedLessonId(newId);
    setEditorFeedback('');
  };

  const handleMoveLesson = (index: number, direction: 'up' | 'down') => {
    setEditingLessons((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const handleDeleteLesson = (lessonId: string) => {
    setEditingLessons((prev) => prev.filter((l) => l.id !== lessonId));
  };

  const handleAddVideoLink = async (lessonId: string) => {
    const rawUrl = (videoLinkUrlDraft[lessonId] || '').trim();
    if (!rawUrl) {
      setEditorFeedback('يرجى إدخال رابط الفيديو أولًا.');
      return;
    }
    const yt = parseYouTubeVideo(rawUrl);
    const cleanedUrl = yt ? yt.watchUrl : normalizeExternalUrl(extractCleanVideoUrl(rawUrl));
    if (!cleanedUrl) {
      setEditorFeedback('يرجى إدخال رابط فيديو صحيح.');
      return;
    }
    const lesson = editingLessons.find((l) => l.id === lessonId);
    const nextNum = (lesson?.videos?.length ?? 0) + 1;
    const title = (videoLinkTitleDraft[lessonId] || '').trim() || `فيديو الشرح ${nextNum}`;

    const manualMinutesRaw = Number((videoLinkDurationDraft[lessonId] || '').trim());
    let durationSeconds =
      Number.isFinite(manualMinutesRaw) && manualMinutesRaw > 0
        ? Math.round(manualMinutesRaw * 60)
        : 0;

    if (durationSeconds === 0) {
      setProbingVideoLessonId(lessonId);
      try {
        if (yt) {
          durationSeconds = await readYouTubeDurationSeconds(yt.id);
        } else if (!isExternalEmbedPlatformUrl(cleanedUrl)) {
          durationSeconds = await readVideoDurationSeconds(cleanedUrl);
        }
      } finally {
        setProbingVideoLessonId(null);
      }
    }

    const newVideo: LessonVideo = {
      id: `vid-${Date.now()}`,
      title,
      url: cleanedUrl,
      sourceType: 'link',
      ...(durationSeconds > 0 ? { durationSeconds } : {}),
    };
    updateLessonField(lessonId, (les) => {
      const nextVideos = [...(les.videos ?? []), newVideo];
      return {
        ...les,
        videos: nextVideos,
        durationMinutes: calcLessonDurationMinutes(nextVideos),
      };
    });
    setVideoLinkTitleDraft((p) => ({ ...p, [lessonId]: '' }));
    setVideoLinkUrlDraft((p) => ({ ...p, [lessonId]: '' }));
    setVideoLinkDurationDraft((p) => ({ ...p, [lessonId]: '' }));
    setEditorFeedback('');
  };

  const handleUploadVideoFile = async (lessonId: string, file: File | undefined) => {
    if (!file) return;
    setUploadingKey(`vid-${lessonId}`);
    setEditorFeedback('');
    try {
      const [durationSeconds, res] = await Promise.all([
        readVideoDurationSeconds(file),
        apiUploadMediaFile(token, file),
      ]);
      if (!res.ok) {
        setEditorFeedback(res.error);
        return;
      }
      const lesson = editingLessons.find((l) => l.id === lessonId);
      const nextNum = (lesson?.videos?.length ?? 0) + 1;
      const customTitle =
        (videoUploadTitleDraft[lessonId] || '').trim() ||
        file.name.replace(/\.[^.]+$/, '') ||
        `فيديو ${nextNum}`;
      const newVideo: LessonVideo = {
        id: `vid-${Date.now()}`,
        title: customTitle,
        url: res.url,
        sourceType: 'upload',
        ...(durationSeconds > 0 ? { durationSeconds } : {}),
      };
      updateLessonField(lessonId, (les) => {
        const nextVideos = [...(les.videos ?? []), newVideo];
        return {
          ...les,
          videos: nextVideos,
          durationMinutes: calcLessonDurationMinutes(nextVideos),
        };
      });
      setVideoUploadTitleDraft((p) => ({ ...p, [lessonId]: '' }));
    } finally {
      setUploadingKey(null);
    }
  };

  const handleUpdateVideoDurationMinutes = (
    lessonId: string,
    videoId: string,
    minutesInput: string
  ) => {
    const parsed = Number(minutesInput);
    const nextSeconds =
      Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 60) : 0;
    updateLessonField(lessonId, (les) => {
      const nextVideos = (les.videos ?? []).map((v) => {
        if (v.id !== videoId) return v;
        if (nextSeconds > 0) {
          return { ...v, durationSeconds: nextSeconds };
        }
        const { durationSeconds: _omitted, ...rest } = v;
        return rest;
      });
      return {
        ...les,
        videos: nextVideos,
        durationMinutes: calcLessonDurationMinutes(nextVideos),
      };
    });
  };

  const handleRemoveVideo = (lessonId: string, videoId: string) => {
    updateLessonField(lessonId, (les) => {
      const nextVideos = (les.videos ?? []).filter((v) => v.id !== videoId);
      return {
        ...les,
        videos: nextVideos,
        durationMinutes: calcLessonDurationMinutes(nextVideos),
      };
    });
  };

  const handleUploadAttachmentFile = async (lessonId: string, file: File | undefined) => {
    if (!file) return;
    setUploadingKey(`file-${lessonId}`);
    setEditorFeedback('');
    try {
      const res = await apiUploadMediaFile(token, file);
      if (!res.ok) {
        setEditorFeedback(res.error);
        return;
      }
      const customTitle =
        (fileUploadTitleDraft[lessonId] || '').trim() ||
        file.name.replace(/\.[^.]+$/, '') ||
        'ملف الحصة';
      const isPdf =
        res.fileType === 'pdf' ||
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf');
      const newAtt: LessonAttachment = {
        id: `att-${Date.now()}`,
        title: customTitle,
        url: res.url,
        fileName: res.fileName,
        fileType: isPdf ? 'pdf' : 'file',
        mimeType: res.mimeType || (isPdf ? 'application/pdf' : file.type || undefined),
      };
      updateLessonField(lessonId, (les) => ({
        ...les,
        attachments: [...(les.attachments ?? []), newAtt],
      }));
      setFileUploadTitleDraft((p) => ({ ...p, [lessonId]: '' }));
    } finally {
      setUploadingKey(null);
    }
  };

  const handleAddAttachmentLink = (lessonId: string) => {
    const rawUrl = (fileLinkUrlDraft[lessonId] || '').trim();
    if (!rawUrl) {
      setEditorFeedback('يرجى إدخال رابط الملف أولًا.');
      return;
    }
    const url = normalizeExternalUrl(rawUrl);
    const lesson = editingLessons.find((l) => l.id === lessonId);
    const nextNum = (lesson?.attachments?.length ?? 0) + 1;
    const title = (fileLinkTitleDraft[lessonId] || '').trim() || `ملف الحصة ${nextNum}`;
    const detectedPdf =
      isPdfAttachment({ url, fileName: url }) || /drive\.google\.com/i.test(url);
    const newAtt: LessonAttachment = {
      id: `att-${Date.now()}`,
      title,
      url,
      fileType: detectedPdf ? 'pdf' : 'file',
      ...(detectedPdf ? { mimeType: 'application/pdf' } : {}),
    };
    updateLessonField(lessonId, (les) => ({
      ...les,
      attachments: [...(les.attachments ?? []), newAtt],
    }));
    setFileLinkTitleDraft((p) => ({ ...p, [lessonId]: '' }));
    setFileLinkUrlDraft((p) => ({ ...p, [lessonId]: '' }));
    setEditorFeedback('');
  };

  const handleRemoveAttachment = (lessonId: string, attId: string) => {
    updateLessonField(lessonId, (les) => ({
      ...les,
      attachments: (les.attachments ?? []).filter((a) => a.id !== attId),
    }));
  };

  const handleAddExamQuestion = (lessonId: string) => {
    updateLessonField(lessonId, (les) => {
      const current = les.examQuestions ?? [les.quiz];
      const next = [...current, createEmptyQuizQuestion()];
      return { ...les, examQuestions: next, quiz: next[0] };
    });
  };

  const handleUpdateExamQuestion = (
    lessonId: string,
    qIdx: number,
    updater: (q: QuizQuestion) => QuizQuestion
  ) => {
    updateLessonField(lessonId, (les) => {
      const current = les.examQuestions ?? [les.quiz];
      const next = current.map((q, idx) => (idx === qIdx ? updater(q) : q));
      return { ...les, examQuestions: next, quiz: next[0] };
    });
  };

  const handleUploadQuizQuestionImage = async (
    lessonId: string,
    qIdx: number,
    file: File | undefined
  ) => {
    if (!file) return;
    setUploadingKey(`quiz-img-${lessonId}-${qIdx}`);
    setEditorFeedback('');
    try {
      const res = await apiUploadMediaFile(token, file);
      if (!res.ok) {
        setEditorFeedback(res.error);
        return;
      }
      handleUpdateExamQuestion(lessonId, qIdx, (prevQ) => ({
        ...prevQ,
        questionImage: res.url,
      }));
    } finally {
      setUploadingKey(null);
    }
  };

  const handleDeleteExamQuestion = (lessonId: string, qIdx: number) => {
    updateLessonField(lessonId, (les) => {
      const current = les.examQuestions ?? [les.quiz];
      if (current.length <= 1) return les;
      const next = current.filter((_, idx) => idx !== qIdx);
      return { ...les, examQuestions: next, quiz: next[0] };
    });
  };

  const handleSaveCourseEdits = async () => {
    if (!editingCourse) return;
    if (!editingCourse.title.trim()) {
      setEditorFeedback('يرجى كتابة اسم الكورس.');
      return;
    }
    if (editingLessons.length === 0) {
      setEditorFeedback('يجب أن يحتوي الكورس على حصة واحدة على الأقل.');
      return;
    }

    setEditorSaving(true);
    setEditorFeedback('');
    try {
      const normalizedLessons = editingLessons.map((les) => {
        const qs =
          les.examQuestions && les.examQuestions.length > 0
            ? les.examQuestions
            : [les.quiz];
        const videos = les.videos ?? [];
        const resolvedMinutes =
          videos.length > 0
            ? calcLessonDurationMinutes(videos)
            : Math.max(0, Math.round(Number(les.durationMinutes) || 0));
        return {
          ...les,
          durationMinutes: resolvedMinutes,
          summary: '',
          keyTakeaways: [],
          examQuestions: qs,
          quiz: qs[0],
        };
      });

      const totalSeconds = normalizedLessons.reduce(
        (sum, les) => sum + getLessonEffectiveSeconds(les),
        0
      );

      const updatedCourse: Course = {
        ...editingCourse,
        subtitle: '',
        fallbackTitle: editingCourse.title.trim(),
        totalHours: totalSeconds > 0 ? Number((totalSeconds / 3600).toFixed(2)) : 0,
        modules: [
          {
            id: editingCourse.modules[0]?.id || `mod-${Date.now()}`,
            title: 'الحصص الدراسية',
            lessons: normalizedLessons,
          },
        ],
      };

      const res = await apiUpdateCourse(token, updatedCourse);
      if (!res.ok) {
        setEditorFeedback(res.error);
        return;
      }
      setEditingCourse(res.course);
      setEditingLessons(getCourseAllLessons(res.course).map(normalizeLessonForEditor));
      setEditorFeedback('تم حفظ الكورس والحصص والفيديوهات والملفات والامتحانات بنجاح.');
      await onCatalogUpdated();
    } finally {
      setEditorSaving(false);
    }
  };

  const resolveTeacherInfo = (instructorId: string) => {
    const dyn = teachers.find((t) => t.id === instructorId);
    if (dyn) {
      return {
        name: dyn.name,
        subject: dyn.subject,
        image: dyn.image,
      };
    }
    const built = INSTRUCTORS.find((i) => i.id === instructorId);
    return {
      name: built ? built.name : 'مدرس المادة',
      subject: built ? built.specialty : '',
      image: built ? built.image : '',
    };
  };

  const resolveTeacherLabel = (instructorId: string) => {
    const info = resolveTeacherInfo(instructorId);
    return info.subject ? `${info.name} (${info.subject})` : info.name;
  };

  const lowAttendanceRows = useMemo(() => {
    return students
      .filter((student) => !student.approvalStatus || student.approvalStatus === 'approved')
      .map((student) => ({
        student,
        attendance: computeStudentAttendance(student, allCourses),
      }))
      .filter((entry) => entry.attendance.rate < 50)
      .sort((a, b) => a.attendance.rate - b.attendance.rate);
  }, [students, allCourses]);

  const filteredLowAttendanceRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return lowAttendanceRows.filter(({ student }) => {
      const matchesStage =
        stageFilter === 'جميع المراحل' || student.stage === stageFilter;
      const matchesQuery =
        !q ||
        student.studentName.toLowerCase().includes(q) ||
        student.studentPhone.includes(q) ||
        student.parentName.toLowerCase().includes(q) ||
        student.parentPhone.includes(q);
      return matchesStage && matchesQuery;
    });
  }, [lowAttendanceRows, searchQuery, stageFilter]);

  const openAlertComposer = (targets: StudentRecord[]) => {
    if (targets.length === 0) return;
    setAlertTargets(targets);
    setAlertTitle('تنبيه هام بخصوص نسبة الحضور');
    setAlertMessage(
      targets.length === 1
        ? `مرحبًا ${targets[0].studentName}، نسبة حضورك الحالية أقل من 50%. يرجى الدخول لمتابعة الحصص المسجلة بانتظام لرفع نسبة الحضور.`
        : 'نسبة حضورك الحالية أقل من 50%. يرجى الدخول ومتابعة الحصص المسجلة بانتظام لرفع نسبة الحضور والاستفادة الكاملة من المنهج.'
    );
    setAlertFeedback(null);
  };

  const handleSendAlertsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTargets || alertTargets.length === 0) return;
    const cleanTitle = alertTitle.trim();
    const cleanMsg = alertMessage.trim();
    if (cleanTitle.length < 2 || cleanMsg.length < 2) {
      setAlertFeedback({ type: 'error', text: 'يرجى كتابة عنوان ونص التنبيه أولًا.' });
      return;
    }

    setAlertSending(true);
    setAlertFeedback(null);
    const targetIds = alertTargets.map((s) => s.id);
    try {
      if (token === 'firebase-google-session') {
        const sentCount = await sendFirebaseStudentAlerts(targetIds, {
          title: cleanTitle,
          message: cleanMsg,
        });
        const refreshed = await fetchAllFirebaseStudents();
        setStudents(refreshed);
        setAlertFeedback({
          type: 'ok',
          text: `تم إرسال التنبيه داخل المنصة إلى ${sentCount} طالب بنجاح.`,
        });
        return;
      }

      const res = await apiSendSupervisorAlerts(token, {
        studentIds: targetIds,
        title: cleanTitle,
        message: cleanMsg,
      });
      if (!res.ok) {
        setAlertFeedback({ type: 'error', text: res.error });
        return;
      }
      if (res.students) {
        setStudents(res.students);
      }
      setAlertFeedback({
        type: 'ok',
        text: `تم إرسال التنبيه داخل المنصة إلى ${res.sentCount} طالب بنجاح.`,
      });
    } catch {
      setAlertFeedback({ type: 'error', text: 'تعذر إرسال التنبيه. حاول مرة أخرى.' });
    } finally {
      setAlertSending(false);
    }
  };

  const bacCount = students.filter((s) => s.stage === 'البكالوريا').length;
  const secCount = students.filter((s) => s.stage !== 'البكالوريا').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">إدارة المنصة · {supervisorPhone}</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            إدارة المدرسين والكورسات ومتابعة الطلاب
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            مرحباً {supervisorName} — أضف المدرسين، تحكم في الكورسات والحصص والفيديوهات والملفات والامتحانات، وتابع الطلاب.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">إجمالي الطلاب المفعلين</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {approvedStudentsCount}
          </div>
          {pendingStudents.length > 0 && (
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-1 tabular-nums">
              +{pendingStudents.length} طلب بانتظار الموافقة
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">طلاب الثانوي / البكالوريا</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {secCount} / {bacCount}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">المدرسون المضافون</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{teachers.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">إجمالي الكورسات</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {allCourses.length}
          </div>
        </div>
      </div>

      {/* Quick Supervisor Setting: WhatsApp & Call Phone for Charging Platform Wallet */}
      <form
        onSubmit={handleSaveSupportWhatsappPhone}
        className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/70 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>رقم واتساب ومكالمات المشرف لشحن المنصة (يظهر أسفل الصفحة الأولى للطلاب)</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            يتواصل الطلاب على هذا الرقم عبر واتساب أو الاتصال الهاتفي لشحن محفظة المنصة وتفعيل الكورسات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            type="tel"
            dir="ltr"
            value={whatsappPhoneDraft}
            onChange={(e) => setWhatsappPhoneDraft(e.target.value)}
            placeholder="01022193514"
            className="w-44 px-3 py-2 text-xs sm:text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <button
            type="submit"
            disabled={whatsappPhoneSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{whatsappPhoneSaving ? 'جاري الحفظ...' : 'حفظ رقم الشحن'}</span>
          </button>
          {whatsappPhoneNotice && (
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {whatsappPhoneNotice}
            </span>
          )}
        </div>
      </form>

      <div
        role="tablist"
        aria-label="أقسام الإدارة"
        className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-lg overflow-x-auto max-w-full"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'students'}
          onClick={() => {
            setActiveTab('students');
            setEditingCourse(null);
          }}
          className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'students'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>بيانات ومتابعة الطلاب</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'approvals'}
          onClick={() => {
            setActiveTab('approvals');
            setEditingCourse(null);
          }}
          className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'approvals'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>الموافقات على تسجيل الطلاب الجدد</span>
          <span
            className={`px-1.5 py-0.5 text-[11px] font-bold rounded-md tabular-nums ${
              pendingStudents.length > 0
                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {pendingStudents.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'low-attendance'}
          onClick={() => {
            setActiveTab('low-attendance');
            setEditingCourse(null);
          }}
          className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'low-attendance'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>نسبة الحضور &lt; 50%</span>
          {lowAttendanceRows.length > 0 && (
            <span className="px-1.5 py-0.5 text-[11px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-md tabular-nums">
              {lowAttendanceRows.length}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'teachers'}
          onClick={() => {
            setActiveTab('teachers');
            setEditingCourse(null);
          }}
          className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'teachers'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>إدارة المدرسين</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'courses'}
          onClick={() => setActiveTab('courses')}
          className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'courses'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>إدارة كورسات المراحل</span>
        </button>
      </div>

      {activeTab === 'teachers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleAddTeacherSubmit}
            className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 min-w-0"
          >
            <h2 className="text-base font-bold text-slate-900 dark:text-white">إضافة مدرس جديد</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              يظهر المدرس مباشرة في شريط التمرير بالصفحة الأولى للمنصة.
            </p>

            <div>
              <label
                htmlFor="teacher-name-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                اسم المدرس
              </label>
              <input
                id="teacher-name-input"
                type="text"
                required
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="مثال: أ. أحمد محمود"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="teacher-subject-select"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                المادة الدراسية
              </label>
              <select
                id="teacher-subject-select"
                value={teacherSubject}
                onChange={(e) => setTeacherSubject(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {PLATFORM_SUBJECTS.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                صورة المدرس
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                  <ImagePlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  <span>رفع صورة من الجهاز</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTeacherFileChange}
                    className="hidden"
                  />
                </label>
                {teacherImage && (
                  <button
                    type="button"
                    onClick={() => setTeacherImage('')}
                    className="text-xs text-red-700 dark:text-red-300 hover:underline"
                  >
                    إزالة الصورة
                  </button>
                )}
              </div>
              <input
                type="url"
                dir="ltr"
                value={teacherImage.startsWith('data:') ? '' : teacherImage}
                onChange={(e) => setTeacherImage(e.target.value)}
                placeholder="أو الصق رابط الصورة مباشرة (https://...)"
                className="mt-2 w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              {teacherImage && (
                <div className="mt-3 w-28 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                  <img
                    src={teacherImage}
                    alt="معاينة صورة المدرس"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="teacher-telegram-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                رقم أو معرف تليجرام للدعم العلمي للمدرس
              </label>
              <input
                id="teacher-telegram-input"
                type="text"
                dir="ltr"
                value={teacherTelegramSupport}
                onChange={(e) => setTeacherTelegramSupport(e.target.value)}
                placeholder="مثال: 01012345678 أو @TeacherSupport"
                className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                يظهر للطلاب كزر تليجرام مخصص للدعم العلمي الخاص بهذا المدرس.
              </p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                المراحل التي يدرسها
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EDUCATIONAL_STAGES.map((stage) => {
                  const selected = teacherGrades.includes(stage);
                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => toggleTeacherGrade(stage)}
                      className={`px-3 py-2 text-xs rounded-lg border text-right transition-colors cursor-pointer ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-semibold'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {stage}
                    </button>
                  );
                })}
              </div>
            </div>

            {teacherFeedback && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-medium text-blue-900 dark:text-blue-200">
                {teacherFeedback}
              </div>
            )}

            <button
              type="submit"
              disabled={teacherSaving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{teacherSaving ? 'جاري الإضافة...' : 'إضافة المدرس للمنصة'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 min-w-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                المدرسون الحاليون في الصفحة الأولى
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {teachers.length} مدرس
              </span>
            </div>

            {teachers.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                لم تقم بإضافة مدرسين بعد. استخدم النموذج لإضافة أول مدرس بصورته واسمه ومادته ورقم الدعم العلمي.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {teachers.map((t) => {
                  const linkedCount = allCourses.filter(
                    (c) => c.instructorId === t.id
                  ).length;
                  const tgDraft = teacherTelegramDrafts[t.id] ?? t.telegramSupport ?? '';
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between bg-slate-50/40 dark:bg-slate-800/40"
                    >
                      <div>
                        <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 overflow-hidden">
                          <ResilientImage
                            src={t.image}
                            alt={t.name}
                            fallbackTitle={t.name}
                            className="w-full h-full object-cover object-top"
                          />
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.name}</h3>
                          <div className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                            مدرس مادة: {t.subject}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{t.grades.join(' · ')}</div>
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                            {linkedCount} كورس مربوط بالمدرس
                          </div>

                          {/* Telegram Scientific Support Field per Teacher */}
                          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/70 space-y-1.5">
                            <label className="block text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                              تليجرام الدعم العلمي للمدرس
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                dir="ltr"
                                value={tgDraft}
                                onChange={(e) =>
                                  setTeacherTelegramDrafts((prev) => ({
                                    ...prev,
                                    [t.id]: e.target.value,
                                  }))
                                }
                                placeholder="رقم التليفون أو @username"
                                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                              />
                              <button
                                type="button"
                                disabled={savingTeacherTelegramId === t.id}
                                onClick={() => void handleSaveTeacherTelegram(t)}
                                className="px-2.5 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors shrink-0 cursor-pointer"
                              >
                                {savingTeacherTelegramId === t.id ? '...' : 'حفظ'}
                              </button>
                            </div>
                            {t.telegramSupport && (
                              <a
                                href={formatTelegramUrl(t.telegramSupport)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                              >
                                <Send className="w-3 h-3" />
                                <span dir="ltr">{t.telegramSupport}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="px-4 pb-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCourseTeacherId(t.id);
                            setCourseCategory(normalizeSubjectCategory(t.subject) || PLATFORM_SUBJECTS[0]);
                            if (t.grades[0]) setCourseGrade(t.grades[0]);
                            setActiveTab('courses');
                            setEditingCourse(null);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة كورس له</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeacher(t);
                            setEditTeacherName(t.name);
                            setEditTeacherSubject(normalizeSubjectCategory(t.subject) || PLATFORM_SUBJECTS[0]);
                            setEditTeacherImage(t.image);
                            setEditTeacherTelegram(t.telegramSupport || '');
                            setEditTeacherGrades(t.grades?.length ? [...t.grades] : ['الصف الثالث الثانوي']);
                            setEditTeacherFeedback('');
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTeacher(t.id)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'courses' && !editingCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleAddCourseSubmit}
            className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 min-w-0"
          >
            <h2 className="text-base font-bold text-slate-900 dark:text-white">إضافة كورس جديد</h2>

            <div>
              <label
                htmlFor="course-grade-select"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                السنة الدراسية
              </label>
              <select
                id="course-grade-select"
                value={courseGrade}
                onChange={(e) => setCourseGrade(e.target.value as EducationalStage)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {EDUCATIONAL_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="course-teacher-select"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                المدرس المسئول عن الكورس
              </label>
              <select
                id="course-teacher-select"
                value={courseTeacherId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setCourseTeacherId(nextId);
                  const found = teachers.find((t) => t.id === nextId);
                  if (found) {
                    const norm = normalizeSubjectCategory(found.subject);
                    if (norm) setCourseCategory(norm);
                  }
                }}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {teachers.length === 0 ? (
                  <option value="">أضف مدرسًا أولًا من تبويب إدارة المدرسين</option>
                ) : (
                  teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="course-subject-select"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                المادة
              </label>
              <select
                id="course-subject-select"
                value={courseCategory}
                onChange={(e) => setCourseCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {PLATFORM_SUBJECTS.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="course-title-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                اسم الكورس
              </label>
              <input
                id="course-title-input"
                type="text"
                required
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="مثال: الباب الأول — التفاضل وتطبيقاته"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="course-price-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                سعر الكورس (ج.م)
              </label>
              <input
                id="course-price-input"
                type="number"
                min={0}
                required
                value={coursePrice}
                onChange={(e) => setCoursePrice(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                صورة الكورس
              </label>
              <div className="space-y-2.5">
                <label className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                  <ImagePlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  <span>
                    {uploadingKey === 'new-course-img'
                      ? 'جاري رفع صورة الكورس...'
                      : courseImage
                      ? 'تغيير صورة الكورس'
                      : 'رفع صورة للكورس'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      handleUploadCourseImage(file, 'new');
                    }}
                  />
                </label>
                {courseImage && (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800">
                    <img
                      src={courseImage}
                      alt="معاينة صورة الكورس"
                      className="w-20 h-14 object-cover rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => setCourseImage('')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-300 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إزالة الصورة</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {courseFeedback && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-medium text-blue-900 dark:text-blue-200">
                {courseFeedback}
              </div>
            )}

            <button
              type="submit"
              disabled={courseSaving || uploadingKey === 'new-course-img'}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{courseSaving ? 'جاري الحفظ...' : 'إضافة الكورس'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  التحكم في الكورسات والحصص
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  حدّد الكورسات المراد حذفها بالضغط على «حذف»، ثم اضغط «حفظ التغييرات» لتنفيذ الحذف نهائيًا.
                </p>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                {allCourses.length} كورس
              </span>
            </div>

            {pendingDeleteCourseIds.length > 0 && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-red-900 dark:text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
                  <span>
                    تم تحديد {pendingDeleteCourseIds.length}{' '}
                    {pendingDeleteCourseIds.length === 1 ? 'كورس' : 'كورسات'} للحذف. اضغط «حفظ التغييرات» لتأكيد الحذف.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteCourseIds([])}
                    disabled={deletingCoursesSaving}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCourseDeletions}
                    disabled={deletingCoursesSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {deletingCoursesSaving
                        ? 'جاري حفظ التغييرات...'
                        : `حفظ التغييرات (${pendingDeleteCourseIds.length})`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {coursesActionNotice && (
              <div
                className={`p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                  coursesActionNotice.type === 'ok'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{coursesActionNotice.text}</span>
              </div>
            )}

            <div className="space-y-3">
              {allCourses.map((c) => {
                const lessonsCount = getCourseAllLessons(c).length;
                const courseEffectiveSec = getCourseEffectiveSeconds(c);
                const teacherInfo = resolveTeacherInfo(c.instructorId);
                const isPendingDelete = pendingDeleteCourseIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isPendingDelete
                        ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                        <ResilientImage
                          src={c.image || teacherInfo.image}
                          alt={c.title}
                          fallbackTitle={c.title}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                          <span>
                            {c.grade} · {normalizeSubjectCategory(c.category) || c.category} ·{' '}
                            <span className="tabular-nums">{lessonsCount} حصة</span>
                            {courseEffectiveSec > 0 && (
                              <>
                                {' · '}
                                <span className="tabular-nums">
                                  {formatArabicDurationFromSeconds(courseEffectiveSec)}
                                </span>
                              </>
                            )}{' '}
                            · <span className="tabular-nums">{c.priceEgp} ج.م</span>
                          </span>
                          {isPendingDelete && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded">
                              سيتم الحذف عند الحفظ
                            </span>
                          )}
                        </div>
                        <h3
                          className={`text-sm font-bold break-words ${
                            isPendingDelete
                              ? 'text-red-900 dark:text-red-200 line-through'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {c.title}
                        </h3>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          المدرس: <span className="font-semibold text-slate-800 dark:text-slate-200">{resolveTeacherLabel(c.instructorId)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openCourseEditor(c)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>التحكم في الحصص والمحتوى</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTogglePendingDeleteCourse(c.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                          isPendingDelete
                            ? 'text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                            : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/60'
                        }`}
                      >
                        {isPendingDelete ? (
                          <RotateCcw className="w-3.5 h-3.5" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>{isPendingDelete ? 'تراجع' : 'حذف'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'courses' && editingCourse && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة إلى قائمة الكورسات</span>
                </button>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white break-words">
                  التحكم في محتوى الكورس: {editingCourse.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 font-semibold tabular-nums">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      المدة الفعالة للكورس (من الحصص): {formatArabicDurationFromSeconds(editingCourseTotalSeconds)}
                    </span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                    {editingLessons.length} حصة
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveCourseEdits}
                disabled={editorSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>{editorSaving ? 'جاري الحفظ...' : 'حفظ جميع التعديلات'}</span>
              </button>
            </div>

            {editorFeedback && (
              <div className="p-3.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-200">
                {editorFeedback}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الكورس
                </label>
                <input
                  type="text"
                  value={editingCourse.title}
                  onChange={(e) =>
                    setEditingCourse({ ...editingCourse, title: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  المدرس المربوط بالكورس
                </label>
                <select
                  value={editingCourse.instructorId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const dynTeacher = teachers.find((t) => t.id === nextId);
                    const builtTeacher = INSTRUCTORS.find((i) => i.id === nextId);
                    const nextCategory = dynTeacher
                      ? normalizeSubjectCategory(dynTeacher.subject) || editingCourse.category
                      : editingCourse.category;
                    const nextImage = dynTeacher?.image || builtTeacher?.image || editingCourse.image;
                    setEditingCourse({
                      ...editingCourse,
                      instructorId: nextId,
                      category: nextCategory,
                      image: nextImage,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  {teachers.length === 0 && INSTRUCTORS.length === 0 && (
                    <option value="">أضف مدرسًا أولًا من تبويب إدارة المدرسين</option>
                  )}
                  {teachers.length > 0 && (
                    <optgroup label="المدرسون المضافون">
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.subject})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {INSTRUCTORS.length > 0 && (
                    <optgroup label="المدرسون الأساسيون">
                      {INSTRUCTORS.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  المادة الدراسية
                </label>
                <select
                  value={
                    normalizeSubjectCategory(editingCourse.category) || PLATFORM_SUBJECTS[0]
                  }
                  onChange={(e) =>
                    setEditingCourse({
                      ...editingCourse,
                      category: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  {PLATFORM_SUBJECTS.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    المرحلة الدراسية
                  </label>
                  <select
                    value={editingCourse.grade}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        grade: e.target.value as EducationalStage,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  >
                    {EDUCATIONAL_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    السعر (ج.م)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingCourse.priceEgp}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        priceEgp: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3 pt-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  صورة الكورس
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {editingCourse.image && (
                    <img
                      src={editingCourse.image}
                      alt={editingCourse.title}
                      className="w-24 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shrink-0"
                    />
                  )}
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                    <ImagePlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>
                      {uploadingKey === 'edit-course-img'
                        ? 'جاري رفع الصورة...'
                        : editingCourse.image
                        ? 'تغيير صورة الكورس'
                        : 'رفع صورة للكورس'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        handleUploadCourseImage(file, 'edit');
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Vertical Stack of Lessons */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  حصص الكورس بالترتيب ({editingLessons.length} حصة)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  الحصص مرتبة واحدة تحت الأخرى؛ داخل كل حصة يمكنك إضافة عدة فيديوهات (رفع أو لينك)، رفع ملفات، وتعديل امتحان الحصة.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddNewLesson}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة حصة جديدة</span>
              </button>
            </div>

            <div className="space-y-4">
              {editingLessons.map((lesson, lIdx) => {
                const isExpanded = expandedLessonId === lesson.id;
                const videos = lesson.videos ?? [];
                const attachments = lesson.attachments ?? [];
                const lessonEffectiveSec = getLessonEffectiveSeconds(lesson);
                const examQuestions =
                  lesson.examQuestions && lesson.examQuestions.length > 0
                    ? lesson.examQuestions
                    : [lesson.quiz];

                return (
                  <div
                    key={lesson.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    {/* Lesson Header Row */}
                    <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedLessonId(isExpanded ? null : lesson.id)
                        }
                        className="flex items-center gap-3 text-right flex-1 min-w-0 cursor-pointer"
                      >
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-700 text-white text-xs font-bold shrink-0 tabular-nums">
                          {lIdx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                            الحصة {lIdx + 1}
                          </div>
                          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white break-words">
                            {lesson.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            {lessonEffectiveSec > 0
                              ? `${formatArabicDurationFromSeconds(lessonEffectiveSec)} · `
                              : ''}
                            {videos.length} فيديو · {attachments.length} ملف ·{' '}
                            {examQuestions.length} سؤال امتحان
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
                        )}
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={lIdx === 0}
                          onClick={() => handleMoveLesson(lIdx, 'up')}
                          aria-label="نقل الحصة لأعلى"
                          className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={lIdx === editingLessons.length - 1}
                          onClick={() => handleMoveLesson(lIdx, 'down')}
                          aria-label="نقل الحصة لأسفل"
                          className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLesson(lesson.id)}
                          aria-label="حذف الحصة"
                          className="p-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 sm:p-6 space-y-6">
                        {/* Lesson Title & Strict Duration Binding */}
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              عنوان الحصة
                            </label>
                            {videos.length > 0 ? (
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-400 tabular-nums">
                                المدة الفعلية للحصة (مربوطة بفيديوهات الحصة):{' '}
                                {formatArabicDurationFromSeconds(lessonEffectiveSec)}
                              </span>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <label htmlFor={`les-dur-${lesson.id}`} className="font-medium">
                                  مدة الحصة (بالدقائق):
                                </label>
                                <input
                                  id={`les-dur-${lesson.id}`}
                                  type="number"
                                  min={0}
                                  value={lesson.durationMinutes || ''}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                                    updateLessonField(lesson.id, (les) => ({
                                      ...les,
                                      durationMinutes: val,
                                    }));
                                  }}
                                  className="w-20 px-2 py-1 text-xs font-mono text-center bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md"
                                />
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            value={lesson.title}
                            onChange={(e) =>
                              updateLessonField(lesson.id, (les) => ({
                                ...les,
                                title: e.target.value,
                              }))
                            }
                            className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                          />
                        </div>

                        {/* Section 1: Multiple Videos (Link + Upload) */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 bg-slate-50/40 dark:bg-slate-800/40">
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <Film className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                فيديوهات الحصة ({videos.length})
                              </h4>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              مدة الحصة تُحسب تلقائيًا من مجموع مدد هذه الفيديوهات
                            </span>
                          </div>

                          {videos.length > 0 && (
                            <div className="space-y-2">
                              {videos.map((vid, vIdx) => {
                                const ytMeta =
                                  vid.sourceType === 'link' ? parseYouTubeVideo(vid.url) : null;
                                const vidMinutesValue =
                                  vid.durationSeconds && vid.durationSeconds > 0
                                    ? Math.max(1, Math.round(vid.durationSeconds / 60))
                                    : '';
                                return (
                                  <div
                                    key={vid.id}
                                    className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      {ytMeta ? (
                                        <img
                                          src={ytMeta.thumbnailUrl}
                                          alt={vid.title}
                                          className="w-16 h-10 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                        />
                                      ) : (
                                        <Video className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words">
                                          {vIdx + 1}. {vid.title}{' '}
                                          <span className="text-xs font-normal text-blue-700 dark:text-blue-400">
                                            (
                                            {vid.sourceType === 'upload'
                                              ? 'فيديو مرفوع'
                                              : ytMeta
                                                ? 'يوتيوب · يدعم غير المدرج'
                                                : 'لينك فيديو'}
                                            )
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                          <div
                                            className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[220px] sm:max-w-xs"
                                            dir="ltr"
                                          >
                                            {vid.url.startsWith('data:')
                                              ? 'ملف فيديو محفوظ محليًا'
                                              : vid.url}
                                          </div>
                                          {vid.durationSeconds && vid.durationSeconds > 0 && (
                                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                              · {formatArabicDurationFromSeconds(vid.durationSeconds)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                        <span>المدة (د):</span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={vidMinutesValue}
                                          placeholder="تلقائي"
                                          aria-label={`مدة فيديو ${vid.title} بالدقائق`}
                                          onChange={(e) =>
                                            handleUpdateVideoDurationMinutes(
                                              lesson.id,
                                              vid.id,
                                              e.target.value
                                            )
                                          }
                                          className="w-16 px-2 py-1 text-xs font-mono text-center bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveVideo(lesson.id, vid.id)}
                                        className="px-2.5 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 shrink-0 cursor-pointer"
                                      >
                                        حذف الفيديو
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Add Video via Link */}
                            <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <Link2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                                <span>إضافة لينك فيديو (يوتيوب غير مدرج أو عادي)</span>
                              </div>
                              <input
                                type="text"
                                value={videoLinkTitleDraft[lesson.id] ?? ''}
                                onChange={(e) =>
                                  setVideoLinkTitleDraft((p) => ({
                                    ...p,
                                    [lesson.id]: e.target.value,
                                  }))
                                }
                                placeholder="عنوان الفيديو (مثال: الجزء الأول — الشرح)"
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg"
                              />
                              <input
                                type="text"
                                dir="ltr"
                                value={videoLinkUrlDraft[lesson.id] ?? ''}
                                onChange={(e) =>
                                  setVideoLinkUrlDraft((p) => ({
                                    ...p,
                                    [lesson.id]: e.target.value,
                                  }))
                                }
                                placeholder="https://youtu.be/... أو youtube.com/watch?v=... أو كود التضمين"
                                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={videoLinkDurationDraft[lesson.id] ?? ''}
                                  onChange={(e) =>
                                    setVideoLinkDurationDraft((p) => ({
                                      ...p,
                                      [lesson.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="المدة بالدقائق (اختياري — تُقرأ تلقائيًا ليوتيوب)"
                                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg"
                                />
                              </div>
                              {(videoLinkUrlDraft[lesson.id] || '').trim().length > 0 &&
                                parseYouTubeVideo(videoLinkUrlDraft[lesson.id] || '') && (
                                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded px-2.5 py-1">
                                    تم التعرف على فيديو يوتيوب بنجاح (يتم قراءة المدة تلقائيًا ويدعم غير المدرج).
                                  </div>
                                )}
                              <button
                                type="button"
                                disabled={probingVideoLessonId === lesson.id}
                                onClick={() => void handleAddVideoLink(lesson.id)}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>
                                  {probingVideoLessonId === lesson.id
                                    ? 'جاري قراءة مدة الفيديو...'
                                    : 'إضافة لينك الفيديو'}
                                </span>
                              </button>
                            </div>

                            {/* Upload Video from Device */}
                            <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
                              <div className="space-y-2.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                  <Upload className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                                  <span>رفع فيديو من الجهاز</span>
                                </div>
                                <input
                                  type="text"
                                  value={videoUploadTitleDraft[lesson.id] ?? ''}
                                  onChange={(e) =>
                                    setVideoUploadTitleDraft((p) => ({
                                      ...p,
                                      [lesson.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="عنوان الفيديو المرفوع (اختياري)"
                                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg"
                                />
                              </div>

                              <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                                <Upload className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                                <span>
                                  {uploadingKey === `vid-${lesson.id}`
                                    ? 'جاري رفع الفيديو...'
                                    : 'اختر ملف فيديو للرفع'}
                                </span>
                                <input
                                  type="file"
                                  accept="video/*"
                                  disabled={uploadingKey === `vid-${lesson.id}`}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    void handleUploadVideoFile(lesson.id, file);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Lesson Attachments (PDFs / Files for students) */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 bg-slate-50/40 dark:bg-slate-800/40">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                ملفات ومذكرات PDF للحصة ({attachments.length})
                              </h4>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              ملفات PDF تُفتح مباشرة داخل الحصة للطلاب مع إمكانية التحميل
                            </span>
                          </div>

                          {attachments.length > 0 && (
                            <div className="space-y-2">
                              {attachments.map((att) => {
                                const pdfMeta = resolvePdfAttachment(att);
                                return (
                                  <div
                                    key={att.id}
                                    className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
                                  >
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {pdfMeta.isPdf && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/70 border border-red-200 dark:border-red-800 rounded">
                                            PDF
                                          </span>
                                        )}
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words">
                                          {att.title}
                                        </span>
                                      </div>
                                      <div
                                        className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate"
                                        dir="ltr"
                                      >
                                        {att.fileName ||
                                          (att.url.startsWith('data:')
                                            ? 'ملف PDF مرفوع'
                                            : att.url)}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <a
                                        href={pdfMeta.openSrc}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60"
                                      >
                                        معاينة
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveAttachment(lesson.id, att.id)
                                        }
                                        className="px-2.5 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 cursor-pointer"
                                      >
                                        حذف الملف
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
                              <div className="space-y-2.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                  <FilePlus2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                                  <span>رفع ملف PDF للطلاب (ملزمة / كتاب / ملخص)</span>
                                </div>
                                <input
                                  type="text"
                                  value={fileUploadTitleDraft[lesson.id] ?? ''}
                                  onChange={(e) =>
                                    setFileUploadTitleDraft((p) => ({
                                      ...p,
                                      [lesson.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="اسم الملف للطلاب (مثال: ملزمة الشرح PDF)"
                                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg"
                                />
                              </div>

                              <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                                <Upload className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                                <span>
                                  {uploadingKey === `file-${lesson.id}`
                                    ? 'جاري رفع الملف...'
                                    : 'اختر ملف PDF أو مستند للرفع'}
                                </span>
                                <input
                                  type="file"
                                  accept="application/pdf,.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
                                  disabled={uploadingKey === `file-${lesson.id}`}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    void handleUploadAttachmentFile(lesson.id, file);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>

                            <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <Link2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                                <span>إضافة رابط ملف PDF أو Google Drive</span>
                              </div>
                              <input
                                type="text"
                                value={fileLinkTitleDraft[lesson.id] ?? ''}
                                onChange={(e) =>
                                  setFileLinkTitleDraft((p) => ({
                                    ...p,
                                    [lesson.id]: e.target.value,
                                  }))
                                }
                                placeholder="اسم الملف (مثال: ملخص الحصة PDF)"
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg"
                              />
                              <input
                                type="text"
                                dir="ltr"
                                value={fileLinkUrlDraft[lesson.id] ?? ''}
                                onChange={(e) =>
                                  setFileLinkUrlDraft((p) => ({
                                    ...p,
                                    [lesson.id]: e.target.value,
                                  }))
                                }
                                placeholder="https://.../notes.pdf أو رابط Google Drive"
                                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddAttachmentLink(lesson.id)}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 rounded-lg hover:bg-blue-700 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>إضافة رابط الملف</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Lesson Exam Directly Underneath */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 bg-slate-50/40 dark:bg-slate-800/40">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <HelpCircle className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                امتحان الحصة ({examQuestions.length} سؤال)
                              </h4>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddExamQuestion(lesson.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>إضافة سؤال جديد للامتحان</span>
                            </button>
                          </div>

                          <div className="space-y-4">
                            {examQuestions.map((q, qIdx) => {
                              const isUploadingImg =
                                uploadingKey === `quiz-img-${lesson.id}-${qIdx}`;
                              return (
                                <div
                                  key={qIdx}
                                  className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                                      السؤال {qIdx + 1}
                                    </span>
                                    {examQuestions.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteExamQuestion(lesson.id, qIdx)
                                        }
                                        className="text-xs font-semibold text-red-700 dark:text-red-300 hover:underline cursor-pointer"
                                      >
                                        حذف السؤال
                                      </button>
                                    )}
                                  </div>

                                  <div className="space-y-2.5">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                      <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                                        <ImagePlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                                        <span>
                                          {isUploadingImg
                                            ? 'جاري رفع صورة السؤال...'
                                            : q.questionImage
                                            ? 'تغيير صورة السؤال'
                                            : 'رفع صورة السؤال'}
                                        </span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          disabled={isUploadingImg}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            e.target.value = '';
                                            void handleUploadQuizQuestionImage(
                                              lesson.id,
                                              qIdx,
                                              file
                                            );
                                          }}
                                          className="hidden"
                                        />
                                      </label>

                                      {q.questionImage && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleUpdateExamQuestion(
                                              lesson.id,
                                              qIdx,
                                              (prevQ) => ({
                                                ...prevQ,
                                                questionImage: '',
                                              })
                                            )
                                          }
                                          className="px-2.5 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 cursor-pointer"
                                        >
                                          إزالة الصورة
                                        </button>
                                      )}
                                    </div>

                                    {q.questionImage && (
                                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 overflow-hidden">
                                        <img
                                          src={q.questionImage}
                                          alt={`صورة السؤال ${qIdx + 1}`}
                                          className="w-full max-h-72 object-contain mx-auto"
                                        />
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {q.options.map((opt, oIdx) => (
                                      <div
                                        key={oIdx}
                                        className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80"
                                      >
                                        <input
                                          type="radio"
                                          name={`correct-${lesson.id}-${qIdx}`}
                                          checked={q.correctIndex === oIdx}
                                          onChange={() =>
                                            handleUpdateExamQuestion(
                                              lesson.id,
                                              qIdx,
                                              (prevQ) => ({
                                                ...prevQ,
                                                correctIndex: oIdx,
                                              })
                                            )
                                          }
                                          title="تحديد كإجابة صحيحة"
                                          className="accent-blue-700 shrink-0 cursor-pointer"
                                        />
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) =>
                                            handleUpdateExamQuestion(
                                              lesson.id,
                                              qIdx,
                                              (prevQ) => ({
                                                ...prevQ,
                                                options: prevQ.options.map((item, idx) =>
                                                  idx === oIdx ? e.target.value : item
                                                ),
                                              })
                                            )
                                          }
                                          placeholder={`الاختيار ${oIdx + 1}`}
                                          className="flex-1 min-w-0 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-800 rounded"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleAddNewLesson}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة حصة جديدة تحتها</span>
              </button>

              <button
                type="button"
                onClick={handleSaveCourseEdits}
                disabled={editorSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{editorSaving ? 'جاري الحفظ...' : 'حفظ جميع التعديلات'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'low-attendance' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الطالب أو رقم الهاتف..."
                aria-label="بحث في طلاب الحضور المنخفض"
                className="w-full pr-10 pl-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="تصفية حسب المرحلة"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                <option value="جميع المراحل">جميع المراحل</option>
                {EDUCATIONAL_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              {filteredLowAttendanceRows.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    openAlertComposer(filteredLowAttendanceRows.map((r) => r.student))
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  <span>
                    إرسال تنبيه للجميع ({filteredLowAttendanceRows.length})
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  الطلاب أصحاب نسبة حضور أقل من 50%
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {filteredLowAttendanceRows.length} طالب
              </span>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                جاري تحميل بيانات الحضور...
              </div>
            ) : filteredLowAttendanceRows.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  لا يوجد طلاب بنسبة حضور أقل من 50% حاليًا
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  جميع الطلاب المطابقين للتصفية يحافظون على نسبة حضور 50% فأعلى.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLowAttendanceRows.map(({ student, attendance }) => {
                  const sentNotifs = student.notifications ?? [];
                  const unreadCount = sentNotifs.filter((n) => !n.read).length;
                  return (
                    <div
                      key={student.id}
                      className="p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {student.studentName}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-bold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded tabular-nums">
                            نسبة الحضور: {attendance.rate}%
                          </span>
                          {student.isBlocked && (
                            <span className="px-2 py-0.5 text-[11px] font-semibold bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 rounded">
                              محظور
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-mono tabular-nums" dir="ltr">
                            {student.studentPhone}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{student.stage}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            سمع {attendance.watchedCount} من {attendance.totalLessons} حصة
                          </span>
                        </div>

                        <div className="w-full max-w-xs h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-600"
                            style={{ width: `${attendance.rate}%` }}
                          />
                        </div>

                        {sentNotifs.length > 0 && (
                          <div className="text-[11px] text-blue-700 dark:text-blue-400 font-medium tabular-nums">
                            تم إرسال {sentNotifs.length} تنبيه
                            {unreadCount > 0 ? ` (${unreadCount} لم يُقرأ بعد)` : ' (تم الاطلاع)'}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openAlertComposer([student])}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>إرسال تنبيه</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="space-y-5">
          {approvalFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 ${
                approvalFeedback.type === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{approvalFeedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setApprovalFeedback(null)}
                aria-label="إغلاق التنبيه"
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-700 overflow-hidden shadow-xs">
            <div className="px-5 sm:px-6 py-4 bg-amber-50/90 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    الموافقات على تسجيل الطلاب الجدد وتأكيد بيانات ولي الأمر
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    راجع بيانات الطالب واتصل بولي الأمر لتأكيد البيانات قبل الضغط على «موافقة وتفعيل الحساب».
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 text-xs font-bold bg-amber-100 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-md tabular-nums">
                {pendingStudents.length} طلب بانتظار المراجعة
              </span>
            </div>

            {pendingStudents.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <UserCheck className="w-9 h-9 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  لا توجد طلبات تسجيل جديدة معلقة حاليًا
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  أي طالب يسجل حسابًا جديدًا سيظهر هنا بجميع بياناته وبيانات ولي الأمر للاتصال به وتأكيد الحساب.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingStudents.map((stu) => {
                  const isBusy = approvalActionLoadingId === stu.id;
                  return (
                    <div
                      key={stu.id}
                      className="p-5 sm:p-6 flex flex-col gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-base font-bold text-slate-900 dark:text-white">
                            {stu.studentName}
                          </span>
                          <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded">
                            بانتظار مكالمة التأكيد والموافقة
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            تاريخ الطلب: {new Date(stu.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-xs">
                        <div>
                          <div className="text-slate-500 dark:text-slate-400">اسم الطالب ورقم هاتفه</div>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5">{stu.studentName}</div>
                          <div className="font-mono font-bold text-blue-700 dark:text-blue-400 mt-0.5" dir="ltr">
                            {stu.studentPhone}
                          </div>
                        </div>

                        <div>
                          <div className="text-slate-500 dark:text-slate-400">بيانات ولي الأمر (للاتصال والتأكيد)</div>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5">{stu.parentName}</div>
                          <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5" dir="ltr">
                            {stu.parentPhone}
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                            مهنة ولي الأمر: <span className="font-semibold">{stu.parentJob || 'غير محددة'}</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-slate-500 dark:text-slate-400">المرحلة الدراسية واسم الأم</div>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                            {stu.stage} ({stu.specializationType}: {stu.specialization})
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                            اسم الأم: <span className="font-semibold">{stu.motherName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`tel:${stu.parentPhone}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>اتصال بولي الأمر لتأكيد البيانات ({stu.parentPhone})</span>
                          </a>
                          <a
                            href={formatWhatsappUrl(
                              stu.parentPhone,
                              `أهلاً بحضرتك يا أستاذ ${stu.parentName}، مع حضرتك إدارة منصة Ezz Academy لتأكيد تسجيل حساب الطالب ${stu.studentName} بالمنصة.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب ولي الأمر</span>
                          </a>
                          <a
                            href={`tel:${stu.studentPhone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>اتصال بالطالب</span>
                          </a>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSetApprovalStatus(stu, 'approved')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-60 cursor-pointer"
                          >
                            <UserCheck className="w-4 h-4" />
                            <span>موافقة وتفعيل الحساب</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSetApprovalStatus(stu, 'rejected')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors disabled:opacity-60 cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>رفض الطلب</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDeleteStudentRequest(stu)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors disabled:opacity-60 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <>
          {approvalFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 ${
                approvalFeedback.type === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{approvalFeedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setApprovalFeedback(null)}
                aria-label="إغلاق التنبيه"
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {pendingStudents.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-amber-300 dark:border-amber-700 overflow-hidden shadow-xs">
              <div className="px-5 sm:px-6 py-4 bg-amber-50/90 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0" />
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      طلبات إنشاء الحسابات الجديدة (بانتظار موافقتك)
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      تأكد من بيانات الطالب واتصل بولي الأمر قبل الموافقة على الحساب.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('approvals')}
                    className="px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-100 bg-amber-200/80 dark:bg-amber-900/70 rounded-lg hover:bg-amber-300 cursor-pointer"
                  >
                    فتح صفحة الموافقات الكاملة ({pendingStudents.length})
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingStudents.map((stu) => {
                  const isBusy = approvalActionLoadingId === stu.id;
                  return (
                    <div
                      key={stu.id}
                      className="p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {stu.studentName}
                          </span>
                          <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded">
                            بانتظار الموافقة
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <span>
                            هاتف الطالب:{' '}
                            <span className="font-mono font-semibold text-slate-900 dark:text-slate-200" dir="ltr">
                              {stu.studentPhone}
                            </span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {stu.stage} ({stu.specializationType}: {stu.specialization})
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            ولي الأمر: <strong className="text-slate-800 dark:text-slate-200">{stu.parentName}</strong> (
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400" dir="ltr">
                              {stu.parentPhone}
                            </span>
                            )
                          </span>
                          {stu.parentJob && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>المهنة: {stu.parentJob}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>اسم الأم: {stu.motherName}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <a
                          href={`tel:${stu.parentPhone}`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>اتصال بولي الأمر</span>
                        </a>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSetApprovalStatus(stu, 'approved')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-60 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>موافقة وتفعيل الحساب</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSetApprovalStatus(stu, 'rejected')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors disabled:opacity-60 cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>رفض الطلب</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDeleteStudentRequest(stu)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors disabled:opacity-60 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {lowAttendanceRows.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-amber-950 dark:text-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  يوجد{' '}
                  <span className="font-bold tabular-nums">{lowAttendanceRows.length}</span>{' '}
                  طالب لديهم نسبة حضور أقل من 50% ويحتاجون لمتابعة.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('low-attendance')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>عرض القائمة وإرسال تنبيه</span>
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[220px]">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  dir="ltr"
                  value={phoneSearchQuery}
                  onChange={(e) => setPhoneSearchQuery(e.target.value)}
                  placeholder="بحث سريع برقم تليفون الطالب أو ولي الأمر..."
                  aria-label="بحث برقم التليفون"
                  className="w-full pr-10 pl-3 py-2 text-sm font-mono bg-blue-50/50 dark:bg-slate-800/90 border border-blue-300 dark:border-blue-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-right"
                />
              </div>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="أو ابحث بالاسم أو نوع الجهاز/المتصفح..."
                  aria-label="بحث في الطلاب"
                  className="w-full pr-10 pl-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setMultiDeviceOnly((prev) => !prev)}
                aria-pressed={multiDeviceOnly}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  multiDeviceOnly
                    ? 'bg-amber-600 border-amber-600 text-white'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>تعدد الأجهزة فقط</span>
                <span
                  className={`px-1.5 py-0.5 text-[11px] rounded tabular-nums ${
                    multiDeviceOnly
                      ? 'bg-amber-700 text-white'
                      : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {multiDeviceStudentsCount}
                </span>
              </button>

              <select
                aria-label="تصفية حسب المرحلة"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                <option value="جميع المراحل">جميع المراحل</option>
                {EDUCATIONAL_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-sm text-red-900 dark:text-red-200">
              {errorMsg}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">سجل بيانات الطلاب الكامل</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void loadStudents()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>تحديث القائمة</span>
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {filteredStudents.length} طالب
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                جاري تحميل بيانات الطلاب...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {students.length === 0
                    ? 'لا يوجد طلاب مسجلون حتى الآن'
                    : 'لا يوجد طلاب مطابقون لبحثك الحالي.'}
                </div>
                {students.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    أي طالب يسجل حسابه أو يدخل المنصة سيظهر اسمه وبياناته هنا تلقائيًا.
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        اسم الطالب ورقمه
                      </th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        ولي الأمر ورقمه
                      </th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">اسم الأم</th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        المرحلة والشعبة/المسار
                      </th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        الحضور والإنجاز
                      </th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        الأجهزة والمتصفح
                      </th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStudents.map((stu) => {
                      const autoAtt = computeStudentAttendance(stu, allCourses);
                      const attendedDays = getDistinctAttendanceDays(stu.attendanceDates);
                      const studentDevices = getStudentDevicesDisplay(stu);
                      const activity = computeStudentActivityDetails(stu);
                      return (
                        <tr key={stu.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 align-top">
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">{stu.studentName}</span>
                              {stu.approvalStatus === 'pending' && (
                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 rounded">
                                  بانتظار الموافقة
                                </span>
                              )}
                              {stu.approvalStatus === 'rejected' && (
                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 rounded">
                                  مرفوض
                                </span>
                              )}
                              {stu.isBlocked && (
                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 rounded">
                                  محظور
                                </span>
                              )}
                              {!stu.isBlocked && studentDevices.length === 2 && (
                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 rounded">
                                  جهازين (مسموح)
                                </span>
                              )}
                              {stu.autoBlockExempt && (
                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 rounded">
                                  مستثنى من الحظر التلقائي
                                </span>
                              )}
                            </div>
                            <div
                              className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums"
                              dir="ltr"
                            >
                              {stu.studentPhone}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium text-slate-800 dark:text-slate-200">{stu.parentName}</div>
                            <div
                              className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums"
                              dir="ltr"
                            >
                              {stu.parentPhone}
                            </div>
                            {stu.parentJob && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                المهنة: {stu.parentJob}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300">{stu.motherName}</td>
                          <td className="py-4 px-4">
                            <div className="font-medium text-slate-900 dark:text-white">{stu.stage}</div>
                            <div className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                              {stu.specializationType}: {stu.specialization}
                            </div>
                          </td>
                          <td className="py-4 px-4 tabular-nums min-w-[210px]">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              حضور {autoAtt.rate}%
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                                فتح {activity.openedLessons.length} حصة
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
                                سلّم {activity.submittedExams.length} امتحان
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
                                لم يفتح {activity.unopenedLessons.length}
                              </span>
                            </div>
                            {activity.lastOpenedLesson && (
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 truncate max-w-[220px]" title={activity.lastOpenedLesson.lessonTitle}>
                                آخر حصة: {activity.lastOpenedLesson.lessonTitle}
                              </div>
                            )}
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              المحفظة: {stu.walletBalance ?? 0} ج.م
                            </div>
                            {attendedDays.length > 0 && (
                              <div className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                                آخر حضور: {formatAttendanceDateArabic(attendedDays[0])} ({attendedDays.length} يوم)
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 min-w-[210px]">
                            {studentDevices.length === 0 ? (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                لم يُسجّل جهاز بعد
                              </span>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                                    {studentDevices.length} / 2 جهاز مسموح
                                  </span>
                                  {studentDevices.length > 2 && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 rounded">
                                      تجاوز الحد
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  {studentDevices.slice(0, 2).map((dev) => (
                                    <div
                                      key={dev.id}
                                      className="inline-flex items-center gap-1.5 w-full text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1"
                                    >
                                      <span className="text-blue-700 dark:text-blue-400 shrink-0">
                                        {renderDeviceIcon(dev.deviceType)}
                                      </span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-100 shrink-0">
                                        {dev.deviceType}
                                      </span>
                                      <span className="text-slate-400" aria-hidden="true">
                                        ·
                                      </span>
                                      <span className="truncate" title={dev.label}>
                                        {dev.os !== 'غير محدد' ? `${dev.os} · ` : ''}
                                        {dev.browser}
                                      </span>
                                    </div>
                                  ))}
                                  {studentDevices.length > 2 && (
                                    <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 tabular-nums">
                                      +{studentDevices.length - 2} أجهزة أخرى
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {stu.approvalStatus === 'pending' && (
                                <button
                                  type="button"
                                  disabled={approvalActionLoadingId === stu.id}
                                  onClick={() => void handleSetApprovalStatus(stu, 'approved')}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
                                >
                                  موافقة
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openStudentFollowUp(stu)}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                متابعة وتعديل
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sup-student-detail-title"
        >
          <div className="min-h-full flex items-start sm:items-center justify-center py-3 sm:py-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-4 sm:p-7 shadow-2xl space-y-5 overflow-x-hidden">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="min-w-0 flex-1">
                  <h3
                    id="sup-student-detail-title"
                    className="text-base sm:text-lg font-bold text-slate-900 dark:text-white break-words"
                  >
                    ملف متابعة الطالب: {selectedStudent.studentName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">
                    {selectedStudent.stage} · {selectedStudent.specializationType}:{' '}
                    {selectedStudent.specialization}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  aria-label="إغلاق"
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 text-xs">
                <div className="min-w-0">
                  <span className="text-slate-500 dark:text-slate-400">رقم الطالب:</span>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-mono font-semibold text-slate-900 dark:text-white break-all" dir="ltr">
                      {selectedStudent.studentPhone}
                    </span>
                    <a
                      href={`tel:${selectedStudent.studentPhone}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-950/60 rounded hover:bg-blue-200"
                    >
                      <Phone className="w-3 h-3" />
                      <span>اتصال</span>
                    </a>
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500 dark:text-slate-400">اسم ولي الأمر ورقمه:</span>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5 break-words flex flex-wrap items-center gap-2">
                    <span>
                      {selectedStudent.parentName} —{' '}
                      <span className="font-mono inline-block" dir="ltr">
                        {selectedStudent.parentPhone}
                      </span>
                    </span>
                    <a
                      href={`tel:${selectedStudent.parentPhone}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 rounded hover:bg-emerald-200"
                    >
                      <Phone className="w-3 h-3" />
                      <span>اتصال بولي الأمر</span>
                    </a>
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500 dark:text-slate-400">مهنة ولي الأمر:</span>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5 break-words">
                    {selectedStudent.parentJob || 'غير محددة'}
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500 dark:text-slate-400">اسم الأم:</span>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5 break-words">
                    {selectedStudent.motherName}
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500 dark:text-slate-400">تاريخ التسجيل:</span>
                  <div className="font-mono text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {new Date(selectedStudent.createdAt).toLocaleDateString('ar-EG')}
                  </div>
                </div>
              </div>

              {(() => {
                const activity = computeStudentActivityDetails(selectedStudent);
                return (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                        <span>متابعة الحصص والامتحانات التفصيلية للطالب</span>
                      </h4>
                      {activity.lastOpenedLesson && (
                        <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md">
                          آخر حصة فتحها: {activity.lastOpenedLesson.lessonTitle}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-white dark:bg-slate-900 p-3 space-y-2">
                        <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                          <span>الحصص التي فتحها الطالب</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 tabular-nums">
                            {activity.openedLessons.length}
                          </span>
                        </div>
                        {activity.openedLessons.length === 0 ? (
                          <p className="text-slate-400 dark:text-slate-500 text-[11px]">
                            لم يفتح الطالب أي حصة حتى الآن.
                          </p>
                        ) : (
                          <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {activity.openedLessons.map((item) => (
                              <li
                                key={`${item.courseTitle}-${item.lessonId}`}
                                className="p-1.5 rounded bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60"
                              >
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {item.lessonTitle}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-1 mt-0.5">
                                  <span className="truncate">{item.courseTitle}</span>
                                  {item.openedDate && (
                                    <span className="font-mono shrink-0" dir="ltr">
                                      {item.openedDate}
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="rounded-lg border border-blue-200 dark:border-blue-800/80 bg-white dark:bg-slate-900 p-3 space-y-2">
                        <div className="flex items-center justify-between font-bold text-blue-800 dark:text-blue-300">
                          <span>الامتحانات التي سلّمها</span>
                          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 tabular-nums">
                            {activity.submittedExams.length}
                          </span>
                        </div>
                        {activity.submittedExams.length === 0 ? (
                          <p className="text-slate-400 dark:text-slate-500 text-[11px]">
                            لم يقم الطالب بتسليم أي امتحان بعد.
                          </p>
                        ) : (
                          <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {activity.submittedExams.map((ex) => (
                              <li
                                key={ex.lessonId}
                                className="p-1.5 rounded bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold text-slate-900 dark:text-white truncate">
                                    {ex.lessonTitle}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums shrink-0 ${
                                      ex.passed
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    }`}
                                  >
                                    {ex.scorePercent}% ({ex.correctCount}/{ex.totalQuestions})
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {ex.courseTitle}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="rounded-lg border border-amber-200 dark:border-amber-800/80 bg-white dark:bg-slate-900 p-3 space-y-2">
                        <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-300">
                          <span>الحصص التي لم يفتحها بعد</span>
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 tabular-nums">
                            {activity.unopenedLessons.length}
                          </span>
                        </div>
                        {activity.unopenedLessons.length === 0 ? (
                          <p className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                            ممتاز! الطالب فتح جميع الحصص المتاحة له.
                          </p>
                        ) : (
                          <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {activity.unopenedLessons.map((item) => (
                              <li
                                key={`${item.courseTitle}-${item.lessonId}`}
                                className="p-1.5 rounded bg-amber-50/50 dark:bg-amber-950/25 border border-amber-100 dark:border-amber-900/50"
                              >
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {item.lessonTitle}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {item.courseTitle}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleSaveFollowUp} className="space-y-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400 shrink-0">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          الأجهزة والمتصفحات الفاتحة للحساب
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            {resetDevicesFlag ? 0 : editDevicesCount} جهاز مسجّل
                          </span>
                          {!resetDevicesFlag && editDevicesCount > 1 && (
                            <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded">
                              تنبيه: أكثر من جهاز
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {editDevicesCount > 0 && !resetDevicesFlag && (
                      <button
                        type="button"
                        onClick={() => setResetDevicesFlag(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>تصفير الأجهزة</span>
                      </button>
                    )}
                  </div>

                  {resetDevicesFlag ? (
                    <div className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                      سيتم مسح جميع الأجهزة المسجلة عند الضغط على «حفظ التعديلات».
                    </div>
                  ) : (
                    (() => {
                      const devices = getStudentDevicesDisplay(selectedStudent);
                      if (devices.length === 0) {
                        return (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            لم يتم تسجيل دخول من أي جهاز حتى الآن.
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2 pt-1">
                          {devices.map((dev, index) => (
                            <div
                              key={dev.id}
                              className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 shrink-0">
                                  {renderDeviceIcon(dev.deviceType, 'w-4 h-4')}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
                                    <span>
                                      جهاز {index + 1}: {dev.deviceType}
                                    </span>
                                    {dev.os !== 'غير محدد' && (
                                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                                        ({dev.os})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 mt-0.5">
                                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{dev.browser}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-left sm:text-right text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                                <div className="font-mono" dir="ltr">
                                  #{dev.id.slice(-6)}
                                </div>
                                {dev.lastSeenAt && (
                                  <div className="tabular-nums mt-0.5">
                                    آخر نشاط:{' '}
                                    {new Date(dev.lastSeenAt).toLocaleString('ar-EG', {
                                      dateStyle: 'short',
                                      timeStyle: 'short',
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>

                {(() => {
                  const status = selectedStudent.approvalStatus ?? 'approved';
                  const isBusy = approvalActionLoadingId === selectedStudent.id;
                  return (
                    <div
                      className={`rounded-xl border p-4 space-y-3 ${
                        status === 'pending'
                          ? 'border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/40'
                          : status === 'rejected'
                            ? 'border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40'
                            : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2.5 rounded-lg shrink-0 ${
                              status === 'pending'
                                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                : status === 'rejected'
                                  ? 'bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {status === 'pending' ? (
                              <Clock className="w-5 h-5" />
                            ) : status === 'rejected' ? (
                              <UserX className="w-5 h-5" />
                            ) : (
                              <UserCheck className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              موافقة المشرف على إنشاء الحساب
                            </div>
                            <div
                              className={`text-sm font-bold ${
                                status === 'pending'
                                  ? 'text-amber-900 dark:text-amber-200'
                                  : status === 'rejected'
                                    ? 'text-red-700 dark:text-red-300'
                                    : 'text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {status === 'pending'
                                ? 'طلب جديد بانتظار الموافقة (الدخول غير متاح بعد)'
                                : status === 'rejected'
                                  ? 'تم رفض طلب إنشاء الحساب'
                                  : 'تمت الموافقة وتفعيل الحساب'}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {status !== 'approved' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleSetApprovalStatus(selectedStudent, 'approved')
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-60 cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>موافقة وتفعيل الحساب</span>
                            </button>
                          )}
                          {status === 'pending' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleSetApprovalStatus(selectedStudent, 'rejected')
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors disabled:opacity-60 cursor-pointer"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>رفض الطلب</span>
                            </button>
                          )}
                          {status === 'approved' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleSetApprovalStatus(selectedStudent, 'pending')
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors disabled:opacity-60 cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>إلغاء التفعيل</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDeleteStudentRequest(selectedStudent)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors disabled:opacity-60 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف الحساب</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div
                  className={`rounded-xl border p-4 space-y-3 ${
                    editBlocked
                      ? 'border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-lg shrink-0 ${
                          editBlocked ? 'bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300' : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        <Ban className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">حالة الحساب</div>
                        <div
                          className={`text-sm font-bold ${
                            editBlocked ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {editBlocked ? 'الحساب محظور (بلوك)' : 'الحساب نشط'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={instantActionLoading}
                      onClick={() => handleToggleBlockImmediate(!editBlocked)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-60 cursor-pointer ${
                        editBlocked
                          ? 'bg-emerald-700 border-emerald-700 text-white hover:bg-emerald-800'
                          : 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {editBlocked ? (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Ban className="w-3.5 h-3.5" />
                      )}
                      <span>{editBlocked ? 'إيقاف الحظر' : 'عمل بلوك للحساب'}</span>
                    </button>
                  </div>
                  {editBlocked && selectedStudent.blockReason && (
                    <div className="text-xs font-medium text-red-800 dark:text-red-200 bg-white/80 dark:bg-slate-900/80 border border-red-200 dark:border-red-800 rounded-lg p-2.5">
                      سبب الحظر: {selectedStudent.blockReason}
                    </div>
                  )}
                </div>

                <div
                  className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
                    editAutoBlockExempt
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30'
                      : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2.5 rounded-lg shrink-0 ${
                        editAutoBlockExempt
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        نظام الحظر التلقائي عند تعدد الأجهزة
                      </div>
                      <div
                        className={`text-sm font-bold ${
                          editAutoBlockExempt
                            ? 'text-emerald-800 dark:text-emerald-300'
                            : 'text-amber-900 dark:text-amber-200'
                        }`}
                      >
                        {editAutoBlockExempt
                          ? 'موقوف لهذا الطالب (مستثنى من الحظر التلقائي)'
                          : 'مفعّل (إنذار عند جهازين وحظر تلقائي عند ٣ أجهزة)'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={instantActionLoading}
                    onClick={handleToggleAutoBlockExemptImmediate}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-60 cursor-pointer shrink-0 ${
                      editAutoBlockExempt
                        ? 'bg-slate-800 dark:bg-slate-700 border-slate-800 dark:border-slate-700 text-white hover:bg-slate-900'
                        : 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>
                      {editAutoBlockExempt ? 'تفعيل الحظر التلقائي' : 'إيقاف الحظر التلقائي'}
                    </span>
                  </button>
                </div>

                {followUpActionNotice && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>{followUpActionNotice}</span>
                  </div>
                )}

                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                      <Wallet className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                      <span>إضافة فلوس لمحفظة الحساب</span>
                    </div>
                    <div className="text-xs font-semibold text-blue-800 dark:text-blue-300 tabular-nums">
                      الرصيد الحالي: {selectedStudent.walletBalance ?? 0} ج.م
                      {(Number(editWalletAdd) || 0) > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400 mr-1.5">
                          ← الإجمالي بعد الحفظ:{' '}
                          {(selectedStudent.walletBalance ?? 0) +
                            Math.max(0, Math.round(Number(editWalletAdd) || 0))}{' '}
                          ج.م
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      id="sup-wallet-add-input"
                      type="number"
                      min={0}
                      step={10}
                      value={editWalletAdd}
                      onChange={(e) => setEditWalletAdd(e.target.value)}
                      placeholder="اكتب المبلغ المراد إضافته بالجنيه..."
                      className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 tabular-nums"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      {[100, 250, 500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() =>
                            setEditWalletAdd((prev) =>
                              String(Math.max(0, Math.round(Number(prev) || 0)) + amt)
                            )
                          }
                          className="px-2.5 py-2 text-xs font-semibold text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 tabular-nums cursor-pointer"
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {savedNotice && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>تم حفظ التعديلات وتحديث حساب الطالب بنجاح.</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    إغلاق
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {alertTargets && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sup-alert-modal-title"
        >
          <div className="min-h-full flex items-center justify-center py-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      id="sup-alert-modal-title"
                      className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                    >
                      إرسال تنبيه داخل المنصة
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {alertTargets.length === 1
                        ? `إلى الطالب: ${alertTargets[0].studentName}`
                        : `إرسال جماعي إلى ${alertTargets.length} طالب (نسبة الحضور < 50%)`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAlertTargets(null)}
                  aria-label="إغلاق"
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSendAlertsSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="alert-title-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    عنوان التنبيه
                  </label>
                  <input
                    id="alert-title-input"
                    type="text"
                    required
                    maxLength={120}
                    value={alertTitle}
                    onChange={(e) => setAlertTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label
                    htmlFor="alert-msg-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    نص الرسالة للطالب
                  </label>
                  <textarea
                    id="alert-msg-input"
                    rows={4}
                    required
                    maxLength={500}
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                {alertFeedback && (
                  <div
                    className={`p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                      alertFeedback.type === 'ok'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                        : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                    }`}
                  >
                    {alertFeedback.type === 'ok' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    )}
                    <span>{alertFeedback.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setAlertTargets(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    إغلاق
                  </button>
                  <button
                    type="submit"
                    disabled={alertSending}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    <span>{alertSending ? 'جاري الإرسال...' : 'إرسال التنبيه الآن'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {editingTeacher && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-teacher-modal-title"
        >
          <div className="min-h-full flex items-center justify-center py-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 shrink-0">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      id="edit-teacher-modal-title"
                      className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                    >
                      تعديل بيانات المدرس: {editingTeacher.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      تحديث اسم المدرس، مادته، صورته، تليجرام الدعم، والمراحل.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  aria-label="إغلاق"
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTeacherEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المدرس
                  </label>
                  <input
                    type="text"
                    required
                    value={editTeacherName}
                    onChange={(e) => setEditTeacherName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    المادة الدراسية
                  </label>
                  <select
                    value={editTeacherSubject}
                    onChange={(e) => setEditTeacherSubject(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  >
                    {PLATFORM_SUBJECTS.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    رابط أو صورة المدرس
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={editTeacherImage}
                    onChange={(e) => setEditTeacherImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  {editTeacherImage && (
                    <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                      <img src={editTeacherImage} alt="معاينة" className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    تليجرام الدعم العلمي للمدرس
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editTeacherTelegram}
                    onChange={(e) => setEditTeacherTelegram(e.target.value)}
                    placeholder="01012345678 أو @username"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    المراحل الدراسية
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {EDUCATIONAL_STAGES.map((stage) => {
                      const selected = editTeacherGrades.includes(stage);
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => {
                            setEditTeacherGrades((prev) =>
                              selected ? prev.filter((s) => s !== stage) : [...prev, stage]
                            );
                          }}
                          className={`px-3 py-2 text-xs rounded-lg border text-right transition-colors cursor-pointer ${
                            selected
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-semibold'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {stage}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {editTeacherFeedback && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-medium text-blue-900 dark:text-blue-200">
                    {editTeacherFeedback}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingTeacher(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    إغلاق
                  </button>
                  <button
                    type="submit"
                    disabled={editTeacherSaving}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editTeacherSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
