import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
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
  Video,
  Wallet,
} from 'lucide-react';
import {
  Course,
  getCourseAllLessons,
  getInstructorById,
  Lesson,
  LessonVideo,
  QuizQuestion,
} from '../data/academyData';
import { InteractiveConceptLab } from './InteractiveConceptLab';
import { CertificateModal } from './CertificateModal';
import { CustomYouTubePlayer } from './CustomYouTubePlayer';
import { formatAttendanceDateArabic, getTodayDateKey } from '../utils/attendance';
import {
  extractCleanVideoUrl,
  parseYouTubeVideo,
  resolvePdfAttachment,
} from '../utils/mediaHelpers';

interface ClassroomViewProps {
  course: Course;
  instructorName?: string;
  isUnlocked: boolean;
  completedLessonIds: string[];
  attendanceDates?: Record<string, string>;
  notesByLesson: Record<string, string>;
  quizAnswers: Record<string, number>;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  onUpdateStudentName: (name: string) => void;
  onToggleLessonComplete: (lessonId: string) => void;
  onMarkLessonComplete?: (lessonId: string) => void;
  onRecordLessonAttendance?: (lessonId: string, dateKey: string) => void;
  onSaveNote: (lessonId: string, note: string) => void;
  onRecordQuizAnswer: (lessonId: string, optionIndex: number) => void;
  onBackToCatalog: () => void;
  isStudent?: boolean;
  walletBalance?: number;
  onPurchaseCourse?: () => Promise<void> | void;
  purchaseFeedback?: { type: 'ok' | 'error'; text: string } | null;
}

type StageMode = 'lecture' | 'lab';

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

export function ClassroomView({
  course,
  instructorName,
  isUnlocked,
  completedLessonIds,
  attendanceDates = {},
  notesByLesson,
  quizAnswers,
  studentName,
  studentEmail,
  studentPhone,
  onUpdateStudentName,
  onToggleLessonComplete,
  onMarkLessonComplete,
  onRecordLessonAttendance,
  onSaveNote,
  onRecordQuizAnswer,
  onBackToCatalog,
  isStudent = false,
  walletBalance = 0,
  onPurchaseCourse,
  purchaseFeedback,
}: ClassroomViewProps) {
  const allLessons = useMemo(() => getCourseAllLessons(course), [course]);
  const [activeLessonId, setActiveLessonId] = useState<string>(allLessons[0]?.id ?? '');
  const [activeVideoIndex, setActiveVideoIndex] = useState<number>(0);
  const [stageMode, setStageMode] = useState<StageMode>('lecture');
  const [showNotesPanel, setShowNotesPanel] = useState<boolean>(false);
  const [measuredVideoSeconds, setMeasuredVideoSeconds] = useState<Record<string, number>>({});
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.25 | 1.5>(1);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);
  const [expandedPdfIds, setExpandedPdfIds] = useState<Record<string, boolean>>({});

  const activeLesson: Lesson | undefined =
    allLessons.find((l) => l.id === activeLessonId) ?? allLessons[0];
  const resolvedInstructorName =
    instructorName || getInstructorById(course.instructorId).name;

  const activeLessonIndex = activeLesson
    ? allLessons.findIndex((l) => l.id === activeLesson.id)
    : -1;
  const canAccessActiveLessonOnMount =
    Boolean(activeLesson) && (isUnlocked || activeLessonIndex === 0);

  const onRecordAttendanceRef = useRef(onRecordLessonAttendance);
  onRecordAttendanceRef.current = onRecordLessonAttendance;
  const onMarkCompleteRef = useRef(onMarkLessonComplete);
  onMarkCompleteRef.current = onMarkLessonComplete;
  const autoAttendedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeLesson || !canAccessActiveLessonOnMount) return;
    const todayKey = getTodayDateKey();
    const visitKey = `${course.id}::${activeLesson.id}::${todayKey}`;
    if (autoAttendedRef.current.has(visitKey)) return;
    autoAttendedRef.current.add(visitKey);

    if (onRecordAttendanceRef.current) {
      onRecordAttendanceRef.current(activeLesson.id, todayKey);
    } else if (!completedLessonIds.includes(activeLesson.id)) {
      onMarkCompleteRef.current?.(activeLesson.id);
    }
  }, [course.id, activeLesson?.id, canAccessActiveLessonOnMount, completedLessonIds, activeLesson]);

  const getLessonAutoMinutes = (lesson: Lesson): number => {
    const videos = lesson.videos ?? [];
    if (videos.length > 0) {
      const totalSec = videos.reduce(
        (sum, v) => sum + (measuredVideoSeconds[v.id] ?? v.durationSeconds ?? 0),
        0
      );
      if (totalSec > 0) return Math.max(1, Math.round(totalSec / 60));
    }
    return lesson.durationMinutes || 0;
  };

  const activeLessonMinutes = activeLesson ? getLessonAutoMinutes(activeLesson) : 0;
  const totalDurationSeconds = (activeLessonMinutes || 30) * 60;

  useEffect(() => {
    if (allLessons.length > 0 && !allLessons.some((l) => l.id === activeLessonId)) {
      setActiveLessonId(allLessons[0].id);
    }
  }, [allLessons, activeLessonId]);

  useEffect(() => {
    setElapsedSeconds(0);
    setIsPlaying(false);
    setActiveVideoIndex(0);
    setExpandedPdfIds({});
  }, [activeLesson?.id]);

  useEffect(() => {
    if (!isPlaying || !activeLesson) return;
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
    completedLessonIds,
    onMarkLessonComplete,
  ]);

  if (!activeLesson) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">لا توجد حصص مضافة في هذا الكورس بعد.</p>
        <button
          type="button"
          onClick={onBackToCatalog}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg"
        >
          العودة إلى الكورسات
        </button>
      </div>
    );
  }

  const lessonVideos: LessonVideo[] = activeLesson.videos ?? [];
  const activeVideo = lessonVideos[activeVideoIndex] ?? lessonVideos[0];
  const lessonAttachments = activeLesson.attachments ?? [];
  const examQuestions: QuizQuestion[] =
    activeLesson.examQuestions && activeLesson.examQuestions.length > 0
      ? activeLesson.examQuestions
      : [activeLesson.quiz];

  const completedInCourseCount = allLessons.filter((l) =>
    completedLessonIds.includes(l.id)
  ).length;
  const progressPercent =
    allLessons.length > 0
      ? Math.round((completedInCourseCount / allLessons.length) * 100)
      : 0;
  const isCourseCompleted =
    allLessons.length > 0 && completedInCourseCount === allLessons.length;
  const isCurrentLessonDone = completedLessonIds.includes(activeLesson.id);

  const answeredExamCount = examQuestions.filter(
    (_, idx) => quizAnswers[getExamAnswerKey(activeLesson.id, idx)] !== undefined
  ).length;
  const correctExamCount = examQuestions.filter(
    (q, idx) => quizAnswers[getExamAnswerKey(activeLesson.id, idx)] === q.correctIndex
  ).length;

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const currentIndex = allLessons.findIndex((l) => l.id === activeLesson.id);
  const nextLesson = allLessons[currentIndex + 1];
  const canAccessActiveLesson = isUnlocked || currentIndex === 0;
  const activeLessonAttendanceDate = attendanceDates[activeLesson.id];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 sm:mb-8 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5 min-w-0">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى الكورسات</span>
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white text-balance">
            {course.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{course.grade}</span>
            <span aria-hidden="true">·</span>
            <span>{course.category}</span>
            <span aria-hidden="true">·</span>
            <span>{resolvedInstructorName}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {completedInCourseCount} من {allLessons.length} حصص مكتملة ({progressPercent}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowCertificate(true)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isCourseCompleted
                ? 'bg-emerald-700 border-emerald-700 text-white hover:bg-emerald-800'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>{isCourseCompleted ? 'استخراج شهادة الإتمام' : 'معاينة الشهادة'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Main lesson content column */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-lg max-w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setStageMode('lecture')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  stageMode === 'lecture'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                فيديوهات ومحتوى الحصة
              </button>
              <button
                type="button"
                onClick={() => setStageMode('lab')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  stageMode === 'lab'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                المختبر التفاعلي
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canAccessActiveLesson && activeLessonAttendanceDate && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                  <span>
                    حضور مسجل: {formatAttendanceDateArabic(activeLessonAttendanceDate)}
                  </span>
                </span>
              )}

              {canAccessActiveLesson && (
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
                  <span>{isCurrentLessonDone ? 'تم سماع الحصة' : 'تحديد الحصة كمسموعة'}</span>
                </button>
              )}

              {nextLesson && (
                <button
                  type="button"
                  onClick={() => setActiveLessonId(nextLesson.id)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  الحصة التالية
                </button>
              )}
            </div>
          </div>

          {!canAccessActiveLesson ? (
            <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-8 sm:p-10 text-center space-y-4">
              <Lock className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="text-xl font-bold">هذه الحصة متاحة للمشتركين في الكورس</h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                الحصة الأولى مجانية للتجربة. لتشغيل باقي حصص «{course.title}» ومشاهدة الفيديوهات والملفات والامتحانات، يمكنك شراء الكورس من محفظة حسابك ({course.priceEgp} ج.م).
              </p>
              {isStudent && onPurchaseCourse && (
                <div className="space-y-3 pt-1">
                  <div className="text-xs text-slate-300 tabular-nums">
                    رصيد محفظتك الحالي: <span className="font-bold text-white">{walletBalance} ج.م</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onPurchaseCourse()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>شراء وتفعيل الكورس ({course.priceEgp} ج.م)</span>
                  </button>
                  {purchaseFeedback && (
                    <div
                      className={`text-xs font-medium px-3 py-2 rounded-lg max-w-md mx-auto ${
                        purchaseFeedback.type === 'error'
                          ? 'bg-red-950/70 border border-red-700 text-red-200'
                          : 'bg-emerald-950/70 border border-emerald-700 text-emerald-200'
                      }`}
                    >
                      {purchaseFeedback.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : stageMode === 'lab' ? (
            <InteractiveConceptLab kind={activeLesson.simulationKind} />
          ) : (
            <div className="space-y-6">
              {/* 1. Lesson Video(s) Player */}
              {lessonVideos.length > 0 && activeVideo ? (
                <div className="bg-slate-950 text-white rounded-xl border border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Film className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-xs sm:text-sm font-bold truncate">
                        {activeLesson.title} — {activeVideo.title}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                      فيديو {activeVideoIndex + 1} من {lessonVideos.length}
                    </span>
                  </div>

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
                            if (
                              canAccessActiveLesson &&
                              ratio >= 0.8 &&
                              !isCurrentLessonDone
                            ) {
                              onMarkLessonComplete?.(activeLesson.id);
                            }
                          }}
                          onEnded={() => {
                            if (canAccessActiveLesson && !isCurrentLessonDone) {
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
                            if (
                              canAccessActiveLesson &&
                              dur > 0 &&
                              e.currentTarget.currentTime / dur >= 0.8 &&
                              !isCurrentLessonDone
                            ) {
                              onMarkLessonComplete?.(activeLesson.id);
                            }
                          }}
                          onEnded={() => {
                            if (canAccessActiveLesson && !isCurrentLessonDone) {
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

                  {lessonVideos.length > 1 && (
                    <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-slate-300">
                        فيديوهات هذه الحصة ({lessonVideos.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {lessonVideos.map((vid, idx) => (
                          <button
                            key={vid.id}
                            type="button"
                            onClick={() => setActiveVideoIndex(idx)}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                              idx === activeVideoIndex
                                ? 'bg-blue-700 border-blue-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              فيديو {idx + 1}: {vid.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900 text-white rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-6 sm:p-10 min-h-[240px] flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {course.grade} · {course.category}
                      </span>
                      {activeLessonMinutes > 0 && (
                        <span className="font-mono tabular-nums">
                          {activeLessonMinutes} دقيقة
                        </span>
                      )}
                    </div>

                    <div className="my-5 max-w-2xl">
                      <h2 className="text-xl sm:text-2xl font-bold text-white text-balance">
                        {activeLesson.title}
                      </h2>
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
                            className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg transition-colors"
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
                                className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
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
                            {formatTime(elapsedSeconds)} / {formatTime(totalDurationSeconds)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Lesson Files / Attachments Section */}
              {lessonAttachments.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        ملفات وملازم الحصة
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {lessonAttachments.length} ملف
                    </span>
                  </div>

                  <div className="space-y-3">
                    {lessonAttachments.map((att) => {
                      const pdfInfo = resolvePdfAttachment(att);
                      const isPdfOpen = Boolean(expandedPdfIds[att.id]);
                      return (
                        <div
                          key={att.id}
                          className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
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
                </div>
              )}

              {/* 3. Lesson Exam Section (Directly below Videos & Files) */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">امتحان الحصة</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        اختبر فهمك لأسئلة هذه الحصة وتعرّف على الحل النموذجي فورًا
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-lg tabular-nums">
                    النتيجة: {correctExamCount} / {examQuestions.length}
                    {answeredExamCount < examQuestions.length
                      ? ` (${answeredExamCount} مُجاب)`
                      : ''}
                  </div>
                </div>

                <div className="space-y-6">
                  {examQuestions.map((q, qIdx) => {
                    const ansKey = getExamAnswerKey(activeLesson.id, qIdx);
                    const selectedOpt = quizAnswers[ansKey];
                    const hasAnswered = selectedOpt !== undefined;
                    const isCorrect = selectedOpt === q.correctIndex;

                    return (
                      <div
                        key={qIdx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 space-y-3"
                      >
                        <div className="space-y-2.5">
                          <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                            السؤال {qIdx + 1} من {examQuestions.length}
                          </div>
                          {q.questionImage && (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white overflow-hidden">
                              <img
                                src={q.questionImage}
                                alt={`صورة السؤال ${qIdx + 1}`}
                                className="w-full max-h-[440px] object-contain mx-auto"
                              />
                            </div>
                          )}
                          {q.question && q.question.trim().length > 0 && (
                            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                              {q.question}
                            </h4>
                          )}
                        </div>

                        <div className="space-y-2">
                          {q.options.map((opt, idx) => {
                            const isChosen = selectedOpt === idx;
                            const isCorrectOpt = idx === q.correctIndex;
                            let optionClasses =
                              'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800';

                            if (hasAnswered) {
                              if (isCorrectOpt) {
                                optionClasses =
                                  'border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200';
                              } else if (isChosen) {
                                optionClasses = 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/60 text-red-950 dark:text-red-200';
                              }
                            }

                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => onRecordQuizAnswer(ansKey, idx)}
                                className={`w-full text-right p-3.5 rounded-lg border text-sm font-medium transition-colors flex items-center justify-between gap-3 cursor-pointer ${optionClasses}`}
                              >
                                <span className="min-w-0 break-words">{opt}</span>
                                {hasAnswered && isCorrectOpt && (
                                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                                    إجابة صحيحة
                                  </span>
                                )}
                                {hasAnswered && isChosen && !isCorrectOpt && (
                                  <span className="text-xs font-semibold text-red-700 dark:text-red-300 shrink-0">
                                    إجابة خاطئة
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {hasAnswered && (
                          <div
                            className={`p-3.5 rounded-lg border text-xs sm:text-sm leading-relaxed ${
                              isCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <strong className="block mb-0.5">
                              {isCorrect
                                ? 'إجابة صحيحة! أحسنت.'
                                : 'إجابة غير صحيحة — راجع الإجابة الصحيحة المحددة بالأخضر.'}
                            </strong>
                            {q.explanation && q.explanation.trim().length > 0 && (
                              <span className="block mt-1">{q.explanation}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Personal Student Notes Toggle */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    ملاحظاتك الخاصة في الحصة
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNotesPanel((s) => !s)}
                    className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {showNotesPanel ? 'إخفاء' : 'كتابة / عرض الملاحظات'}
                  </button>
                </div>

                {showNotesPanel && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <textarea
                      id="lesson-notes-textarea"
                      rows={3}
                      value={notesByLesson[activeLesson.id] ?? ''}
                      onChange={(e) => onSaveNote(activeLesson.id, e.target.value)}
                      placeholder="اكتب ملاحظاتك في هذه الحصة (يتم الحفظ تلقائيًا)..."
                      className="w-full p-3 text-sm text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Vertical stacked lessons sidebar (الحصة الأولى تحتها الثانية...) */}
        <aside className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 min-w-0">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white mb-2">
              <span>تقدمك في الكورس</span>
              <span className="font-mono tabular-nums text-blue-700 dark:text-blue-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 dark:bg-blue-500 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              حصص الكورس بالترتيب ({allLessons.length} حصة)
            </h2>

            {course.modules.map((mod) => (
              <div key={mod.id} className="space-y-2.5">
                {course.modules.length > 1 && (
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">{mod.title}</h3>
                )}
                <div className="flex flex-col gap-2">
                  {mod.lessons.map((lesson) => {
                    const lessonGlobalIdx = allLessons.findIndex((l) => l.id === lesson.id);
                    const locked = !isUnlocked && lessonGlobalIdx > 0;
                    const isActive = lesson.id === activeLesson.id;
                    const isDone = completedLessonIds.includes(lesson.id);
                    const vidsCount = lesson.videos?.length ?? 0;
                    const filesCount = lesson.attachments?.length ?? 0;

                    return (
                      <div
                        key={lesson.id}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors min-w-0 ${
                          isActive
                            ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700'
                            : 'bg-slate-50/60 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onToggleLessonComplete(lesson.id)}
                          aria-label={`تبديل حالة إكمال ${lesson.title}`}
                          className="shrink-0 mt-0.5 text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 disabled:opacity-50"
                        >
                          {locked ? (
                            <Lock className="w-4 h-4 text-slate-400" />
                          ) : isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveLessonId(lesson.id)}
                          className="flex-1 text-right min-w-0 cursor-pointer"
                        >
                          <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 mb-0.5 tabular-nums">
                            الحصة {lessonGlobalIdx + 1}
                          </div>
                          <div
                            className={`text-sm font-bold break-words ${
                              isActive ? 'text-blue-950 dark:text-blue-100' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {lesson.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2 tabular-nums">
                            {getLessonAutoMinutes(lesson) > 0 && (
                              <span>{getLessonAutoMinutes(lesson)} دقيقة</span>
                            )}
                            {vidsCount > 0 && (
                              <span>
                                {getLessonAutoMinutes(lesson) > 0 ? '· ' : ''}
                                {vidsCount} فيديو
                              </span>
                            )}
                            {filesCount > 0 && <span>· {filesCount} ملف</span>}
                            {locked && <span>· للمشتركين</span>}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {showCertificate && (
        <CertificateModal
          course={course}
          studentName={studentName}
          instructorName={resolvedInstructorName}
          onUpdateStudentName={onUpdateStudentName}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </div>
  );
}
