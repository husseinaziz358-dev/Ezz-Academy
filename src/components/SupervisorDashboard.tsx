import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  FilePlus2,
  FileText,
  Film,
  GraduationCap,
  HelpCircle,
  ImagePlus,
  Link2,
  LogOut,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  Course,
  COURSES,
  getCourseAllLessons,
  INSTRUCTORS,
  Lesson,
  LessonAttachment,
  LessonVideo,
  QuizQuestion,
} from '../data/academyData';
import {
  DynamicTeacher,
  EDUCATIONAL_STAGES,
  EducationalStage,
  StudentRecord,
} from '../types/student';
import {
  apiAddCourse,
  apiAddTeacher,
  apiDeleteCourse,
  apiDeleteTeacher,
  apiFetchSupervisorStudents,
  apiUpdateCourse,
  apiUpdateSupervisorStudent,
  apiUploadMediaFile,
  mergeCatalogCourses,
} from '../utils/apiClient';
import {
  fetchAllFirebaseStudents,
  updateFirebaseStudentBySupervisor,
} from '../services/firebaseStudents';
import { ResilientImage } from './ResilientImage';

export type AdminTab = 'students' | 'teachers' | 'courses';

interface SupervisorDashboardProps {
  supervisorName: string;
  supervisorPhone: string;
  token: string;
  initialTab?: AdminTab;
  teachers: DynamicTeacher[];
  customCourses: Course[];
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

function createEmptyQuizQuestion(titleHint = 'الحصة'): QuizQuestion {
  return {
    question: `سؤال تطبيقي على ${titleHint}`,
    options: ['الإجابة الأولى', 'الإجابة الثانية', 'الإجابة الثالثة', 'الإجابة الرابعة'],
    correctIndex: 0,
    explanation: 'مراجعة القاعدة الأساسية في الشرح والتحقق من خطوات الحل.',
  };
}

function normalizeLessonForEditor(lesson: Lesson): Lesson {
  const examQuestions =
    lesson.examQuestions && lesson.examQuestions.length > 0
      ? lesson.examQuestions.map((q) => ({
          question: q.question,
          options: q.options.length >= 2 ? [...q.options] : ['أ', 'ب', 'ج', 'د'],
          correctIndex: q.correctIndex ?? 0,
          explanation: q.explanation ?? '',
        }))
      : [
          {
            question: lesson.quiz.question,
            options: [...lesson.quiz.options],
            correctIndex: lesson.quiz.correctIndex,
            explanation: lesson.quiz.explanation,
          },
        ];

  return {
    ...lesson,
    videos: lesson.videos ? [...lesson.videos] : [],
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
  onCatalogUpdated,
  onLogout,
}: SupervisorDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('جميع المراحل');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  const [editNotes, setEditNotes] = useState('');
  const [editAttendance, setEditAttendance] = useState<number>(100);
  const [editCourses, setEditCourses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Teacher form state
  const [teacherName, setTeacherName] = useState('');
  const [teacherSubject, setTeacherSubject] = useState('');
  const [teacherImage, setTeacherImage] = useState('');
  const [teacherGrades, setTeacherGrades] = useState<EducationalStage[]>([
    'الصف الثالث الثانوي',
  ]);
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [teacherFeedback, setTeacherFeedback] = useState('');

  // Course creation form state
  const [courseTitle, setCourseTitle] = useState('');
  const [courseSubtitle, setCourseSubtitle] = useState('');
  const [courseGrade, setCourseGrade] =
    useState<EducationalStage>('الصف الثالث الثانوي');
  const [courseTeacherId, setCourseTeacherId] = useState('');
  const [courseMode, setCourseMode] = useState<'أونلاين' | 'سنتر وأونلاين'>(
    'سنتر وأونلاين'
  );
  const [coursePrice, setCoursePrice] = useState('250');
  const [courseLessonsText, setCourseLessonsText] = useState('');
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseFeedback, setCourseFeedback] = useState('');

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
  const [videoUploadTitleDraft, setVideoUploadTitleDraft] = useState<Record<string, string>>({});
  const [fileLinkTitleDraft, setFileLinkTitleDraft] = useState<Record<string, string>>({});
  const [fileLinkUrlDraft, setFileLinkUrlDraft] = useState<Record<string, string>>({});
  const [fileUploadTitleDraft, setFileUploadTitleDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (teachers.length > 0 && !courseTeacherId) {
      setCourseTeacherId(teachers[0].id);
    }
  }, [teachers, courseTeacherId]);

  const allCourses = useMemo(
    () => mergeCatalogCourses(customCourses, COURSES),
    [customCourses]
  );

  const builtInCourseIds = useMemo(() => new Set(COURSES.map((c) => c.id)), []);

  const loadStudents = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (token === 'firebase-google-session') {
        const fbStudents = await fetchAllFirebaseStudents();
        setStudents(fbStudents);
        return;
      }
      const result = await apiFetchSupervisorStudents(token);
      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }
      setStudents(result.students);
    } catch {
      setErrorMsg('تعذر تحميل بيانات الطلاب من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const matchesStage = stageFilter === 'جميع المراحل' || s.stage === stageFilter;
      const matchesQuery =
        !q ||
        s.studentName.toLowerCase().includes(q) ||
        s.studentPhone.includes(q) ||
        s.parentName.toLowerCase().includes(q) ||
        s.parentPhone.includes(q) ||
        s.motherName.toLowerCase().includes(q) ||
        s.specialization.toLowerCase().includes(q);
      return matchesStage && matchesQuery;
    });
  }, [students, searchQuery, stageFilter]);

  const openStudentFollowUp = (student: StudentRecord) => {
    setSelectedStudent(student);
    setEditNotes(student.supervisorNotes);
    setEditAttendance(student.attendanceRate);
    setEditCourses(student.unlockedCourseIds);
    setSavedNotice(false);
  };

  const toggleCourseForStudent = (courseId: string) => {
    setEditCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    setSavedNotice(false);
    try {
      if (token === 'firebase-google-session') {
        const updated = await updateFirebaseStudentBySupervisor(selectedStudent.id, {
          supervisorNotes: editNotes,
          attendanceRate: editAttendance,
          unlockedCourseIds: editCourses,
        });
        setStudents((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        setSelectedStudent(updated);
        setSavedNotice(true);
        return;
      }

      const result = await apiUpdateSupervisorStudent(selectedStudent.id, token, {
        supervisorNotes: editNotes,
        attendanceRate: editAttendance,
        unlockedCourseIds: editCourses,
      });
      if (result.ok) {
        setStudents((prev) =>
          prev.map((s) => (s.id === result.student.id ? result.student : s))
        );
        setSelectedStudent(result.student);
        setSavedNotice(true);
      }
    } finally {
      setSaving(false);
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
      });
      if (!res.ok) {
        setTeacherFeedback(res.error);
        return;
      }
      setTeacherName('');
      setTeacherSubject('');
      setTeacherImage('');
      setTeacherGrades(['الصف الثالث الثانوي']);
      setTeacherFeedback('تمت إضافة المدرس بنجاح وظهوره في الصفحة الأولى.');
      await onCatalogUpdated();
    } finally {
      setTeacherSaving(false);
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

  const handleAddCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseFeedback('');
    if (!courseTeacherId && teachers.length === 0) {
      setCourseFeedback('أضف مدرسًا أولًا من تبويب إدارة المدرسين لربط الكورس به.');
      return;
    }
    const chosenTeacher = teachers.find((t) => t.id === courseTeacherId);
    setCourseSaving(true);
    try {
      const lessonTitles = courseLessonsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await apiAddCourse(token, {
        title: courseTitle,
        subtitle: courseSubtitle,
        grade: courseGrade,
        category: chosenTeacher?.subject || 'محتوى المنهج',
        instructorId: chosenTeacher?.id || courseTeacherId || 'inst-custom',
        studyMode: courseMode,
        priceEgp: Number(coursePrice) || 250,
        image: chosenTeacher?.image || '',
        lessonTitles,
      });
      if (!res.ok) {
        setCourseFeedback(res.error);
        return;
      }
      setCourseTitle('');
      setCourseSubtitle('');
      setCourseLessonsText('');
      setCourseFeedback(`تمت إضافة الكورس بنجاح لطلاب ${courseGrade}. يمكنك الآن رفع الفيديوهات والملفات.`);
      await onCatalogUpdated();
      openCourseEditor(res.course);
    } finally {
      setCourseSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    const ok = await apiDeleteCourse(token, courseId);
    if (ok) {
      if (editingCourse?.id === courseId) {
        setEditingCourse(null);
      }
      await onCatalogUpdated();
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
    const q = createEmptyQuizQuestion(defaultTitle);
    const newLesson: Lesson = {
      id: newId,
      title: defaultTitle,
      durationMinutes: 45,
      summary: `شرح ومحتوى ${defaultTitle}`,
      keyTakeaways: ['النقطة الأساسية الأولى في الحصة', 'تدريبات وتطبيقات محلولة'],
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

  const handleAddVideoLink = (lessonId: string) => {
    const url = (videoLinkUrlDraft[lessonId] || '').trim();
    if (!url) {
      setEditorFeedback('يرجى إدخال رابط الفيديو أولًا.');
      return;
    }
    const lesson = editingLessons.find((l) => l.id === lessonId);
    const nextNum = (lesson?.videos?.length ?? 0) + 1;
    const title = (videoLinkTitleDraft[lessonId] || '').trim() || `فيديو الشرح ${nextNum}`;
    const newVideo: LessonVideo = {
      id: `vid-${Date.now()}`,
      title,
      url,
      sourceType: 'link',
    };
    updateLessonField(lessonId, (les) => ({
      ...les,
      videos: [...(les.videos ?? []), newVideo],
    }));
    setVideoLinkTitleDraft((p) => ({ ...p, [lessonId]: '' }));
    setVideoLinkUrlDraft((p) => ({ ...p, [lessonId]: '' }));
    setEditorFeedback('');
  };

  const handleUploadVideoFile = async (lessonId: string, file: File | undefined) => {
    if (!file) return;
    setUploadingKey(`vid-${lessonId}`);
    setEditorFeedback('');
    try {
      const res = await apiUploadMediaFile(token, file);
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
      };
      updateLessonField(lessonId, (les) => ({
        ...les,
        videos: [...(les.videos ?? []), newVideo],
      }));
      setVideoUploadTitleDraft((p) => ({ ...p, [lessonId]: '' }));
    } finally {
      setUploadingKey(null);
    }
  };

  const handleRemoveVideo = (lessonId: string, videoId: string) => {
    updateLessonField(lessonId, (les) => ({
      ...les,
      videos: (les.videos ?? []).filter((v) => v.id !== videoId),
    }));
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
      const newAtt: LessonAttachment = {
        id: `att-${Date.now()}`,
        title: customTitle,
        url: res.url,
        fileName: res.fileName,
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
    const url = (fileLinkUrlDraft[lessonId] || '').trim();
    if (!url) {
      setEditorFeedback('يرجى إدخال رابط الملف أولًا.');
      return;
    }
    const lesson = editingLessons.find((l) => l.id === lessonId);
    const nextNum = (lesson?.attachments?.length ?? 0) + 1;
    const title = (fileLinkTitleDraft[lessonId] || '').trim() || `ملف الحصة ${nextNum}`;
    const newAtt: LessonAttachment = {
      id: `att-${Date.now()}`,
      title,
      url,
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
      const next = [...current, createEmptyQuizQuestion(les.title)];
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
        return {
          ...les,
          examQuestions: qs,
          quiz: qs[0],
        };
      });

      const updatedCourse: Course = {
        ...editingCourse,
        fallbackTitle: editingCourse.title.trim(),
        totalHours: Math.max(2, normalizedLessons.length * 2),
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

  const resolveTeacherLabel = (instructorId: string) => {
    const dyn = teachers.find((t) => t.id === instructorId);
    if (dyn) return `${dyn.name} (${dyn.subject})`;
    const built = INSTRUCTORS.find((i) => i.id === instructorId);
    return built ? built.name : 'مدرس المادة';
  };

  const bacCount = students.filter((s) => s.stage === 'البكالوريا').length;
  const secCount = students.filter((s) => s.stage !== 'البكالوريا').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-1">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">إدارة المنصة · {supervisorPhone}</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900">
            إدارة المدرسين والكورسات ومتابعة الطلاب
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            مرحباً {supervisorName} — أضف المدرسين، تحكم في الكورسات والحصص والفيديوهات والملفات والامتحانات، وتابع الطلاب.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="text-xs text-slate-500 mb-1.5">إجمالي الطلاب المسجلين</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">{students.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="text-xs text-slate-500 mb-1.5">طلاب الثانوي / البكالوريا</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {secCount} / {bacCount}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="text-xs text-slate-500 mb-1.5">المدرسون المضافون</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">{teachers.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="text-xs text-slate-500 mb-1.5">إجمالي الكورسات</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {allCourses.length}
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="أقسام الإدارة"
        className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full"
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
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>بيانات ومتابعة الطلاب</span>
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
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
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
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
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
            className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4 min-w-0"
          >
            <h2 className="text-base font-bold text-slate-900">إضافة مدرس جديد</h2>
            <p className="text-xs text-slate-500">
              يظهر المدرس مباشرة في شريط التمرير بالصفحة الأولى للمنصة.
            </p>

            <div>
              <label
                htmlFor="teacher-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
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
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="teacher-subject-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                المادة الدراسية
              </label>
              <input
                id="teacher-subject-input"
                type="text"
                required
                value={teacherSubject}
                onChange={(e) => setTeacherSubject(e.target.value)}
                placeholder="مثال: الرياضيات، الفيزياء، الكيمياء..."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                صورة المدرس
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer">
                  <ImagePlus className="w-4 h-4 text-blue-700" />
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
                    className="text-xs text-red-700 hover:underline"
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
                className="mt-2 w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              {teacherImage && (
                <div className="mt-3 w-28 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={teacherImage}
                    alt="معاينة صورة المدرس"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              )}
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-2">
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
                          ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {stage}
                    </button>
                  );
                })}
              </div>
            </div>

            {teacherFeedback && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-900">
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

          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4 min-w-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                المدرسون الحاليون في الصفحة الأولى
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                {teachers.length} مدرس
              </span>
            </div>

            {teachers.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                لم تقم بإضافة مدرسين بعد. استخدم النموذج لإضافة أول مدرس بصورته واسمه ومادته.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {teachers.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between bg-slate-50/40"
                  >
                    <div>
                      <div className="aspect-[4/3] bg-slate-100 border-b border-slate-200 overflow-hidden">
                        <ResilientImage
                          src={t.image}
                          alt={t.name}
                          fallbackTitle={t.name}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      <div className="p-4 space-y-1.5">
                        <h3 className="text-base font-bold text-slate-900">{t.name}</h3>
                        <div className="text-xs font-semibold text-blue-700">
                          مدرس مادة: {t.subject}
                        </div>
                        <div className="text-xs text-slate-500">{t.grades.join(' · ')}</div>
                      </div>
                    </div>
                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        onClick={() => handleDeleteTeacher(t.id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف المدرس</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'courses' && !editingCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleAddCourseSubmit}
            className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4 min-w-0"
          >
            <h2 className="text-base font-bold text-slate-900">إضافة كورس جديد لمرحلة دراسية</h2>
            <p className="text-xs text-slate-500">
              بعد إضافة الكورس ستفتح لك مباشرة لوحة التحكم لرفع فيديوهات الحصص، إضافة روابط الفيديو، رفع الملفات، ووضع امتحان لكل حصة.
            </p>

            <div>
              <label
                htmlFor="course-grade-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                المرحلة الدراسية (السنة)
              </label>
              <select
                id="course-grade-select"
                value={courseGrade}
                onChange={(e) => setCourseGrade(e.target.value as EducationalStage)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
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
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                المدرس المسؤول عن الكورس
              </label>
              <select
                id="course-teacher-select"
                value={courseTeacherId}
                onChange={(e) => setCourseTeacherId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
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
                htmlFor="course-title-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
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
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="course-subtitle-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                وصف مختصر للكورس
              </label>
              <input
                id="course-subtitle-input"
                type="text"
                value={courseSubtitle}
                onChange={(e) => setCourseSubtitle(e.target.value)}
                placeholder="محتوى الكورس وأبرز النقاط المغطاة"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="course-mode-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  نظام الحضور
                </label>
                <select
                  id="course-mode-select"
                  value={courseMode}
                  onChange={(e) =>
                    setCourseMode(e.target.value as 'أونلاين' | 'سنتر وأونلاين')
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  <option value="سنتر وأونلاين">سنتر وأونلاين</option>
                  <option value="أونلاين">أونلاين</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="course-price-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  السعر الشهري (ج.م)
                </label>
                <input
                  id="course-price-input"
                  type="number"
                  min={0}
                  value={coursePrice}
                  onChange={(e) => setCoursePrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="course-lessons-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                عناوين الحصص المبدئية (كل حصة في سطر)
              </label>
              <textarea
                id="course-lessons-input"
                rows={4}
                value={courseLessonsText}
                onChange={(e) => setCourseLessonsText(e.target.value)}
                placeholder={'الحصة الأولى: الأساسيات\nالحصة الثانية: حل تمارين شاملة\nالحصة الثالثة: امتحان تطبيقي'}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            {courseFeedback && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-900">
                {courseFeedback}
              </div>
            )}

            <button
              type="submit"
              disabled={courseSaving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{courseSaving ? 'جاري الحفظ...' : 'إضافة الكورس والتحكم في حصصه'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  التحكم في الكورسات والحصص
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  اضغط «التحكم في الحصص والمحتوى» لتعديل ترتيب الحصص، إضافة فيديوهات، ملفات، أو امتحان الحصة.
                </p>
              </div>
              <span className="text-xs text-slate-500 tabular-nums shrink-0">
                {allCourses.length} كورس
              </span>
            </div>

            <div className="space-y-3">
              {allCourses.map((c) => {
                const lessonsCount = getCourseAllLessons(c).length;
                const isBuiltIn = builtInCourseIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-semibold text-blue-700">
                        {c.grade} · {resolveTeacherLabel(c.instructorId)} ·{' '}
                        <span className="tabular-nums">{lessonsCount} حصة</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 break-words">
                        {c.title}
                      </h3>
                      <p className="text-xs text-slate-500 break-words">{c.subtitle}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openCourseEditor(c)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>التحكم في الحصص والمحتوى</span>
                      </button>

                      {!isBuiltIn && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(c.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      )}
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
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div className="space-y-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة إلى قائمة الكورسات</span>
                </button>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 break-words">
                  التحكم في محتوى الكورس: {editingCourse.title}
                </h2>
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
              <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs sm:text-sm font-medium text-blue-900">
                {editorFeedback}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم الكورس
                </label>
                <input
                  type="text"
                  value={editingCourse.title}
                  onChange={(e) =>
                    setEditingCourse({ ...editingCourse, title: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  {EDUCATIONAL_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  السعر الشهري (ج.م)
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
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  وصف الكورس
                </label>
                <input
                  type="text"
                  value={editingCourse.subtitle}
                  onChange={(e) =>
                    setEditingCourse({ ...editingCourse, subtitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>
          </div>

          {/* Vertical Stack of Lessons */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  حصص الكورس بالترتيب ({editingLessons.length} حصة)
                </h3>
                <p className="text-xs text-slate-500">
                  الحصص مرتبة واحدة تحت الأخرى؛ داخل كل حصة يمكنك إضافة عدة فيديوهات (رفع أو لينك)، رفع ملفات، وتعديل امتحان الحصة.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddNewLesson}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
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
                const examQuestions =
                  lesson.examQuestions && lesson.examQuestions.length > 0
                    ? lesson.examQuestions
                    : [lesson.quiz];

                return (
                  <div
                    key={lesson.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                  >
                    {/* Lesson Header Row */}
                    <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
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
                          <div className="text-xs font-semibold text-blue-700">
                            الحصة {lIdx + 1}
                          </div>
                          <div className="text-sm sm:text-base font-bold text-slate-900 break-words">
                            {lesson.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                            {videos.length} فيديو · {attachments.length} ملف ·{' '}
                            {examQuestions.length} سؤال امتحان
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                        )}
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={lIdx === 0}
                          onClick={() => handleMoveLesson(lIdx, 'up')}
                          aria-label="نقل الحصة لأعلى"
                          className="p-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={lIdx === editingLessons.length - 1}
                          onClick={() => handleMoveLesson(lIdx, 'down')}
                          aria-label="نقل الحصة لأسفل"
                          className="p-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLesson(lesson.id)}
                          aria-label="حذف الحصة"
                          className="p-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 sm:p-6 space-y-6">
                        {/* Lesson Meta */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div className="sm:col-span-3">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              عنوان الحصة
                            </label>
                            <input
                              type="text"
                              value={lesson.title}
                              onChange={(e) =>
                                updateLessonField(lesson.id, (les) => ({
                                  ...les,
                                  title: e.target.value,
                                }))
                              }
                              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              المدة (بالدقائق)
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={lesson.durationMinutes}
                              onChange={(e) =>
                                updateLessonField(lesson.id, (les) => ({
                                  ...les,
                                  durationMinutes: Number(e.target.value) || 30,
                                }))
                              }
                              className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              ملخص شرح الحصة
                            </label>
                            <textarea
                              rows={2}
                              value={lesson.summary}
                              onChange={(e) =>
                                updateLessonField(lesson.id, (les) => ({
                                  ...les,
                                  summary: e.target.value,
                                }))
                              }
                              className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                            />
                          </div>
                        </div>

                        {/* Section 1: Multiple Videos (Link + Upload) */}
                        <div className="rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4 bg-slate-50/40">
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <Film className="w-4 h-4 text-blue-700" />
                              <h4 className="text-sm font-bold text-slate-900">
                                فيديوهات الحصة ({videos.length})
                              </h4>
                            </div>
                            <span className="text-xs text-slate-500">
                              يمكنك إضافة أكثر من فيديو (رفع أو لينك)
                            </span>
                          </div>

                          {videos.length > 0 && (
                            <div className="space-y-2">
                              {videos.map((vid, vIdx) => (
                                <div
                                  key={vid.id}
                                  className="p-3 rounded-lg bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <Video className="w-4 h-4 text-blue-700 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs sm:text-sm font-bold text-slate-900 break-words">
                                        {vIdx + 1}. {vid.title}{' '}
                                        <span className="text-xs font-normal text-blue-700">
                                          ({vid.sourceType === 'upload' ? 'فيديو مرفوع' : 'لينك فيديو'})
                                        </span>
                                      </div>
                                      <div
                                        className="text-xs font-mono text-slate-500 truncate"
                                        dir="ltr"
                                      >
                                        {vid.url.startsWith('data:')
                                          ? 'ملف فيديو محفوظ محليًا'
                                          : vid.url}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVideo(lesson.id, vid.id)}
                                    className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 shrink-0 cursor-pointer"
                                  >
                                    حذف الفيديو
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Add Video via Link */}
                            <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-2.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                <Link2 className="w-3.5 h-3.5 text-blue-700" />
                                <span>إضافة لينك فيديو</span>
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
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <input
                                type="url"
                                dir="ltr"
                                value={videoLinkUrlDraft[lesson.id] ?? ''}
                                onChange={(e) =>
                                  setVideoLinkUrlDraft((p) => ({
                                    ...p,
                                    [lesson.id]: e.target.value,
                                  }))
                                }
                                placeholder="https://youtube.com/watch?v=... أو رابط MP4"
                                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddVideoLink(lesson.id)}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>إضافة لينك الفيديو</span>
                              </button>
                            </div>

                            {/* Upload Video from Device */}
                            <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-2.5 flex flex-col justify-between">
                              <div className="space-y-2.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                  <Upload className="w-3.5 h-3.5 text-blue-700" />
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
                                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                                />
                              </div>

                              <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer">
                                <Upload className="w-3.5 h-3.5 text-blue-700" />
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
                        <div className="rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4 bg-slate-50/40">
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-700" />
                              <h4 className="text-sm font-bold text-slate-900">
                                ملفات ومذكرات الحصة للطلاب ({attachments.length})
                              </h4>
                            </div>
                          </div>

                          {attachments.length > 0 && (
                            <div className="space-y-2">
                              {attachments.map((att) => (
                                <div
                                  key={att.id}
                                  className="p-3 rounded-lg bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs sm:text-sm font-bold text-slate-900 break-words">
                                      {att.title}
                                    </div>
                                    <div
                                      className="text-xs font-mono text-slate-500 truncate"
                                      dir="ltr"
                                    >
                                      {att.fileName || att.url}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveAttachment(lesson.id, att.id)
                                    }
                                    className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 shrink-0 cursor-pointer"
                                  >
                                    حذف الملف
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-2.5 flex flex-col justify-between">
                              <div className="space-y-2.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                  <FilePlus2 className="w-3.5 h-3.5 text-blue-700" />
                                  <span>رفع ملف للطلاب (PDF / مذكرة / صور)</span>
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
                                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                                />
                              </div>

                              <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer">
                                <Upload className="w-3.5 h-3.5 text-blue-700" />
                                <span>
                                  {uploadingKey === `file-${lesson.id}`
                                    ? 'جاري رفع الملف...'
                                    : 'اختر ملف لرفعه للطلاب'}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.zip,application/pdf"
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

                            <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-2.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                <Link2 className="w-3.5 h-3.5 text-blue-700" />
                                <span>إضافة رابط ملف خارجي (Drive / PDF)</span>
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
                                placeholder="اسم الملف"
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <input
                                type="url"
                                dir="ltr"
                                value={fileLinkUrlDraft[lesson.id] ?? ''}
                                onChange={(e) =>
                                  setFileLinkUrlDraft((p) => ({
                                    ...p,
                                    [lesson.id]: e.target.value,
                                  }))
                                }
                                placeholder="https://..."
                                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddAttachmentLink(lesson.id)}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-700 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>إضافة رابط الملف</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Lesson Exam Directly Underneath */}
                        <div className="rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4 bg-slate-50/40">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <HelpCircle className="w-4 h-4 text-blue-700" />
                              <h4 className="text-sm font-bold text-slate-900">
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
                            {examQuestions.map((q, qIdx) => (
                              <div
                                key={qIdx}
                                className="p-4 rounded-lg bg-white border border-slate-200 space-y-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-blue-700 tabular-nums">
                                    السؤال {qIdx + 1}
                                  </span>
                                  {examQuestions.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteExamQuestion(lesson.id, qIdx)
                                      }
                                      className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                                    >
                                      حذف السؤال
                                    </button>
                                  )}
                                </div>

                                <input
                                  type="text"
                                  value={q.question}
                                  onChange={(e) =>
                                    handleUpdateExamQuestion(lesson.id, qIdx, (prevQ) => ({
                                      ...prevQ,
                                      question: e.target.value,
                                    }))
                                  }
                                  placeholder="نص السؤال..."
                                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg"
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {q.options.map((opt, oIdx) => (
                                    <div
                                      key={oIdx}
                                      className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50"
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
                                        className="flex-1 min-w-0 bg-white px-2.5 py-1 text-xs border border-slate-200 rounded"
                                      />
                                    </div>
                                  ))}
                                </div>

                                <input
                                  type="text"
                                  value={q.explanation}
                                  onChange={(e) =>
                                    handleUpdateExamQuestion(lesson.id, qIdx, (prevQ) => ({
                                      ...prevQ,
                                      explanation: e.target.value,
                                    }))
                                  }
                                  placeholder="تفسير الإجابة الصحيحة (يظهر للطالب بعد الحل)..."
                                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                                />
                              </div>
                            ))}
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
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
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

      {activeTab === 'students' && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الطالب، رقم الطالب، رقم ولي الأمر، أو اسم الأم..."
                aria-label="بحث في الطلاب"
                className="w-full pr-10 pl-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <select
              aria-label="تصفية حسب المرحلة"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <option value="جميع المراحل">جميع المراحل</option>
              {EDUCATIONAL_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-900">
              {errorMsg}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">سجل بيانات الطلاب الكامل</h2>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {filteredStudents.length} طالب
              </span>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">
                جاري تحميل بيانات الطلاب...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                لا يوجد طلاب مطابقون لبحثك الحالي.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
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
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((stu) => (
                      <tr key={stu.id} className="hover:bg-slate-50/70">
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-900">{stu.studentName}</div>
                          <div
                            className="font-mono text-xs text-slate-500 mt-0.5 tabular-nums"
                            dir="ltr"
                          >
                            {stu.studentPhone}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-slate-800">{stu.parentName}</div>
                          <div
                            className="font-mono text-xs text-slate-500 mt-0.5 tabular-nums"
                            dir="ltr"
                          >
                            {stu.parentPhone}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-700">{stu.motherName}</td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-slate-900">{stu.stage}</div>
                          <div className="text-xs text-blue-700 mt-0.5">
                            {stu.specializationType}: {stu.specialization}
                          </div>
                        </td>
                        <td className="py-4 px-4 tabular-nums">
                          <div className="font-semibold text-slate-900">
                            حضور {stu.attendanceRate}%
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {stu.completedLessonIds.length} حصص · {stu.unlockedCourseIds.length}{' '}
                            كورسات
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <button
                            type="button"
                            onClick={() => openStudentFollowUp(stu)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            متابعة وتعديل
                          </button>
                        </td>
                      </tr>
                    ))}
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
            <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-4 sm:p-7 shadow-2xl space-y-5 overflow-x-hidden">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="min-w-0 flex-1">
                  <h3
                    id="sup-student-detail-title"
                    className="text-base sm:text-lg font-bold text-slate-900 break-words"
                  >
                    ملف متابعة الطالب: {selectedStudent.studentName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 break-words">
                    {selectedStudent.stage} · {selectedStudent.specializationType}:{' '}
                    {selectedStudent.specialization}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  aria-label="إغلاق"
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 rounded-lg border border-slate-200 p-3.5 sm:p-4 text-xs">
                <div className="min-w-0">
                  <span className="text-slate-500">رقم الطالب:</span>
                  <div className="font-mono font-semibold text-slate-900 mt-0.5 break-all" dir="ltr">
                    {selectedStudent.studentPhone}
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500">اسم ولي الأمر ورقمه:</span>
                  <div className="font-semibold text-slate-900 mt-0.5 break-words">
                    {selectedStudent.parentName} —{' '}
                    <span className="font-mono inline-block" dir="ltr">
                      {selectedStudent.parentPhone}
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500">اسم الأم:</span>
                  <div className="font-semibold text-slate-900 mt-0.5 break-words">
                    {selectedStudent.motherName}
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500">تاريخ التسجيل:</span>
                  <div className="font-mono text-slate-900 mt-0.5 tabular-nums">
                    {new Date(selectedStudent.createdAt).toLocaleDateString('ar-EG')}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveFollowUp} className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                    <label htmlFor="sup-attendance-slider">نسبة الحضور والالتزام</label>
                    <span className="font-mono text-blue-700 tabular-nums">{editAttendance}%</span>
                  </div>
                  <input
                    id="sup-attendance-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={editAttendance}
                    onChange={(e) => setEditAttendance(Number(e.target.value))}
                    className="w-full accent-blue-700 cursor-pointer"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-2">
                    الكورسات المفعلة للطالب ({selectedStudent.stage})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {allCourses
                      .filter((c) => c.grade === selectedStudent.stage)
                      .map((c) => {
                        const active = editCourses.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCourseForStudent(c.id)}
                            className={`w-full min-w-0 overflow-hidden p-2.5 text-right rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                              active
                                ? 'bg-blue-50 border-blue-300 text-blue-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate min-w-0 flex-1">{c.title}</span>
                            {active && <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="sup-notes-input"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    ملاحظات المتابعة
                  </label>
                  <textarea
                    id="sup-notes-input"
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                {savedNotice && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>تم حفظ التعديلات وتحديث ملف الطالب بنجاح.</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    إغلاق
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'جاري الحفظ...' : 'حفظ المتابعة'}</span>
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
