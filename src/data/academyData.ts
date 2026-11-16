export type GradeStage =
  | 'الصف الأول الثانوي'
  | 'الصف الثاني الثانوي'
  | 'الصف الثالث الثانوي'
  | 'البكالوريا';

export const PLATFORM_SUBJECTS = [
  'إنجليزي',
  'عربي',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Integrated Science',
  'فرنساوي',
] as const;

export type PlatformSubject = (typeof PLATFORM_SUBJECTS)[number];

export type CourseCategory = PlatformSubject | string;

export function normalizeSubjectCategory(raw: string): string {
  const val = (raw || '').trim().toLowerCase();
  if (!val) return '';
  if (
    val.includes('انجليز') ||
    val.includes('إنجليز') ||
    val.includes('english')
  ) {
    return 'إنجليزي';
  }
  if (
    val.includes('عرب') ||
    val.includes('arabic')
  ) {
    return 'عربي';
  }
  if (
    val.includes('math') ||
    val.includes('رياضيات') ||
    val.includes('تفاضل') ||
    val.includes('جبر') ||
    val.includes('إحصاء') ||
    val.includes('استاتيكا') ||
    val.includes('ديناميكا')
  ) {
    return 'Mathematics';
  }
  if (val.includes('phys') || val.includes('فيزياء')) {
    return 'Physics';
  }
  if (val.includes('chem') || val.includes('كيمياء')) {
    return 'Chemistry';
  }
  if (val.includes('integrated') || val.includes('متكاملة') || val.includes('science')) {
    return 'Integrated Science';
  }
  if (val.includes('فرنس') || val.includes('french')) {
    return 'فرنساوي';
  }
  return raw.trim();
}

export type StudyMode = 'أونلاين' | 'سنتر وأونلاين';

export type SimulationKind =
  | 'math-calculus'
  | 'neural-convergence'
  | 'web-architecture';

export interface QuizQuestion {
  question?: string;
  questionImage?: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface LessonVideo {
  id: string;
  title: string;
  url: string;
  sourceType: 'link' | 'upload';
  durationSeconds?: number;
}

export interface LessonAttachment {
  id: string;
  title: string;
  url: string;
  fileName?: string;
  fileType?: 'pdf' | 'file';
  mimeType?: string;
}

export interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
  summary: string;
  keyTakeaways: string[];
  videos?: LessonVideo[];
  attachments?: LessonAttachment[];
  examQuestions?: QuizQuestion[];
  codeSnippet?: {
    language: string;
    label: string;
    code: string;
  };
  simulationKind: SimulationKind;
  quiz: QuizQuestion;
}

export interface CourseModule {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Instructor {
  id: string;
  name: string;
  role: string;
  specialty: string;
  gradesLabel: string;
  image: string;
  bio: string;
  telegramSupport?: string;
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  grade: GradeStage;
  category: CourseCategory;
  studyMode: StudyMode;
  priceEgp: number;
  totalHours: number;
  instructorId: string;
  image: string;
  fallbackTitle: string;
  freePreview?: boolean;
  modules: CourseModule[];
}

export interface BookItem {
  id: string;
  title: string;
  subtitle: string;
  grade: GradeStage;
  priceEgp: number;
  pagesCount: number;
  image: string;
  includesCode: boolean;
}

export interface GradeStageInfo {
  grade: GradeStage;
  number: string;
  headline: string;
  description: string;
  branches: string[];
}

export interface Testimonial {
  id: string;
  studentName: string;
  gradeInfo: string;
  score: string;
  before: string;
  outcome: string;
}

export interface ParentExamRecord {
  id: string;
  examTitle: string;
  date: string;
  score: number;
  maxScore: number;
  attendanceMode: 'أونلاين' | 'السنتر';
  status: 'ممتاز' | 'جيد جدًا' | 'يحتاج مراجعة';
}

export const HERO_IMAGE = '/src/assets/images/hero_academy_studio_1794779037349.jpg';
export const BOOKS_IMAGE = '/src/assets/images/books_study_bundle_1794779284617.jpg';

export const INSTRUCTORS: Instructor[] = [];

export const GRADE_STAGES: GradeStageInfo[] = [
  {
    grade: 'الصف الثالث الثانوي',
    number: '03',
    headline: 'تالتة ثانوي — الشهادة الثانوية',
    description:
      'منهج علمي رياضة كامل (التفاضل والتكامل، الجبر والهندسة الفراغية، الاستاتيكا والديناميكا)، بالإضافة إلى مسار Mathematics لغات، وأدبي إحصاء، ومراجعات الإنقاذ.',
    branches: ['علمي رياضة (عربي)', 'Mathematics (لغات)', 'شوامل ومراجعات الإنقاذ'],
  },
  {
    grade: 'الصف الثاني الثانوي',
    number: '02',
    headline: 'تانية ثانوي — البحتة والتطبيقية',
    description:
      'تأسيس قوي يمهد للصف الثالث الثانوي في الجبر، التفاضل، حساب المثلثات، والاستاتيكا والهندسة لطلاب علمي وأدبي ومدارس اللغات.',
    branches: ['علمي (بحتة وتطبيقية)', 'أدبي (رياضيات عامة)', 'لغات (Math Sec 2)'],
  },
  {
    grade: 'الصف الأول الثانوي',
    number: '01',
    headline: 'أولى ثانوي — التأسيس الحديث',
    description:
      'بناء التفكير الرياضي وحل مسائل النظام الجديد (الاختيار من متعدد والمقالي) في الجبر، الهندسة، وحساب المثلثات، مع مقدمة البرمجة.',
    branches: ['منهج النظام الجديد (عربي)', 'Mathematics (لغات)', 'تأسيس البرمجة'],
  },
];

export const COURSES: Course[] = [];

export const BOOKS: BookItem[] = [
  {
    id: 'book-sec3-pure',
    title: 'كتاب البحتة والتطبيقية الشامل — تالتة ثانوي',
    subtitle: 'شرح منظم + ١٢٠٠ مسألة متدرجة الصعوبة + نموذج الإجابة بالخطوات.',
    grade: 'الصف الثالث الثانوي',
    priceEgp: 185,
    pagesCount: 420,
    image: BOOKS_IMAGE,
    includesCode: true,
  },
  {
    id: 'book-sec3-exams',
    title: 'بنك أسئلة شوامل الأوائل (٣٠ امتحانًا بالبابل شيت)',
    subtitle: 'تجميع امتحانات السنين السابقة والاسترشادية مع كود تفعيل حل الأسئلة فيديو.',
    grade: 'الصف الثالث الثانوي',
    priceEgp: 140,
    pagesCount: 280,
    image: '/src/assets/images/course_math_calculus_1794779284413.jpg',
    includesCode: true,
  },
  {
    id: 'book-sec3-lang',
    title: 'Pure & Applied Math Workbook — Sec 3 (لغات)',
    subtitle: 'كتاب التمارين والامتحانات الشاملة لمدارس اللغات والتجريبي.',
    grade: 'الصف الثالث الثانوي',
    priceEgp: 210,
    pagesCount: 390,
    image: '/src/assets/images/course_math_languages_1794779284241.jpg',
    includesCode: true,
  },
  {
    id: 'book-sec1-2-pack',
    title: 'مذكرة التأسيس المتكامل — أولى وتانية ثانوي',
    subtitle: 'خلاصة قوانين الجبر وحساب المثلثات والهندسة مع تمارين النظام الجديد.',
    grade: 'الصف الثاني الثانوي',
    priceEgp: 115,
    pagesCount: 210,
    image: BOOKS_IMAGE,
    includesCode: false,
  },
];

export const VALID_ACTIVATION_CODES: Record<
  string,
  { label: string; courseIds: string[] }
> = {};

export const DEMO_PARENT_EXAMS: ParentExamRecord[] = [
  {
    id: 'ex-1',
    examTitle: 'الامتحان الشامل الأول — التفاضل وتطبيقاته',
    date: '٢٠٢٦/١١/١٠',
    score: 28,
    maxScore: 30,
    attendanceMode: 'أونلاين',
    status: 'ممتاز',
  },
  {
    id: 'ex-2',
    examTitle: 'اختبار الحصة الثالثة — معادلة المماس والعمودي',
    date: '٢٠٢٦/١١/٠٤',
    score: 19,
    maxScore: 20,
    attendanceMode: 'السنتر',
    status: 'ممتاز',
  },
  {
    id: 'ex-3',
    examTitle: 'مراجعة الجبر والفراغية — الوحدة الأولى',
    date: '٢٠٢٦/١٠/٢٧',
    score: 24,
    maxScore: 30,
    attendanceMode: 'السنتر',
    status: 'جيد جدًا',
  },
  {
    id: 'ex-4',
    examTitle: 'التقييم التراكمي — الديناميكا والحركة المستقيمة',
    date: '٢٠٢٦/١٠/١٨',
    score: 16,
    maxScore: 25,
    attendanceMode: 'أونلاين',
    status: 'يحتاج مراجعة',
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't-1',
    studentName: 'عمر خالد محمود',
    gradeInfo: 'الصف الثالث الثانوي — علمي رياضة (القاهرة)',
    score: '٥٩ / ٦٠ في الرياضيات',
    before: 'كنت أواجه صعوبة في ربط رسومات التفاضل بمسائل القيم العظمى والصغرى.',
    outcome: 'المختبر التفاعلي وشرح السنتر ساعداني على فهم المنحنيات، وحققت الدرجة شبه النهائية.',
  },
  {
    id: 't-2',
    studentName: 'سارة طارق عبد الله',
    gradeInfo: '3rd Secondary — Mathematics (الجيزة)',
    score: '٥٨.٥ / ٦٠ في Pure & Applied Math',
    before: 'كنت أضيع وقتًا طويلًا في مسائل المعدلات الزمنية في امتحانات اللغات.',
    outcome: 'مع متابعة الواجبات الأسبوعية وحل كتاب الشوامل أصبحت أحل النموذج الكامل في نصف الوقت.',
  },
  {
    id: 't-3',
    studentName: 'أ. محمود الشريف (ولي أمر)',
    gradeInfo: 'ولي أمر طالب بالصف الثاني الثانوي (الإسكندرية)',
    score: 'متابعة أسبوعية منتظمة',
    before: 'كان من الصعب التأكد من انتظام ابني في المذاكرة أو أداء الامتحانات الأسبوعية.',
    outcome: 'بوابة ولي الأمر في Ezz Academy منحتني تقارير واضحة للحضور والدرجات أولًا بأول.',
  },
];

export function getCourseTotalLessons(course: Course): number {
  return course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
}

export function getCourseAllLessons(course: Course): Lesson[] {
  return course.modules.flatMap((m) => m.lessons);
}

const FALLBACK_INSTRUCTOR: Instructor = {
  id: '',
  name: 'مدرس المادة',
  role: '',
  specialty: '',
  gradesLabel: '',
  image: '',
  bio: '',
};

export function getInstructorById(id: string): Instructor {
  return INSTRUCTORS.find((i) => i.id === id) ?? FALLBACK_INSTRUCTOR;
}

export function getLessonVideosSeconds(
  lesson: Pick<Lesson, 'videos'>,
  measuredVideoSeconds?: Record<string, number>
): number {
  const videos = lesson.videos ?? [];
  return videos.reduce((sum, v) => {
    const measured = measuredVideoSeconds?.[v.id];
    const sec =
      typeof measured === 'number' && measured > 0
        ? measured
        : typeof v.durationSeconds === 'number' && v.durationSeconds > 0
          ? v.durationSeconds
          : 0;
    return sum + sec;
  }, 0);
}

export function getLessonEffectiveSeconds(
  lesson: Pick<Lesson, 'videos' | 'durationMinutes'>,
  measuredVideoSeconds?: Record<string, number>
): number {
  const videos = lesson.videos ?? [];
  if (videos.length > 0) {
    return getLessonVideosSeconds(lesson, measuredVideoSeconds);
  }
  return lesson.durationMinutes > 0 ? Math.round(lesson.durationMinutes * 60) : 0;
}

export function getLessonEffectiveMinutes(
  lesson: Pick<Lesson, 'videos' | 'durationMinutes'>,
  measuredVideoSeconds?: Record<string, number>
): number {
  const sec = getLessonEffectiveSeconds(lesson, measuredVideoSeconds);
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0;
}

export function getCourseEffectiveSeconds(
  course: Course,
  measuredVideoSeconds?: Record<string, number>
): number {
  return getCourseAllLessons(course).reduce(
    (sum, lesson) => sum + getLessonEffectiveSeconds(lesson, measuredVideoSeconds),
    0
  );
}

export function getCourseEffectiveMinutes(
  course: Course,
  measuredVideoSeconds?: Record<string, number>
): number {
  const sec = getCourseEffectiveSeconds(course, measuredVideoSeconds);
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0;
}

export function getCourseEffectiveHours(
  course: Course,
  measuredVideoSeconds?: Record<string, number>
): number {
  const sec = getCourseEffectiveSeconds(course, measuredVideoSeconds);
  return sec > 0 ? Number((sec / 3600).toFixed(2)) : 0;
}

export function formatArabicDurationFromSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 'غير محدد';
  if (totalSeconds < 60) return `${Math.round(totalSeconds)} ثانية`;
  const totalMinutes = Math.round(totalSeconds / 60);
  return formatArabicDurationFromMinutes(totalMinutes);
}

export function formatArabicDurationFromMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return 'غير محدد';
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours > 0 && mins > 0) return `${hours} ساعة و ${mins} دقيقة`;
  if (hours > 0) return `${hours} ساعة`;
  return `${mins} دقيقة`;
}
