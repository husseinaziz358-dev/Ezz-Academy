import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Film,
  HelpCircle,
  Lock,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  StickyNote,
  Video,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  Course,
  formatArabicDurationFromSeconds,
  getCourseAllLessons,
  getCourseEffectiveSeconds,
  getInstructorById,
  getLessonEffectiveSeconds,
  Lesson,
  LessonVideo,
  QuizQuestion,
} from '../data/academyData';
import { LessonExamResult } from '../types/student';
import { CertificateModal } from './CertificateModal';
import { CustomYouTubePlayer } from './CustomYouTubePlayer';
import { ResilientImage } from './ResilientImage';
import { formatAttendanceDateArabic, getTodayDateKey } from '../utils/attendance';
import {
  extractCleanVideoUrl,
  parseYouTubeVideo,
  readYouTubeDurationSeconds,
  resolvePdfAttachment,
} from '../utils/mediaHelpers';

interface ClassroomViewProps {
  course: Course;
  instructorName?: string;
  instructorImage?: string;
  isUnlocked: boolean;
  isSupervisor?: boolean;
  completedLessonIds: string[];
  attendanceDates?: Record<string, string>;
  notesByLesson: Record<string, string>;
  quizAnswers: Record<string, number>;
  examResults?: Record<string, LessonExamResult>;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  onUpdateStudentName: (name: string) => void;
  onToggleLessonComplete: (lessonId: string) => void;
  onMarkLessonComplete?: (lessonId: string) => void;
  onRecordLessonAttendance?: (lessonId: string, dateKey: string) => void;
  onSaveNote: (lessonId: string, note: string) => void;
  onRecordQuizAnswer: (lessonId: string, optionIndex: number) => void;
  onSubmitLessonExam?: (
    lessonId: string,
    answers: Record<string, number>,
    result: LessonExamResult
  ) => void;
  onBackToCatalog: () => void;
  onRequireLogin?: () => void;
  isStudent?: boolean;
  walletBalance?: number;
  onPurchaseCourse?: () => Promise<void> | void;
  purchaseFeedback?: { type: 'ok' | 'error'; text: string } | null;
}

function resolveVideoEmbed(
  url: string,
  sourceType: LessonVideo['sourceType']
):
  | { kind: 'youtube'; videoId: string; startSeconds: number }
  | { kind: 'iframe'; src: string; watchUrl: string }
  | { kind: 'video'; src: string }
  | { kind: 'external'; src: string } {
  const trimmed = extractCleanVideoUrl(url);
  if (
    sourceType === 'upload' ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('blob:') ||
    /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(trimmed)
  ) {
    return { kind: 'video', src: trimmed };
  }

  const yt = parseYouTubeVideo(trimmed);
  if (yt) {
    return {
      kind: 'youtube',
      videoId: yt.id,
      startSeconds: yt.startSeconds,
    };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) {
        return {
          kind: 'iframe',
          src: `https://player.vimeo.com/video/${id}`,
          watchUrl: trimmed,
        };
      }
    }

    if (host === 'drive.google.com') {
      const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      const idParam = parsed.searchParams.get('id');
      const driveId = match?.[1] || idParam;
      if (driveId) {
        return {
          kind: 'iframe',
          src: `https://drive.google.com/file/d/${driveId}/preview`,
          watchUrl: `https://drive.google.com/file/d/${driveId}/view`,
        };
      }
    }
  } catch {
    // Fallback below
  }

  return { kind: 'external', src: trimmed };
}

function EmbeddedPdfViewer({
  src,
  title,
  openSrc,
  downloadSrc,
  fileName,
}: {
  src: string;
  title: string;
  openSrc: string;
  downloadSrc: string;
  fileName?: string;
}) {
  const [blobSrc, setBlobSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src.startsWith('data:application/pdf')) {
      setBlobSrc(null);
      return;
    }

    let revoked = false;
    let objectUrl: string | null = null;
    try {
      const commaIdx = src.indexOf(',');
      if (commaIdx > 0) {
        const base64Part = src.slice(commaIdx + 1);
        const binary = window.atob(base64Part);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        if (!revoked) {
          setBlobSrc(objectUrl);
        }
      }
    } catch {
      setBlobSrc(null);
    }

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const frameUrl = blobSrc || src;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5 w-full">
      <div className="w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950">
        <iframe
          key={frameUrl}
          src={frameUrl}
          title={title}
          className="w-full h-[500px] sm:h-[660px] border-0 bg-white"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
        <span>
          إذا لم يظهر الملف داخل الإطار على متصفح الهاتف، يمكنك فتحه مباشرة أو تحميله.
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={openSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>فتح في نافذة مستقلة</span>
          </a>
          <a
            href={downloadSrc}
            download={fileName || `${title}.pdf`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تحميل PDF</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function getExamAnswerKey(lessonId: string, qIndex: number): string {
  return qIndex === 0 ? lessonId : `${lessonId}__q${qIndex}`;
}

function getRealExamQuestions(lesson: Lesson): QuizQuestion[] {
  const candidates =
    lesson.examQuestions && lesson.examQuestions.length > 0
      ? lesson.examQuestions
      : lesson.quiz
        ? [lesson.quiz]
        : [];
  return candidates.filter(
    (q) =>
      Boolean(q.question && q.question.trim().length > 0) ||
      Boolean(q.questionImage && q.questionImage.trim().length > 0)
  );
}

function lessonHasExam(lesson: Lesson): boolean {
  return getRealExamQuestions(lesson).length > 0;
}

function formatSecondsDigital(sec: number): string {
  if (!sec || sec <= 0) return '00:00';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = Math.floor(sec % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function ClassroomView({
  course,
  instructorName,
  instructorImage,
  isUnlocked,
  isSupervisor = false,
  completedLessonIds,
  attendanceDates = {},
  notesByLesson,
  quizAnswers,
  examResults = {},
  studentName,
  studentEmail,
  studentPhone,
  onUpdateStudentName,
  onToggleLessonComplete,
  onMarkLessonComplete,
  onRecordLessonAttendance,
  onSaveNote,
  onRecordQuizAnswer,
  onSubmitLessonExam,
  onBackToCatalog,
  onRequireLogin,
  isStudent = false,
  walletBalance = 0,
  onPurchaseCourse,
  purchaseFeedback,
}: ClassroomViewProps) {
  const allLessons = useMemo(() => getCourseAllLessons(course), [course]);
  const [stageMode, setStageMode] = useState<'overview' | 'lesson' | 'exam'>('overview');
  const [expandedOverviewLessonId, setExpandedOverviewLessonId] = useState<string | null>(
    allLessons[0]?.id ?? null
  );
  const [overviewGateMessage, setOverviewGateMessage] = useState<{
    lessonId: string;
    type: 'pay' | 'exam';
    message: string;
    blockingLessonId?: string;
    blockingLessonTitle?: string;
  } | null>(null);

  const [activeLessonId, setActiveLessonId] = useState<string>(allLessons[0]?.id ?? '');
  const [activeVideoIndex, setActiveVideoIndex] = useState<number>(0);
  const [measuredVideoSeconds, setMeasuredVideoSeconds] = useState<Record<string, number>>({});
  const [videoProgressById, setVideoProgressById] = useState<Record<string, number>>({});

  // Collapsible lesson content sections (matching screenshots 2 & 3)
  const [videosSectionOpen, setVideosSectionOpen] = useState<boolean>(true);
  const [filesSectionOpen, setFilesSectionOpen] = useState<boolean>(true);
  const [examsSectionOpen, setExamsSectionOpen] = useState<boolean>(true);
  const [showAboutLesson, setShowAboutLesson] = useState<boolean>(false);
  const [showNotesPanel, setShowNotesPanel] = useState<boolean>(false);
  const [expandedPdfIds, setExpandedPdfIds] = useState<Record<string, boolean>>({});

  // Fallback synthetic player timer when a lesson has 0 uploaded/linked videos
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.25 | 1.5>(1);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Exam state: 'intro' -> 'taking' -> 'submitted'
  const [examMode, setExamMode] = useState<'intro' | 'taking' | 'submitted'>('intro');
  const [draftAnswers, setDraftAnswers] = useState<Record<string, number>>({});
  const [showPendingSubmitConfirm, setShowPendingSubmitConfirm] = useState<boolean>(false);
  const [showPostSubmitReview, setShowPostSubmitReview] = useState<boolean>(false);
  const [nextLessonBlockedNotice, setNextLessonBlockedNotice] = useState<string | null>(null);

  // Lesson exam certificate modal
  const [certificateTarget, setCertificateTarget] = useState<{
    lessonId: string;
    lessonTitle: string;
    scorePercent: number;
    submittedAt: string;
  } | null>(null);

  const filesSectionRef = useRef<HTMLDivElement | null>(null);
  const examSectionRef = useRef<HTMLDivElement | null>(null);

  const activeLesson: Lesson | undefined =
    allLessons.find((l) => l.id === activeLessonId) ?? allLessons[0];
  const resolvedInstructorName =
    instructorName || getInstructorById(course.instructorId).name;

  // Always start on Course Overview screen when opening a course (in ANY state, including preview)
  useEffect(() => {
    setStageMode('overview');
    setExpandedOverviewLessonId(allLessons[0]?.id ?? null);
    setOverviewGateMessage(null);
    setActiveLessonId(allLessons[0]?.id ?? '');
    setNextLessonBlockedNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  // Background probe for any YouTube videos missing saved durationSeconds so course & lesson totals are accurate
  useEffect(() => {
    let cancelled = false;
    const unmeasuredYtVideos: Array<{ id: string; ytId: string }> = [];
    for (const les of allLessons) {
      for (const vid of les.videos ?? []) {
        if ((!vid.durationSeconds || vid.durationSeconds <= 0) && !measuredVideoSeconds[vid.id]) {
          const yt = parseYouTubeVideo(vid.url);
          if (yt) {
            unmeasuredYtVideos.push({ id: vid.id, ytId: yt.id });
          }
        }
      }
    }
    if (unmeasuredYtVideos.length === 0) return;

    const probeAll = async () => {
      for (const item of unmeasuredYtVideos) {
        if (cancelled) return;
        const sec = await readYouTubeDurationSeconds(item.ytId, 4500);
        if (cancelled) return;
        if (sec > 0) {
          setMeasuredVideoSeconds((prev) =>
            prev[item.id] === sec ? prev : { ...prev, [item.id]: sec }
          );
        }
      }
    };
    void probeAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, allLessons.length]);

  useEffect(() => {
    if (allLessons.length > 0 && !allLessons.some((l) => l.id === activeLessonId)) {
      setActiveLessonId(allLessons[0].id);
    }
  }, [allLessons, activeLessonId]);

  const activeExamResult = activeLesson ? examResults[activeLesson.id] : undefined;

  useEffect(() => {
    setElapsedSeconds(0);
    setIsPlaying(false);
    setActiveVideoIndex(0);
    setExpandedPdfIds({});
    setShowNotesPanel(false);
    setShowAboutLesson(false);
    setShowPendingSubmitConfirm(false);
    setShowPostSubmitReview(false);
    setNextLessonBlockedNotice(null);
    setVideosSectionOpen(true);
    setFilesSectionOpen(true);
    setExamsSectionOpen(true);
    if (activeLesson && examResults[activeLesson.id]) {
      setExamMode('submitted');
    } else {
      setExamMode('intro');
    }
    setDraftAnswers({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLesson?.id]);

  // Keep examMode synced if examResults arrives asynchronously from server/Firebase refresh
  useEffect(() => {
    if (activeExamResult && examMode === 'intro') {
      setExamMode('submitted');
    }
  }, [activeExamResult, examMode]);

  const getBlockingPrevLesson = (lessonIndex: number): Lesson | null => {
    if (isSupervisor || lessonIndex <= 0) return null;
    for (let i = 0; i < lessonIndex; i += 1) {
      const prev = allLessons[i];
      if (lessonHasExam(prev) && !examResults[prev.id]) {
        return prev;
      }
    }
    return null;
  };

  const canEnterLesson = Boolean(
    activeLesson &&
      (stageMode === 'lesson' || stageMode === 'exam') &&
      (isUnlocked || isSupervisor) &&
      !getBlockingPrevLesson(
        allLessons.findIndex((l) => l.id === activeLesson.id)
      )
  );

  const onRecordAttendanceRef = useRef(onRecordLessonAttendance);
  onRecordAttendanceRef.current = onRecordLessonAttendance;
  const onMarkCompleteRef = useRef(onMarkLessonComplete);
  onMarkCompleteRef.current = onMarkLessonComplete;
  const autoAttendedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeLesson || !canEnterLesson) return;
    const todayKey = getTodayDateKey();
    const visitKey = `${course.id}::${activeLesson.id}::${todayKey}`;
    if (autoAttendedRef.current.has(visitKey)) return;
    autoAttendedRef.current.add(visitKey);

    if (onRecordAttendanceRef.current) {
      onRecordAttendanceRef.current(activeLesson.id, todayKey);
    } else if (!completedLessonIds.includes(activeLesson.id)) {
      onMarkCompleteRef.current?.(activeLesson.id);
    }
  }, [course.id, activeLesson?.id, canEnterLesson, completedLessonIds, activeLesson]);

  const getLessonSeconds = (lesson: Lesson): number =>
    getLessonEffectiveSeconds(lesson, measuredVideoSeconds);

  const courseTotalSeconds = useMemo(
    () => getCourseEffectiveSeconds(course, measuredVideoSeconds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [course, measuredVideoSeconds]
  );

  const activeLessonSeconds = activeLesson ? getLessonSeconds(activeLesson) : 0;
  const activeLessonMinutes =
    activeLessonSeconds > 0 ? Math.max(1, Math.round(activeLessonSeconds / 60)) : 0;
  const totalDurationSeconds = activeLessonSeconds > 0 ? activeLessonSeconds : 30 * 60;

  useEffect(() => {
    if (!isPlaying || !activeLesson || !canEnterLesson) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + playbackSpeed;
        if (
          next >= totalDurationSeconds * 0.8 &&
          !completedLessonIds.includes(activeLesson.id)
        ) {
          onMarkLessonComplete?.(activeLesson.id);
        }
        if (next >= totalDurationSeconds) {
          setIsPlaying(false);
          return totalDurationSeconds;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [
    isPlaying,
    playbackSpeed,
    totalDurationSeconds,
    activeLesson,
    canEnterLesson,
    completedLessonIds,
    onMarkLessonComplete,
  ]);

  const handleAttemptOpenLesson = (lesson: Lesson, lessonIdx: number) => {
    if (!isUnlocked && !isSupervisor) {
      setOverviewGateMessage({
        lessonId: lesson.id,
        type: 'pay',
        message: `يجب شراء وتفعيل الكورس (${course.priceEgp} ج.م) أولًا لفتح المحاضرات.`,
      });
      return;
    }

    const blockingPrev = getBlockingPrevLesson(lessonIdx);
    if (blockingPrev) {
      setOverviewGateMessage({
        lessonId: lesson.id,
        type: 'exam',
        message: `لا يمكنك فتح هذه الحصة قبل دخول وتسليم امتحان «${blockingPrev.title}» أولًا (أياً كانت الدرجة).`,
        blockingLessonId: blockingPrev.id,
        blockingLessonTitle: blockingPrev.title,
      });
      return;
    }

    setOverviewGateMessage(null);
    setActiveLessonId(lesson.id);
    setStageMode('lesson');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (allLessons.length === 0 || !activeLesson) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">لا توجد حصص مضافة في هذا الكورس بعد.</p>
        <button
          type="button"
          onClick={onBackToCatalog}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg cursor-pointer"
        >
          العودة إلى الكورسات
        </button>
      </div>
    );
  }

  // Course-wide exam & completion statistics (for Overview Screen)
  const examLessons = allLessons.filter((l) => lessonHasExam(l));
  const submittedExamsCount = examLessons.filter((l) => Boolean(examResults[l.id])).length;

  // =========================================================================
  // VIEW 1: COURSE OVERVIEW & VERTICAL STACKED LESSONS (Screenshot 1)
  // =========================================================================
  if (stageMode === 'overview') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 overflow-x-hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى الكورسات</span>
          </button>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {course.grade} · {course.category}
          </span>
        </div>

        {/* Main Course Card (Screenshot 1 top card) */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 space-y-4">
            <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800">
              <ResilientImage
                src={course.image}
                alt={course.title}
                fallbackTitle={course.fallbackTitle}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug">
                {course.title}
              </h1>
              {course.subtitle && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {course.subtitle}
                </p>
              )}
            </div>

            {/* Instructor Badge Strip */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  {instructorImage ? (
                    <ResilientImage
                      src={instructorImage}
                      alt={resolvedInstructorName}
                      fallbackTitle={resolvedInstructorName}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      {resolvedInstructorName.trim().slice(0, 1) || 'م'}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {resolvedInstructorName}
                  </span>
                  <BadgeCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                </div>
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                مدرس المادة
              </span>
            </div>

            {/* Course Details Spec Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                    $
                  </span>
                  <span>السعر</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {course.priceEgp}.00 جنيه
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <span className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5" />
                  </span>
                  <span>المدة الإجمالية</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatArabicDurationFromSeconds(courseTotalSeconds)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <span className="w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Play className="w-3 h-3" />
                  </span>
                  <span>إجمالي الحصص</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {allLessons.length} حصة
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <span className="w-6 h-6 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <span>الصلاحية</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {course.studyMode === 'أونلاين' ? 'مفتوح طوال العام' : course.studyMode}
                </span>
              </div>
            </div>

            {/* Subscription / Payment Action Bar */}
            {isUnlocked ? (
              <div className="w-full py-3 px-4 rounded-xl bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{isSupervisor ? 'مشترك بالفعل (وضع المشرف)' : 'مشترك بالفعل'}</span>
              </div>
            ) : isStudent && onPurchaseCourse ? (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
                  <span>رصيد محفظتك الحالي:</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {walletBalance} ج.م
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void onPurchaseCourse()}
                  className="w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Wallet className="w-4 h-4 shrink-0" />
                  <span>شراء وتفعيل الكورس ({course.priceEgp} ج.م)</span>
                </button>
                {purchaseFeedback && (
                  <div
                    className={`text-xs font-medium px-3 py-2 rounded-lg text-center ${
                      purchaseFeedback.type === 'error'
                        ? 'bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200'
                        : 'bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    }`}
                  >
                    {purchaseFeedback.text}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onRequireLogin?.()}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-blue-700 hover:bg-slate-800 dark:hover:bg-blue-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4 shrink-0" />
                <span>سجّل دخولك لشراء وتفعيل الكورس ({course.priceEgp} ج.م)</span>
              </button>
            )}
          </div>
        </section>

        {/* 3 Stat Cards Row ONLY (Explicitly NO مستوى card!) */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {formatArabicDurationFromSeconds(courseTotalSeconds)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">المدة الإجمالية</div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Play className="w-4 h-4" />
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {allLessons.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">حصة</div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Award className="w-4 h-4" />
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {examLessons.length > 0
                ? `${submittedExamsCount} / ${examLessons.length}`
                : `${completedLessonIds.filter((id) => allLessons.some((l) => l.id === id)).length} / ${allLessons.length}`}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {examLessons.length > 0 ? 'الامتحانات المُسلّمة' : 'الحصص المكتملة'}
            </div>
          </div>
        </section>

        {/* Vertical Stacked Lessons Accordion List (01, 02, 03...) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              حصص الكورس ({allLessons.length} حصة)
            </h2>
            {!isUnlocked && !isSupervisor && (
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                اضغط على الحصة لعرض تفاصيلها · الفتح يتطلب شراء الكورس
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {allLessons.map((lesson, idx) => {
              const isExpanded = expandedOverviewLessonId === lesson.id;
              const vidsCount = lesson.videos?.length ?? 0;
              const filesCount = lesson.attachments?.length ?? 0;
              const hasExam = lessonHasExam(lesson);
              const lessonExamCount = hasExam ? 1 : 0;
              const lessonResult = examResults[lesson.id];
              const blockingPrev = getBlockingPrevLesson(idx);
              const lessonLockedForStudent = !isUnlocked && !isSupervisor;
              const gateAlert =
                overviewGateMessage?.lessonId === lesson.id ? overviewGateMessage : null;

              const lessonSec = getLessonSeconds(lesson);

              return (
                <div
                  key={lesson.id}
                  className={`bg-white dark:bg-slate-900 rounded-xl border transition-colors overflow-hidden ${
                    isExpanded
                      ? 'border-blue-300 dark:border-blue-800 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Accordion Header */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedOverviewLessonId((prev) =>
                        prev === lesson.id ? null : lesson.id
                      )
                    }
                    className="w-full p-4 flex items-center justify-between gap-3 text-right hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold tabular-nums shrink-0 ${
                          lessonResult
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : lessonLockedForStudent || blockingPrev
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              : 'bg-blue-600/15 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                          {lesson.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 tabular-nums">
                          <span>{vidsCount} فيديو</span>
                          <span>·</span>
                          <span>{filesCount} ملفات</span>
                          {lessonSec > 0 && (
                            <>
                              <span>·</span>
                              <span>{formatArabicDurationFromSeconds(lessonSec)}</span>
                            </>
                          )}
                          {hasExam && (
                            <>
                              <span>·</span>
                              <span>امتحان حصة</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {lessonLockedForStudent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <Lock className="w-3 h-3" />
                          <span>مدفوعة</span>
                        </span>
                      ) : blockingPrev ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <Lock className="w-3 h-3" />
                          <span>مقفولة</span>
                        </span>
                      ) : lessonResult ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 tabular-nums">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>تم الامتحان ({lessonResult.scorePercent}%)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {isSupervisor ? 'معاينة' : 'متاحة'}
                        </span>
                      )}

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Accordion Expanded Details + "فتح المحاضرة" Button */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="truncate">
                          {lesson.summary?.trim() || course.title}
                        </span>
                        {lessonSec > 0 && (
                          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                            {formatArabicDurationFromSeconds(lessonSec)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 tabular-nums">
                            <Film className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>{vidsCount} فيديو</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 tabular-nums">
                            <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>{filesCount} ملازم</span>
                          </span>
                          {hasExam && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 tabular-nums">
                              <HelpCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>{lessonExamCount} امتحان</span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAttemptOpenLesson(lesson, idx)}
                          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                            lessonLockedForStudent || blockingPrev
                              ? 'bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700'
                              : 'bg-blue-700 hover:bg-blue-800 text-white'
                          }`}
                        >
                          {lessonLockedForStudent || blockingPrev ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>فتح المحاضرة</span>
                        </button>
                      </div>

                      {/* Inline Gate Message when student tries to open unpaid or exam-locked lesson */}
                      {gateAlert && (
                        <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-xs text-amber-950 dark:text-amber-100 space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <span className="font-semibold leading-relaxed">
                              {gateAlert.message}
                            </span>
                          </div>
                          {gateAlert.type === 'pay' && (
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              {isStudent && onPurchaseCourse ? (
                                <button
                                  type="button"
                                  onClick={() => void onPurchaseCourse()}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                  <span>شراء وتفعيل الكورس ({course.priceEgp} ج.م)</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onRequireLogin?.()}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
                                >
                                  <span>تسجيل الدخول للاشتراك</span>
                                </button>
                              )}
                            </div>
                          )}
                          {gateAlert.type === 'exam' && gateAlert.blockingLessonId && (
                            <button
                              type="button"
                              onClick={() => {
                                setOverviewGateMessage(null);
                                setActiveLessonId(gateAlert.blockingLessonId!);
                                setStageMode('lesson');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>الانتقال إلى «{gateAlert.blockingLessonTitle}» لأداء الامتحان</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: LESSON STAGE (Screenshots 2 & 3)
  // =========================================================================
  const lessonVideos: LessonVideo[] = activeLesson.videos ?? [];
  const activeVideo = lessonVideos[activeVideoIndex] ?? lessonVideos[0];
  const lessonAttachments = activeLesson.attachments ?? [];
  const realQuestions = getRealExamQuestions(activeLesson);
  const hasExam = realQuestions.length > 0;

  const currentIndex = allLessons.findIndex((l) => l.id === activeLesson.id);
  const nextLesson = allLessons[currentIndex + 1];
  const isCurrentLessonDone = completedLessonIds.includes(activeLesson.id);
  const activeLessonAttendanceDate = attendanceDates[activeLesson.id];
  const activeNoteText = notesByLesson[activeLesson.id] ?? '';

  const activeVideoProgressPct = activeVideo
    ? Math.round(videoProgressById[activeVideo.id] ?? 0)
    : totalDurationSeconds > 0
      ? Math.min(100, Math.round((elapsedSeconds / totalDurationSeconds) * 100))
      : 0;

  const activeVideoSec = activeVideo
    ? measuredVideoSeconds[activeVideo.id] ?? activeVideo.durationSeconds ?? 0
    : activeLessonSeconds;

  // Overall lesson percentage combines video progress & exam completion
  const lessonOverallPercent = (() => {
    if (isCurrentLessonDone && (!hasExam || Boolean(activeExamResult))) return 100;
    const components: number[] = [];
    if (lessonVideos.length > 0 || activeLessonMinutes > 0) {
      components.push(isCurrentLessonDone ? 100 : activeVideoProgressPct);
    }
    if (hasExam) {
      components.push(activeExamResult ? 100 : 0);
    }
    if (components.length === 0) return isCurrentLessonDone ? 100 : 0;
    return Math.round(components.reduce((a, b) => a + b, 0) / components.length);
  })();

  const handleSelectExamDraftOption = (qIdx: number, optionIndex: number) => {
    if (examMode !== 'taking') return;
    const ansKey = getExamAnswerKey(activeLesson.id, qIdx);
    setDraftAnswers((prev) => ({
      ...prev,
      [ansKey]: optionIndex,
    }));
    setShowPendingSubmitConfirm(false);
  };

  const finalizeSubmitExam = () => {
    if (realQuestions.length === 0) return;
    const answersToCommit: Record<string, number> = {};
    let correctCount = 0;

    realQuestions.forEach((q, qIdx) => {
      const ansKey = getExamAnswerKey(activeLesson.id, qIdx);
      const chosen = draftAnswers[ansKey];
      if (chosen !== undefined) {
        answersToCommit[ansKey] = chosen;
      } else {
        answersToCommit[ansKey] = -1;
      }
      if (chosen === q.correctIndex) {
        correctCount += 1;
      }
    });

    const totalQuestions = realQuestions.length;
    const wrongCount = Math.max(0, totalQuestions - correctCount);
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    const result: LessonExamResult = {
      scorePercent,
      correctCount,
      wrongCount,
      totalQuestions,
      passed: scorePercent >= 50,
      submittedAt: new Date().toISOString(),
    };

    if (onSubmitLessonExam) {
      onSubmitLessonExam(activeLesson.id, answersToCommit, result);
    } else {
      Object.entries(answersToCommit).forEach(([k, v]) => onRecordQuizAnswer(k, v));
    }
    setShowPendingSubmitConfirm(false);
    setShowPostSubmitReview(false);
    setExamMode('submitted');
    setNextLessonBlockedNotice(null);
  };

  const handleClickSubmitExam = () => {
    const answeredCount = realQuestions.filter(
      (_, qIdx) => draftAnswers[getExamAnswerKey(activeLesson.id, qIdx)] !== undefined
    ).length;
    if (answeredCount < realQuestions.length && !showPendingSubmitConfirm) {
      setShowPendingSubmitConfirm(true);
      return;
    }
    finalizeSubmitExam();
  };

  const handleGoToNextLesson = () => {
    if (!nextLesson) return;
    if (!isSupervisor && hasExam && !activeExamResult) {
      setNextLessonBlockedNotice(
        'لا يمكنك الانتقال للحصة التالية في نفس الكورس إلا بعد تسليم امتحان هذه الحصة أولًا (أياً كانت الدرجة).'
      );
      setExamsSectionOpen(true);
      examSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setNextLessonBlockedNotice(null);
    setActiveLessonId(nextLesson.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const draftAnsweredCount = realQuestions.filter(
    (_, qIdx) => draftAnswers[getExamAnswerKey(activeLesson.id, qIdx)] !== undefined
  ).length;

  const openExamPage = (isRetake = false) => {
    if (!hasExam) return;
    setDraftAnswers({});
    setShowPendingSubmitConfirm(false);
    setShowPostSubmitReview(false);
    setNextLessonBlockedNotice(null);
    if (isRetake || !activeExamResult) {
      setExamMode('taking');
    } else {
      setExamMode('submitted');
    }
    setStageMode('exam');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const examCircleCircumference = 2 * Math.PI * 26;
  const examCircleOffset = activeExamResult
    ? examCircleCircumference * (1 - activeExamResult.scorePercent / 100)
    : examCircleCircumference;

  // =========================================================================
  // VIEW 3: DEDICATED SEPARATE EXAM PAGE
  // =========================================================================
  if (stageMode === 'exam') {
    const answeredPct =
      realQuestions.length > 0
        ? Math.round((draftAnsweredCount / realQuestions.length) * 100)
        : 0;

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6 overflow-x-hidden">
        {/* Top Exam Page Header */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!activeExamResult) {
                    setExamMode('intro');
                  } else {
                    setExamMode('submitted');
                  }
                  setShowPendingSubmitConfirm(false);
                  setStageMode('lesson');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة إلى الحصة</span>
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={() => {
                  if (!activeExamResult) {
                    setExamMode('intro');
                  }
                  setStageMode('overview');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                حصص الكورس
              </button>
            </div>

            {examMode === 'taking' ? (
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-lg tabular-nums">
                تم اختيار {draftAnsweredCount} من {realQuestions.length}
              </span>
            ) : activeExamResult ? (
              <span
                className={`text-xs font-bold px-3 py-1 rounded-lg tabular-nums ${
                  activeExamResult.passed
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                }`}
              >
                النتيجة: {activeExamResult.scorePercent}%
              </span>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-400">
              <Award className="w-4 h-4" />
              <span>صفحة الامتحان المستقلة</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
              امتحان الحصة — {activeLesson.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {course.title} · {resolvedInstructorName} · {realQuestions.length} سؤال
            </p>
          </div>

          {examMode === 'taking' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                <span>تقدم الحل</span>
                <span>{answeredPct}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-200"
                  style={{ width: `${answeredPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Exam Content */}
        {!hasExam ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              لا يوجد امتحان مضاف لهذه الحصة حاليًا.
            </p>
            <button
              type="button"
              onClick={() => {
                setStageMode('lesson');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-700 rounded-xl hover:bg-blue-800 cursor-pointer"
            >
              العودة إلى الحصة
            </button>
          </div>
        ) : examMode === 'submitted' && activeExamResult ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4 shadow-sm">
              {/* Score Percentage & Status Banner */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${
                      activeExamResult.passed
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {activeExamResult.passed ? 'اجتياز بنجاح' : 'تم تسليم الامتحان'}
                  </span>
                  <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {activeExamResult.passed
                      ? 'لقد اجتزت الامتحان بنجاح وتستحق شهادة اجتياز الحصة!'
                      : 'تم تصحيح الامتحان وتسجيل نتيجتك — يمكنك مراجعة الإجابات أو إعادة الامتحان.'}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-left">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">الدرجة النهائية</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {activeExamResult.correctCount} / {activeExamResult.totalQuestions}
                    </div>
                  </div>

                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        className="text-slate-200 dark:text-slate-800"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        fill="transparent"
                        strokeDasharray={examCircleCircumference}
                        strokeDashoffset={examCircleOffset}
                        className={activeExamResult.passed ? 'text-emerald-500' : 'text-amber-500'}
                      />
                    </svg>
                    <span className="absolute text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                      {activeExamResult.scorePercent}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  تاريخ التسليم:{' '}
                  {new Date(activeExamResult.submittedAt).toLocaleString('ar-EG', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/70 text-center space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {activeExamResult.correctCount}
                  </div>
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    إجابات صحيحة
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 text-center space-y-1">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto" />
                  <div className="text-lg font-bold text-red-700 dark:text-red-300 tabular-nums">
                    {activeExamResult.wrongCount}
                  </div>
                  <div className="text-xs font-medium text-red-700 dark:text-red-300">
                    إجابات خاطئة
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowPostSubmitReview((r) => !r)}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {showPostSubmitReview ? 'إخفاء نتائج وتفاصيل الامتحان' : 'عرض نتائج وتفاصيل الامتحان'}
                </button>

                {activeExamResult.passed && (
                  <button
                    type="button"
                    onClick={() =>
                      setCertificateTarget({
                        lessonId: activeLesson.id,
                        lessonTitle: activeLesson.title,
                        scorePercent: activeExamResult.scorePercent,
                        submittedAt: activeExamResult.submittedAt,
                      })
                    }
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Award className="w-4 h-4 shrink-0" />
                    <span>استخراج شهادة اجتياز امتحان الحصة</span>
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setStageMode('lesson');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>العودة إلى الحصة</span>
                  </button>

                  {nextLesson ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNextLessonBlockedNotice(null);
                        setActiveLessonId(nextLesson.id);
                        setStageMode('lesson');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>دخول الحصة التالية</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openExamPage(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة الامتحان</span>
                    </button>
                  )}
                </div>

                {nextLesson && (
                  <button
                    type="button"
                    onClick={() => openExamPage(true)}
                    className="w-full py-2.5 px-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة الامتحان</span>
                  </button>
                )}
              </div>

              {showPostSubmitReview && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>مراجعة الأسئلة والإجابات الصحيحة</span>
                  </div>
                  {realQuestions.map((q, qIdx) => {
                    const ansKey = getExamAnswerKey(activeLesson.id, qIdx);
                    const chosen = quizAnswers[ansKey];
                    const isQCorrect = chosen === q.correctIndex;
                    return (
                      <div
                        key={qIdx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-blue-700 dark:text-blue-400">
                            السؤال {qIdx + 1}
                          </span>
                          <span
                            className={`font-bold ${
                              isQCorrect
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {isQCorrect ? 'إجابة صحيحة' : 'إجابة خاطئة'}
                          </span>
                        </div>
                        {q.questionImage && (
                          <img
                            src={q.questionImage}
                            alt={`السؤال ${qIdx + 1}`}
                            className="w-full max-h-[380px] object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
                          />
                        )}
                        {q.question && q.question.trim().length > 0 && (
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {q.question}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {q.options.map((opt, oIdx) => {
                            const isOptCorrect = oIdx === q.correctIndex;
                            const isOptChosen = oIdx === chosen;
                            return (
                              <div
                                key={oIdx}
                                className={`px-3 py-2 rounded-lg border text-xs sm:text-sm flex items-center justify-between gap-2 ${
                                  isOptCorrect
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold'
                                    : isOptChosen
                                      ? 'border-red-400 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200'
                                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span>{opt}</span>
                                {isOptCorrect && (
                                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                                    الإجابة الصحيحة
                                  </span>
                                )}
                                {!isOptCorrect && isOptChosen && (
                                  <span className="text-[11px] font-bold text-red-700 dark:text-red-300 shrink-0">
                                    إجابتك
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {q.explanation && q.explanation.trim().length > 0 && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                            <strong className="text-slate-800 dark:text-slate-200">التوضيح: </strong>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ---- DEDICATED EXAM TAKING QUESTIONS (ZERO RIGHT/WRONG REVEAL!) ---- */
          <div className="space-y-5">
            {realQuestions.map((q, qIdx) => {
              const ansKey = getExamAnswerKey(activeLesson.id, qIdx);
              const chosenOpt = draftAnswers[ansKey];

              return (
                <div
                  key={qIdx}
                  className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3.5 shadow-xs"
                >
                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                      السؤال {qIdx + 1} من {realQuestions.length}
                    </div>
                    {q.questionImage && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white overflow-hidden">
                        <img
                          src={q.questionImage}
                          alt={`صورة السؤال ${qIdx + 1}`}
                          className="w-full max-h-[520px] object-contain mx-auto"
                        />
                      </div>
                    )}
                    {q.question && q.question.trim().length > 0 && (
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed">
                        {q.question}
                      </h2>
                    )}
                  </div>

                  {/* Options WITHOUT any correct/wrong hints */}
                  <div className="space-y-2">
                    {q.options.map((opt, idx) => {
                      const isChosen = chosenOpt === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectExamDraftOption(qIdx, idx)}
                          className={`w-full text-right p-3.5 rounded-xl border text-sm font-medium transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                            isChosen
                              ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-950 dark:text-blue-100'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="min-w-0 break-words">{opt}</span>
                          {isChosen ? (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {showPendingSubmitConfirm && (
              <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-xs sm:text-sm text-amber-950 dark:text-amber-100 space-y-2.5">
                <p className="font-semibold">
                  لم تقم بالإجابة على جميع الأسئلة بعد (متبقي{' '}
                  {realQuestions.length - draftAnsweredCount} سؤال). هل تريد تسليم الامتحان الآن؟
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={finalizeSubmitExam}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                  >
                    تأكيد تسليم الامتحان الآن
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPendingSubmitConfirm(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                  >
                    متابعة حل الأسئلة
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={handleClickSubmitExam}
                className="flex-1 py-3.5 px-6 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer"
              >
                تسليم الامتحان
              </button>
              <button
                type="button"
                onClick={() => {
                  setExamMode(activeExamResult ? 'submitted' : 'intro');
                  setShowPendingSubmitConfirm(false);
                  setStageMode('lesson');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-5 py-3.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                العودة إلى الحصة
              </button>
            </div>
          </div>
        )}

        {certificateTarget && (
          <CertificateModal
            course={course}
            lessonId={certificateTarget.lessonId}
            lessonTitle={certificateTarget.lessonTitle}
            examScorePercent={certificateTarget.scorePercent}
            submittedAt={certificateTarget.submittedAt}
            studentName={studentName}
            instructorName={resolvedInstructorName}
            onUpdateStudentName={onUpdateStudentName}
            onClose={() => setCertificateTarget(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 overflow-x-hidden">
      {/* Top Navigation & Lesson Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStageMode('overview');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة إلى حصص الكورس</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={onBackToCatalog}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              الكورسات
            </button>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
            {activeLesson.title}
          </h1>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
            <span>{course.title}</span>
            <span>·</span>
            <span>{resolvedInstructorName}</span>
            {activeLessonSeconds > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  <span>مدة الحصة: {formatArabicDurationFromSeconds(activeLessonSeconds)}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeLessonAttendanceDate && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
              <span>حضور: {formatAttendanceDateArabic(activeLessonAttendanceDate)}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => onToggleLessonComplete(activeLesson.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              isCurrentLessonDone
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {isCurrentLessonDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            ) : (
              <Circle className="w-4 h-4 text-slate-400" />
            )}
            <span>{isCurrentLessonDone ? 'تم سماع الحصة' : 'تحديد كمسموعة'}</span>
          </button>

          {nextLesson && (
            <button
              type="button"
              onClick={handleGoToNextLesson}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              الحصة التالية
            </button>
          )}
        </div>
      </div>

      {nextLessonBlockedNotice && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-100 flex flex-wrap items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{nextLessonBlockedNotice}</span>
          </div>
          {hasExam && (
            <button
              type="button"
              onClick={() => openExamPage(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>فتح صفحة الامتحان الآن</span>
            </button>
          )}
        </div>
      )}

      {/* Top 4 Compact Metric Cards (Screenshot 2) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>التقدم في الفيديو</span>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">
              {activeVideoProgressPct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-200"
              style={{ width: `${activeVideoProgressPct}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {lessonVideos.length > 0 ? 'مدة الفيديو' : 'مدة الحصة'}
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums truncate">
              {lessonVideos.length > 0
                ? activeVideoSec > 0
                  ? formatSecondsDigital(activeVideoSec)
                  : 'غير محدد'
                : formatArabicDurationFromSeconds(activeLessonSeconds)}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Play className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">عدد الامتحانات</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {hasExam ? 1 : 0}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <HelpCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">الملفات</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {lessonAttachments.length}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Video Player */}
      {lessonVideos.length > 0 && activeVideo ? (
        <div className="bg-slate-950 text-white rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
          {(() => {
            const resolved = resolveVideoEmbed(activeVideo.url, activeVideo.sourceType);
            if (resolved.kind === 'youtube') {
              return (
                <CustomYouTubePlayer
                  key={`${activeVideo.id}:${resolved.videoId}`}
                  videoId={resolved.videoId}
                  title={activeVideo.title}
                  startSeconds={resolved.startSeconds}
                  studentName={studentName}
                  studentEmail={studentEmail}
                  studentPhone={studentPhone}
                  onDurationDetected={(durSeconds) => {
                    setMeasuredVideoSeconds((prev) =>
                      prev[activeVideo.id] === durSeconds
                        ? prev
                        : { ...prev, [activeVideo.id]: durSeconds }
                    );
                  }}
                  onProgressRatio={(ratio) => {
                    const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
                    setVideoProgressById((prev) =>
                      (prev[activeVideo.id] ?? 0) >= pct ? prev : { ...prev, [activeVideo.id]: pct }
                    );
                    if (ratio >= 0.8 && !isCurrentLessonDone) {
                      onMarkLessonComplete?.(activeLesson.id);
                    }
                  }}
                  onEnded={() => {
                    setVideoProgressById((prev) => ({ ...prev, [activeVideo.id]: 100 }));
                    if (!isCurrentLessonDone) {
                      onMarkLessonComplete?.(activeLesson.id);
                    }
                  }}
                />
              );
            }
            if (resolved.kind === 'iframe') {
              return (
                <div>
                  <div className="aspect-video w-full bg-black">
                    <iframe
                      key={resolved.src}
                      src={resolved.src}
                      title={activeVideo.title}
                      className="w-full h-full border-0"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                      allowFullScreen
                    />
                  </div>
                  <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                    <span>مشغل فيديو مضمّن</span>
                    <a
                      href={resolved.watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-300 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح في نافذة خارجية</span>
                    </a>
                  </div>
                </div>
              );
            }
            if (resolved.kind === 'video') {
              return (
                <video
                  key={resolved.src}
                  controls
                  playsInline
                  preload="metadata"
                  src={resolved.src}
                  onLoadedMetadata={(e) => {
                    const dur = e.currentTarget.duration;
                    if (Number.isFinite(dur) && dur > 0) {
                      setMeasuredVideoSeconds((prev) => ({
                        ...prev,
                        [activeVideo.id]: Math.round(dur),
                      }));
                    }
                  }}
                  onTimeUpdate={(e) => {
                    const dur = e.currentTarget.duration;
                    if (dur > 0) {
                      const ratio = e.currentTarget.currentTime / dur;
                      const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
                      setVideoProgressById((prev) =>
                        (prev[activeVideo.id] ?? 0) >= pct ? prev : { ...prev, [activeVideo.id]: pct }
                      );
                      if (ratio >= 0.8 && !isCurrentLessonDone) {
                        onMarkLessonComplete?.(activeLesson.id);
                      }
                    }
                  }}
                  onEnded={() => {
                    setVideoProgressById((prev) => ({ ...prev, [activeVideo.id]: 100 }));
                    if (!isCurrentLessonDone) {
                      onMarkLessonComplete?.(activeLesson.id);
                    }
                  }}
                  className="w-full aspect-video bg-black"
                >
                  المتصفح لا يدعم تشغيل هذا الفيديو مباشرة.
                </video>
              );
            }
            return (
              <div className="p-8 text-center space-y-3 bg-slate-900">
                <Video className="w-8 h-8 text-blue-400 mx-auto" />
                <p className="text-sm text-slate-200">{activeVideo.title}</p>
                <a
                  href={resolved.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح رابط الفيديو</span>
                </a>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 sm:p-8 min-h-[220px] flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                {course.grade} · {course.category}
              </span>
              {activeLessonSeconds > 0 && (
                <span className="font-mono tabular-nums">
                  {formatArabicDurationFromSeconds(activeLessonSeconds)}
                </span>
              )}
            </div>
            <div className="my-4">
              <h2 className="text-xl font-bold text-white">{activeLesson.title}</h2>
            </div>
            <div className="space-y-3">
              <input
                type="range"
                aria-label="شريط تقدم الحصة"
                min={0}
                max={totalDurationSeconds}
                value={elapsedSeconds}
                onChange={(e) => setElapsedSeconds(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>إيقاف مؤقت</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>تشغيل الحصة</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setElapsedSeconds(0);
                    }}
                    aria-label="إعادة الحصة من البداية"
                    className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1 bg-slate-800 p-1 rounded-md">
                    {([1, 1.25, 1.5] as const).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`px-2 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                          playbackSpeed === spd
                            ? 'bg-blue-700 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-mono text-slate-300 tabular-nums">
                    {formatSecondsDigital(elapsedSeconds)} / {formatSecondsDigital(totalDurationSeconds)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Bar Directly Below Video (Screenshot 2) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowAboutLesson((s) => !s);
              setShowNotesPanel(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              showAboutLesson
                ? 'bg-blue-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>عن الحصة</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilesSectionOpen(true);
              filesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ملفات الحصة ({lessonAttachments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowNotesPanel((s) => !s);
              setShowAboutLesson(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              showNotesPanel
                ? 'bg-blue-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>ملاحظاتي على الفيديو ({activeNoteText.trim() ? 1 : 0})</span>
          </button>
        </div>

        {showAboutLesson && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-2">
            <div className="font-bold text-slate-900 dark:text-white">{activeLesson.title}</div>
            <p className="leading-relaxed">
              {activeLesson.summary?.trim() ||
                `شرح ومحتوى ${activeLesson.title} ضمن كورس ${course.title}.`}
            </p>
            {activeLesson.keyTakeaways && activeLesson.keyTakeaways.length > 0 && (
              <ul className="list-disc pr-5 space-y-1 text-xs">
                {activeLesson.keyTakeaways.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {showNotesPanel && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <label
              htmlFor="lesson-notes-textarea"
              className="block text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              ملاحظاتك الخاصة على الحصة (يتم الحفظ تلقائيًا)
            </label>
            <textarea
              id="lesson-notes-textarea"
              rows={3}
              value={activeNoteText}
              onChange={(e) => onSaveNote(activeLesson.id, e.target.value)}
              placeholder="اكتب ملاحظاتك أو القوانين المهمة هنا..."
              className="w-full p-3 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>
        )}
      </div>

      {/* Lesson Overall Percentage & Stacked Content Sections (Screenshots 2 & 3) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-5">
        {/* النسبة الكلية للحصة */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>النسبة الكلية للحصة</span>
            </span>
            <span className="font-mono tabular-nums text-blue-700 dark:text-blue-400">
              {lessonOverallPercent}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-200"
              style={{ width: `${lessonOverallPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            محتوى الحصة
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {lessonVideos.length} فيديو · {lessonAttachments.length} ملف · {hasExam ? '1 امتحان' : 'بدون امتحان'}
          </span>
        </div>

        {/* 1. Accordion: فيديوهات الحصة (Stacked vertically one below another - Screenshot 2) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setVideosSectionOpen((o) => !o)}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-2 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>فيديوهات الحصة ({lessonVideos.length})</span>
            </div>
            {videosSectionOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {videosSectionOpen && (
            <div className="p-3 sm:p-4 space-y-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              {lessonVideos.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                  لا توجد فيديوهات مضافة لهذه الحصة حاليًا.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {lessonVideos.map((vid, idx) => {
                    const isSelected = idx === activeVideoIndex;
                    const yt = parseYouTubeVideo(vid.url);
                    const durSec = measuredVideoSeconds[vid.id] ?? vid.durationSeconds ?? 0;
                    const watchedPct = Math.round(videoProgressById[vid.id] ?? 0);

                    return (
                      <button
                        key={vid.id}
                        type="button"
                        onClick={() => {
                          setActiveVideoIndex(idx);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`w-full p-3 rounded-xl border text-right flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 dark:border-blue-600'
                            : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-24 sm:w-32 aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                            {yt ? (
                              <img
                                src={`https://i.ytimg.com/vi/${yt.id}/hqdefault.jpg`}
                                alt={vid.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Film className="w-6 h-6 text-blue-400" />
                            )}
                            <span className="absolute inset-0 bg-slate-950/25 flex items-center justify-center">
                              <span className="w-7 h-7 rounded-full bg-white/90 text-blue-700 flex items-center justify-center shadow-xs">
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </span>
                            </span>
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words">
                              {vid.title || `فيديو ${idx + 1}`}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {durSec > 0 && (
                                <span>{formatArabicDurationFromSeconds(durSec)}</span>
                              )}
                              {isSelected && (
                                <span className="px-2 py-0.5 rounded bg-blue-600/15 text-blue-700 dark:text-blue-300 font-semibold">
                                  يتم التشغيل الآن
                                </span>
                              )}
                              {watchedPct >= 80 && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  مكتمل
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isSelected || watchedPct >= 80 ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-700" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Accordion: ملفات الحصة (Directly underneath Videos - Screenshots 2 & 3) */}
        <div
          ref={filesSectionRef}
          className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setFilesSectionOpen((o) => !o)}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-2 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>ملفات الحصة ({lessonAttachments.length})</span>
            </div>
            {filesSectionOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {filesSectionOpen && (
            <div className="p-3 sm:p-4 space-y-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              {lessonAttachments.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                  لا توجد ملفات أو ملازم PDF مضافة لهذه الحصة حاليًا.
                </p>
              ) : (
                <div className="space-y-3">
                  {lessonAttachments.map((att) => {
                    const pdfInfo = resolvePdfAttachment(att);
                    const isPdfOpen = Boolean(expandedPdfIds[att.id]);
                    return (
                      <div
                        key={att.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {pdfInfo.isPdf && (
                                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/70 border border-red-200 dark:border-red-800 rounded">
                                  PDF
                                </span>
                              )}
                              <span className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                                {att.title}
                              </span>
                            </div>
                            {att.fileName && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate" dir="ltr">
                                {att.fileName}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {pdfInfo.canEmbedPreview && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedPdfIds((prev) => ({
                                    ...prev,
                                    [att.id]: !prev[att.id],
                                  }))
                                }
                                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                                  isPdfOpen
                                    ? 'bg-slate-900 dark:bg-slate-700 border-slate-900 dark:border-slate-600 text-white'
                                    : 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/60'
                                }`}
                              >
                                {isPdfOpen ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>إخفاء المعاينة</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>عرض PDF هنا</span>
                                  </>
                                )}
                              </button>
                            )}

                            <a
                              href={pdfInfo.openSrc}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>فتح</span>
                            </a>

                            <a
                              href={pdfInfo.downloadSrc}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.fileName || att.title}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>تحميل</span>
                            </a>
                          </div>
                        </div>

                        {pdfInfo.canEmbedPreview && isPdfOpen && (
                          <EmbeddedPdfViewer
                            src={pdfInfo.previewSrc}
                            title={att.title}
                            openSrc={pdfInfo.openSrc}
                            downloadSrc={pdfInfo.downloadSrc}
                            fileName={att.fileName}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Accordion: امتحانات الحصة (Directly underneath Files - Screenshot 3) */}
        <div
          ref={examSectionRef}
          className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setExamsSectionOpen((o) => !o)}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-2 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>امتحانات الحصة</span>
              {activeExamResult && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {activeExamResult.scorePercent}%
                </span>
              )}
            </div>
            {examsSectionOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {examsSectionOpen && (
            <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-5">
              {!hasExam ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                  لا يوجد امتحان مضاف لهذه الحصة حاليًا.
                </p>
              ) : !activeExamResult ? (
                /* ---- EXAM INTRO CARD (Clicking "بدء الامتحان" opens the separate Exam Page!) ---- */
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-600/15 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold tabular-nums">
                        01
                      </span>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                          امتحان الحصة — {activeLesson.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          عدد الأسئلة: {realQuestions.length} · الدرجة النهائية: {realQuestions.length}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    عند الضغط على «بدء الامتحان» ستنتقل إلى صفحة الامتحان المستقلة لحل الأسئلة. لن تظهر الإجابات الصحيحة أو الخاطئة أثناء الحل، وعند التسليم تظهر نتيجتك النهائية وتُفتح الحصة التالية.
                  </p>

                  <button
                    type="button"
                    onClick={() => openExamPage(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>بدء الامتحان</span>
                  </button>
                </div>
              ) : (
                /* ---- EXAM SUBMITTED / GRADED SUMMARY (Screenshot 3) ---- */
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-blue-600/15 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold tabular-nums">
                        01
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          امتحان الحصة — {activeLesson.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          عدد الأسئلة: {activeExamResult.totalQuestions} · الدرجة: {activeExamResult.totalQuestions} درجات
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Score Percentage & Status Banner (Screenshot 3) */}
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${
                          activeExamResult.passed
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {activeExamResult.passed ? 'اجتياز بنجاح' : 'تم تسليم الامتحان'}
                      </span>
                      <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {activeExamResult.passed
                          ? 'لقد اجتزت الامتحان بنجاح وتستحق شهادة اجتياز الحصة!'
                          : 'تم تصحيح الامتحان وتسجيل نتيجتك — يمكنك مراجعة الإجابات أو إعادة الامتحان.'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-left">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">الدرجة النهائية</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          {activeExamResult.correctCount} / {activeExamResult.totalQuestions}
                        </div>
                      </div>

                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="transparent"
                            className="text-slate-200 dark:text-slate-800"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            stroke="currentColor"
                            strokeWidth="6"
                            strokeLinecap="round"
                            fill="transparent"
                            strokeDasharray={examCircleCircumference}
                            strokeDashoffset={examCircleOffset}
                            className={
                              activeExamResult.passed
                                ? 'text-emerald-500'
                                : 'text-amber-500'
                            }
                          />
                        </svg>
                        <span className="absolute text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                          {activeExamResult.scorePercent}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submission Timestamp Row */}
                  <div className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      تاريخ التسليم:{' '}
                      {new Date(activeExamResult.submittedAt).toLocaleString('ar-EG', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* 2 Side-by-side Boxes: إجابات خاطئة & إجابات صحيحة (Screenshot 3) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/70 text-center space-y-1">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                      <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {activeExamResult.correctCount}
                      </div>
                      <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        إجابات صحيحة
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 text-center space-y-1">
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto" />
                      <div className="text-lg font-bold text-red-700 dark:text-red-300 tabular-nums">
                        {activeExamResult.wrongCount}
                      </div>
                      <div className="text-xs font-medium text-red-700 dark:text-red-300">
                        إجابات خاطئة
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons (Screenshot 3 bottom stack) */}
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setShowPostSubmitReview((r) => !r)}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {showPostSubmitReview ? 'إخفاء نتائج وتفاصيل الامتحان' : 'عرض نتائج الامتحان'}
                    </button>

                    {activeExamResult.passed && (
                      <button
                        type="button"
                        onClick={() =>
                          setCertificateTarget({
                            lessonId: activeLesson.id,
                            lessonTitle: activeLesson.title,
                            scorePercent: activeExamResult.scorePercent,
                            submittedAt: activeExamResult.submittedAt,
                          })
                        }
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Award className="w-4 h-4 shrink-0" />
                        <span>استخراج شهادة اجتياز امتحان الحصة</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openExamPage(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة الامتحان</span>
                    </button>
                  </div>

                  {/* Post-Submit Detailed Review Drawer (ONLY shown AFTER submission!) */}
                  {showPostSubmitReview && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>مراجعة الأسئلة والإجابات الصحيحة</span>
                      </div>
                      {realQuestions.map((q, qIdx) => {
                        const ansKey = getExamAnswerKey(activeLesson.id, qIdx);
                        const chosen = quizAnswers[ansKey];
                        const isQCorrect = chosen === q.correctIndex;
                        return (
                          <div
                            key={qIdx}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-blue-700 dark:text-blue-400">
                                السؤال {qIdx + 1}
                              </span>
                              <span
                                className={`font-bold ${
                                  isQCorrect
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {isQCorrect ? 'إجابة صحيحة' : 'إجابة خاطئة'}
                              </span>
                            </div>
                            {q.questionImage && (
                              <img
                                src={q.questionImage}
                                alt={`السؤال ${qIdx + 1}`}
                                className="w-full max-h-[340px] object-contain rounded-lg border border-slate-200 dark:border-slate-700"
                              />
                            )}
                            {q.question && q.question.trim().length > 0 && (
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {q.question}
                              </div>
                            )}
                            <div className="space-y-1.5">
                              {q.options.map((opt, oIdx) => {
                                const isOptCorrect = oIdx === q.correctIndex;
                                const isOptChosen = oIdx === chosen;
                                return (
                                  <div
                                    key={oIdx}
                                    className={`px-3 py-2 rounded-lg border text-xs sm:text-sm flex items-center justify-between gap-2 ${
                                      isOptCorrect
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold'
                                        : isOptChosen
                                          ? 'border-red-400 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200'
                                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <span>{opt}</span>
                                    {isOptCorrect && (
                                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                                        الإجابة الصحيحة
                                      </span>
                                    )}
                                    {!isOptCorrect && isOptChosen && (
                                      <span className="text-[11px] font-bold text-red-700 dark:text-red-300 shrink-0">
                                        إجابتك
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {q.explanation && q.explanation.trim().length > 0 && (
                              <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                                <strong className="text-slate-800 dark:text-slate-200">التوضيح: </strong>
                                {q.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Next Lesson Shortcut Card */}
      {nextLesson && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 dark:text-slate-400">الحصة التالية في الكورس</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {nextLesson.title}
            </div>
          </div>
          <button
            type="button"
            onClick={handleGoToNextLesson}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            {!isSupervisor && hasExam && !activeExamResult && <Lock className="w-3.5 h-3.5" />}
            <span>دخول الحصة التالية</span>
          </button>
        </div>
      )}

      {certificateTarget && (
        <CertificateModal
          course={course}
          lessonId={certificateTarget.lessonId}
          lessonTitle={certificateTarget.lessonTitle}
          examScorePercent={certificateTarget.scorePercent}
          submittedAt={certificateTarget.submittedAt}
          studentName={studentName}
          instructorName={resolvedInstructorName}
          onUpdateStudentName={onUpdateStudentName}
          onClose={() => setCertificateTarget(null)}
        />
      )}
    </div>
  );
}
