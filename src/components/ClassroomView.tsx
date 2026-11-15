import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
  Pause,
  Play,
  RotateCcw,
  BookOpen,
  Code2,
  HelpCircle,
  FileText,
  Lock,
  KeyRound,
} from 'lucide-react';
import {
  Course,
  getCourseAllLessons,
  getInstructorById,
  Lesson,
} from '../data/academyData';
import { InteractiveConceptLab } from './InteractiveConceptLab';
import { CertificateModal } from './CertificateModal';

interface ClassroomViewProps {
  course: Course;
  isUnlocked: boolean;
  completedLessonIds: string[];
  notesByLesson: Record<string, string>;
  quizAnswers: Record<string, number>;
  studentName: string;
  onUpdateStudentName: (name: string) => void;
  onToggleLessonComplete: (lessonId: string) => void;
  onSaveNote: (lessonId: string, note: string) => void;
  onRecordQuizAnswer: (lessonId: string, optionIndex: number) => void;
  onOpenActivationModal: () => void;
  onBackToCatalog: () => void;
}

type StageMode = 'lecture' | 'lab';
type DeckTab = 'concepts' | 'quiz' | 'notes';

export function ClassroomView({
  course,
  isUnlocked,
  completedLessonIds,
  notesByLesson,
  quizAnswers,
  studentName,
  onUpdateStudentName,
  onToggleLessonComplete,
  onSaveNote,
  onRecordQuizAnswer,
  onOpenActivationModal,
  onBackToCatalog,
}: ClassroomViewProps) {
  const allLessons = useMemo(() => getCourseAllLessons(course), [course]);
  const [activeLessonId, setActiveLessonId] = useState<string>(allLessons[0]?.id ?? '');
  const [stageMode, setStageMode] = useState<StageMode>('lecture');
  const [deckTab, setDeckTab] = useState<DeckTab>('concepts');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.25 | 1.5>(1);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);

  const activeLesson: Lesson =
    allLessons.find((l) => l.id === activeLessonId) ?? allLessons[0];
  const instructor = getInstructorById(course.instructorId);

  const totalDurationSeconds = activeLesson.durationMinutes * 60;

  useEffect(() => {
    setElapsedSeconds(0);
    setIsPlaying(false);
  }, [activeLesson.id]);

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

  const completedInCourseCount = allLessons.filter((l) =>
    completedLessonIds.includes(l.id)
  ).length;
  const progressPercent = Math.round((completedInCourseCount / allLessons.length) * 100);
  const isCourseCompleted = completedInCourseCount === allLessons.length;
  const isCurrentLessonDone = completedLessonIds.includes(activeLesson.id);

  const selectedQuizOption = quizAnswers[activeLesson.id];
  const hasAnsweredQuiz = selectedQuizOption !== undefined;
  const isQuizCorrect = selectedQuizOption === activeLesson.quiz.correctIndex;

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const currentIndex = allLessons.findIndex((l) => l.id === activeLesson.id);
  const nextLesson = allLessons[currentIndex + 1];
  const canAccessActiveLesson = isUnlocked || currentIndex === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى الكورسات</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 text-balance">
            {course.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{course.grade}</span>
            <span aria-hidden="true">·</span>
            <span>{course.category}</span>
            <span aria-hidden="true">·</span>
            <span>{instructor.name}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {completedInCourseCount} من {allLessons.length} حصص مكتملة ({progressPercent}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isUnlocked && (
            <button
              type="button"
              onClick={onOpenActivationModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>تفعيل الكورس بالكود</span>
            </button>
          )}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => setStageMode('lecture')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  stageMode === 'lecture'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                مشغل الحصة والشرح
              </button>
              <button
                type="button"
                onClick={() => setStageMode('lab')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  stageMode === 'lab'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                المختبر الرياضي التفاعلي
              </button>
            </div>

            <div className="flex items-center gap-2">
              {canAccessActiveLesson && (
                <button
                  type="button"
                  onClick={() => onToggleLessonComplete(activeLesson.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
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
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
                >
                  الحصة التالية
                </button>
              )}
            </div>
          </div>

          {!canAccessActiveLesson ? (
            <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-10 text-center space-y-4">
              <Lock className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="text-xl font-bold">هذه الحصة متاحة للمشتركين بالكود</h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                الحصة الأولى مجانية للتجربة. لتشغيل باقي حصص «{course.title}» والامتحانات الأسبوعية، أدخل كود الاشتراك الخاص بك.
              </p>
              <button
                type="button"
                onClick={onOpenActivationModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>تفعيل الكورس بالكود الآن</span>
              </button>
            </div>
          ) : stageMode === 'lab' ? (
            <InteractiveConceptLab kind={activeLesson.simulationKind} />
          ) : (
            <div className="bg-slate-900 text-white rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-8 sm:p-10 min-h-[260px] flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {course.grade} · {course.category}
                  </span>
                  <span className="font-mono tabular-nums">
                    {activeLesson.durationMinutes} دقيقة
                  </span>
                </div>

                <div className="my-6 max-w-2xl">
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
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
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

                    <div className="flex items-center gap-4">
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

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center gap-6 px-6 border-b border-slate-200 overflow-x-auto">
              <button
                type="button"
                onClick={() => setDeckTab('concepts')}
                className={`inline-flex items-center gap-2 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  deckTab === 'concepts'
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>ملخص القوانين والمفاهيم</span>
              </button>

              <button
                type="button"
                onClick={() => setDeckTab('quiz')}
                className={`inline-flex items-center gap-2 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  deckTab === 'quiz'
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>الامتحان الجزئي للحصة</span>
              </button>

              <button
                type="button"
                onClick={() => setDeckTab('notes')}
                className={`inline-flex items-center gap-2 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  deckTab === 'notes'
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>ملاحظاتي</span>
              </button>
            </div>

            <div className="p-6">
              {deckTab === 'concepts' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-2">
                      {activeLesson.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {activeLesson.summary}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">
                      أهم القوانين ونقاط الامتحان
                    </h4>
                    <ul className="space-y-2.5">
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
                  </div>

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
                </div>
              )}

              {deckTab === 'quiz' && (
                <div className="space-y-5">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">اختبار فهم الحصة (بابل شيت)</div>
                    <h3 className="text-base font-bold text-slate-900">
                      {activeLesson.quiz.question}
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {activeLesson.quiz.options.map((opt, idx) => {
                      const isChosen = selectedQuizOption === idx;
                      const isCorrectOpt = idx === activeLesson.quiz.correctIndex;
                      let optionClasses =
                        'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';

                      if (hasAnsweredQuiz) {
                        if (isCorrectOpt) {
                          optionClasses = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                        } else if (isChosen) {
                          optionClasses = 'border-red-400 bg-red-50 text-red-950';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onRecordQuizAnswer(activeLesson.id, idx)}
                          className={`w-full text-right p-4 rounded-lg border text-sm font-medium transition-colors flex items-center justify-between gap-3 ${optionClasses}`}
                        >
                          <span>{opt}</span>
                          {hasAnsweredQuiz && isCorrectOpt && (
                            <span className="text-xs font-semibold text-emerald-700 shrink-0">
                              إجابة صحيحة
                            </span>
                          )}
                          {hasAnsweredQuiz && isChosen && !isCorrectOpt && (
                            <span className="text-xs font-semibold text-red-700 shrink-0">
                              إجابة غير دقيقة
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {hasAnsweredQuiz && (
                    <div
                      className={`p-4 rounded-lg border text-sm leading-relaxed ${
                        isQuizCorrect
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <strong className="block mb-1">
                        {isQuizCorrect ? 'أحسنت! خطوة الحل الصحيحة:' : 'تفسير الحل النموذجي:'}
                      </strong>
                      {activeLesson.quiz.explanation}
                    </div>
                  )}
                </div>
              )}

              {deckTab === 'notes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="lesson-notes-textarea"
                      className="text-sm font-semibold text-slate-900"
                    >
                      دفتر ملاحظات الحصة
                    </label>
                    <span className="text-xs text-slate-500">يتم الحفظ تلقائيًا</span>
                  </div>
                  <textarea
                    id="lesson-notes-textarea"
                    rows={6}
                    value={notesByLesson[activeLesson.id] ?? ''}
                    onChange={(e) => onSaveNote(activeLesson.id, e.target.value)}
                    placeholder="اكتب القوانين أو المسائل التي تود مراجعتها في هذه الحصة..."
                    className="w-full p-4 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 space-y-6">
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

          <div className="space-y-5 divide-y divide-slate-100">
            {course.modules.map((mod) => (
              <div key={mod.id} className="pt-4 first:pt-0">
                <h3 className="text-xs font-semibold text-slate-500 mb-3">{mod.title}</h3>
                <div className="space-y-1.5">
                  {mod.lessons.map((lesson) => {
                    const lessonGlobalIdx = allLessons.findIndex((l) => l.id === lesson.id);
                    const locked = !isUnlocked && lessonGlobalIdx > 0;
                    const isActive = lesson.id === activeLesson.id;
                    const isDone = completedLessonIds.includes(lesson.id);

                    return (
                      <div
                        key={lesson.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors ${
                          isActive
                            ? 'bg-blue-50/80 border-blue-200'
                            : 'bg-white border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onToggleLessonComplete(lesson.id)}
                          aria-label={`تبديل حالة إكمال ${lesson.title}`}
                          className="shrink-0 text-slate-400 hover:text-blue-700 disabled:opacity-50"
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
                          className="flex-1 text-right min-w-0"
                        >
                          <div
                            className={`text-sm font-medium truncate ${
                              isActive ? 'text-blue-900' : 'text-slate-800'
                            }`}
                          >
                            {lesson.title}
                          </div>
                          <div className="text-xs text-slate-400 font-mono tabular-nums">
                            {lesson.durationMinutes} دقيقة {locked ? '· يتطلب كود' : ''}
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
          onUpdateStudentName={onUpdateStudentName}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </div>
  );
}
