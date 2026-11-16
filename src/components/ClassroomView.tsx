import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Circle,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Film,
  HelpCircle,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Video,
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

interface ClassroomViewProps {
  course: Course;
  instructorName?: string;
  isUnlocked: boolean;
  completedLessonIds: string[];
  notesByLesson: Record<string, string>;
  quizAnswers: Record<string, number>;
  studentName: string;
  onUpdateStudentName: (name: string) => void;
  onToggleLessonComplete: (lessonId: string) => void;
  onSaveNote: (lessonId: string, note: string) => void;
  onRecordQuizAnswer: (lessonId: string, optionIndex: number) => void;
  onBackToCatalog: () => void;
}

type StageMode = 'lecture' | 'lab';

function resolveVideoEmbed(
  url: string,
  sourceType: LessonVideo['sourceType']
):
  | { kind: 'iframe'; src: string }
  | { kind: 'video'; src: string }
  | { kind: 'external'; src: string } {
  const trimmed = url.trim();
  if (
    sourceType === 'upload' ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('blob:') ||
    /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(trimmed)
  ) {
    return { kind: 'video', src: trimmed };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/embed/')) {
        return { kind: 'iframe', src: trimmed };
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}` };
      }
      const v = parsed.searchParams.get('v');
      if (v) return { kind: 'iframe', src: `https://www.youtube.com/embed/${v}` };
    }

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '');
      if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}` };
    }

    if (host === 'vimeo.com') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id && /^\d+$/.test(id)) {
        return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` };
      }
    }

    if (host === 'drive.google.com') {
      const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      if (match?.[1]) {
        return { kind: 'iframe', src: `https://drive.google.com/file/d/${match[1]}/preview` };
      }
    }
  } catch {
    // Fallback below
  }

  return { kind: 'external', src: trimmed };
}

function getExamAnswerKey(lessonId: string, qIndex: number): string {
  return qIndex === 0 ? lessonId : `${lessonId}__q${qIndex}`;
}

export function ClassroomView({
  course,
  instructorName,
  isUnlocked,
  completedLessonIds,
  notesByLesson,
  quizAnswers,
  studentName,
  onUpdateStudentName,
  onToggleLessonComplete,
  onSaveNote,
  onRecordQuizAnswer,
  onBackToCatalog,
}: ClassroomViewProps) {
  const allLessons = useMemo(() => getCourseAllLessons(course), [course]);
  const [activeLessonId, setActiveLessonId] = useState<string>(allLessons[0]?.id ?? '');
  const [activeVideoIndex, setActiveVideoIndex] = useState<number>(0);
  const [stageMode, setStageMode] = useState<StageMode>('lecture');
  const [showNotesPanel, setShowNotesPanel] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.25 | 1.5>(1);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);

  const activeLesson: Lesson | undefined =
    allLessons.find((l) => l.id === activeLessonId) ?? allLessons[0];
  const resolvedInstructorName =
    instructorName || getInstructorById(course.instructorId).name;

  const totalDurationSeconds = (activeLesson?.durationMinutes || 30) * 60;

  useEffect(() => {
    if (allLessons.length > 0 && !allLessons.some((l) => l.id === activeLessonId)) {
      setActiveLessonId(allLessons[0].id);
    }
  }, [allLessons, activeLessonId]);

  useEffect(() => {
    setElapsedSeconds(0);
    setIsPlaying(false);
    setActiveVideoIndex(0);
  }, [activeLesson?.id]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + playbackSpeed;
        if (next >= totalDurationSeconds) {
          setIsPlaying(false);
          return totalDurationSeconds;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPlaying, playbackSpeed, totalDurationSeconds]);

  if (!activeLesson) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-sm text-slate-600">لا توجد حصص مضافة في هذا الكورس بعد.</p>
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 sm:mb-8 border-b border-slate-200">
        <div className="space-y-1.5 min-w-0">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى الكورسات</span>
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 text-balance">
            {course.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
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
            <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg max-w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setStageMode('lecture')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  stageMode === 'lecture'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                فيديوهات ومحتوى الحصة
              </button>
              <button
                type="button"
                onClick={() => setStageMode('lab')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  stageMode === 'lab'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                المختبر التفاعلي
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canAccessActiveLesson && (
                <button
                  type="button"
                  onClick={() => onToggleLessonComplete(activeLesson.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                    isCurrentLessonDone
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isCurrentLessonDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{isCurrentLessonDone ? 'تمت المشاهدة' : 'تحديد الحصة كمكتملة'}</span>
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
                الحصة الأولى مجانية للتجربة. لتشغيل باقي حصص «{course.title}» ومشاهدة الفيديوهات والملفات والامتحانات، تواصل مع إدارة المنصة لتفعيل الاشتراك في حسابك.
              </p>
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
                    if (resolved.kind === 'iframe') {
                      return (
                        <div className="aspect-video w-full bg-black">
                          <iframe
                            src={resolved.src}
                            title={activeVideo.title}
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                          />
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
                      <span className="font-mono tabular-nums">
                        {activeLesson.durationMinutes} دقيقة
                      </span>
                    </div>

                    <div className="my-5 max-w-2xl">
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 text-balance">
                        {activeLesson.title}
                      </h2>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {activeLesson.summary}
                      </p>
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
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        ملفات وملازم الحصة
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {lessonAttachments.length} ملف
                    </span>
                  </div>

                  <div className="space-y-2">
                    {lessonAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {att.title}
                          </div>
                          {att.fileName && (
                            <div className="text-xs text-slate-500 truncate" dir="ltr">
                              {att.fileName}
                            </div>
                          )}
                        </div>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={att.fileName || att.title}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>فتح / تحميل</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Lesson Exam Section (Directly below Videos & Files) */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-700 shrink-0" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">امتحان الحصة</h3>
                      <p className="text-xs text-slate-500">
                        اختبر فهمك لأسئلة هذه الحصة وتعرّف على الحل النموذجي فورًا
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg tabular-nums">
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
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-blue-700 tabular-nums">
                            السؤال {qIdx + 1} من {examQuestions.length}
                          </div>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900">
                            {q.question}
                          </h4>
                        </div>

                        <div className="space-y-2">
                          {q.options.map((opt, idx) => {
                            const isChosen = selectedOpt === idx;
                            const isCorrectOpt = idx === q.correctIndex;
                            let optionClasses =
                              'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';

                            if (hasAnswered) {
                              if (isCorrectOpt) {
                                optionClasses =
                                  'border-emerald-500 bg-emerald-50 text-emerald-950';
                              } else if (isChosen) {
                                optionClasses = 'border-red-400 bg-red-50 text-red-950';
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
                                  <span className="text-xs font-semibold text-emerald-700 shrink-0">
                                    إجابة صحيحة
                                  </span>
                                )}
                                {hasAnswered && isChosen && !isCorrectOpt && (
                                  <span className="text-xs font-semibold text-red-700 shrink-0">
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
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            <strong className="block mb-1">
                              {isCorrect ? 'أحسنت! التفسير:' : 'تفسير الحل النموذجي:'}
                            </strong>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Lesson Summary & Student Notes */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-700" />
                    <h3 className="text-base font-bold text-slate-900">
                      ملخص الحصة والملاحظات
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNotesPanel((s) => !s)}
                    className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    {showNotesPanel ? 'إخفاء دفتر الملاحظات' : 'تدوين ملاحظاتك في الحصة'}
                  </button>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">{activeLesson.summary}</p>

                {activeLesson.keyTakeaways.length > 0 && (
                  <ul className="space-y-2">
                    {activeLesson.keyTakeaways.map((point, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed"
                      >
                        <span className="font-mono text-xs text-blue-700 mt-1 tabular-nums">
                          0{index + 1}.
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {activeLesson.codeSnippet && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Code2 className="w-4 h-4 text-blue-700" />
                        {activeLesson.codeSnippet.label}
                      </span>
                      <span className="font-mono text-slate-400">
                        {activeLesson.codeSnippet.language}
                      </span>
                    </div>
                    <pre
                      dir="ltr"
                      className="bg-slate-950 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed"
                    >
                      <code>{activeLesson.codeSnippet.code}</code>
                    </pre>
                  </div>
                )}

                {showNotesPanel && (
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="lesson-notes-textarea"
                        className="text-xs font-semibold text-slate-900"
                      >
                        دفتر ملاحظات الحصة
                      </label>
                      <span className="text-xs text-slate-500">يتم الحفظ تلقائيًا</span>
                    </div>
                    <textarea
                      id="lesson-notes-textarea"
                      rows={4}
                      value={notesByLesson[activeLesson.id] ?? ''}
                      onChange={(e) => onSaveNote(activeLesson.id, e.target.value)}
                      placeholder="اكتب القوانين أو المسائل التي تود مراجعتها في هذه الحصة..."
                      className="w-full p-3.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Vertical stacked lessons sidebar (الحصة الأولى تحتها الثانية...) */}
        <aside className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 space-y-5 min-w-0">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 mb-2">
              <span>تقدمك في الكورس</span>
              <span className="font-mono tabular-nums text-blue-700">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              حصص الكورس بالترتيب ({allLessons.length} حصة)
            </h2>

            {course.modules.map((mod) => (
              <div key={mod.id} className="space-y-2.5">
                {course.modules.length > 1 && (
                  <h3 className="text-xs font-semibold text-slate-500">{mod.title}</h3>
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
                            ? 'bg-blue-50/90 border-blue-300'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onToggleLessonComplete(lesson.id)}
                          aria-label={`تبديل حالة إكمال ${lesson.title}`}
                          className="shrink-0 mt-0.5 text-slate-400 hover:text-blue-700 disabled:opacity-50"
                        >
                          {locked ? (
                            <Lock className="w-4 h-4 text-slate-400" />
                          ) : isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveLessonId(lesson.id)}
                          className="flex-1 text-right min-w-0 cursor-pointer"
                        >
                          <div className="text-[11px] font-semibold text-blue-700 mb-0.5 tabular-nums">
                            الحصة {lessonGlobalIdx + 1}
                          </div>
                          <div
                            className={`text-sm font-bold break-words ${
                              isActive ? 'text-blue-950' : 'text-slate-900'
                            }`}
                          >
                            {lesson.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2 tabular-nums">
                            <span>{lesson.durationMinutes} دقيقة</span>
                            {vidsCount > 0 && <span>· {vidsCount} فيديو</span>}
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
