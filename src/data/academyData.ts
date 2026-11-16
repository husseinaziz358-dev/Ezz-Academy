export type GradeStage =
  | 'الصف الأول الثانوي'
  | 'الصف الثاني الثانوي'
  | 'الصف الثالث الثانوي'
  | 'البكالوريا';

export type CourseCategory =
  | 'رياضيات (عربي)'
  | 'Mathematics (لغات)'
  | 'مراجعات الإنقاذ والشوامل'
  | 'البرمجة والذكاء الاصطناعي'
  | string;

export type StudyMode = 'أونلاين' | 'سنتر وأونلاين';

export type SimulationKind =
  | 'math-calculus'
  | 'neural-convergence'
  | 'web-architecture';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
  summary: string;
  keyTakeaways: string[];
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

export const INSTRUCTORS: Instructor[] = [
  {
    id: 'inst-ezz',
    name: 'م. عز الدين أحمد',
    role: 'مؤسس المنصة وأستاذ الرياضيات',
    specialty: 'الرياضيات البحتة والتطبيقية (عربي ولغات)',
    gradesLabel: 'أولى · تانية · تالتة ثانوي',
    image: '/src/assets/images/instructor_ezz_1794781375371.jpg',
    bio: 'خبرة ١٥ عامًا في تدريس رياضيات الثانوية العامة واللغات وتأهيل أوائل الجمهورية عبر منهجية الفهم التطبيقي.',
  },
  {
    id: 'inst-salma',
    name: 'م. سلمى المنشاوي',
    role: 'رئيسة قسم البرمجة والذكاء الاصطناعي',
    specialty: 'Python والذكاء الاصطناعي للمرحلة الثانوية',
    gradesLabel: 'المرحلة الثانوية · مسار البرمجة',
    image: '/src/assets/images/instructor_salma_1794781374302.jpg',
    bio: 'مهندسة برمجيات متخصصة في تأهيل طلاب الثانوية لمسابقات البرمجة وبناء مشاريع الذكاء الاصطناعي.',
  },
  {
    id: 'inst-karim',
    name: 'م. كريم الشاذلي',
    role: 'مدرس الإحصاء والتأسيس الرياضي',
    specialty: 'مراجعات الإنقاذ والإحصاء وأولى ثانوي',
    gradesLabel: 'أولى ثانوي · مراجعات تالتة ثانوي',
    image: '/src/assets/images/instructor_karim_1794781375680.jpg',
    bio: 'متخصص في المراجعات النهائية، حل بنوك الأسئلة، ومتابعة طلاب السنتر والأونلاين أسبوعيًا.',
  },
];

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

export const COURSES: Course[] = [
  {
    id: 'course-sec3-pure-applied',
    title: 'الرياضيات البحتة والتطبيقية الشاملة — الصف الثالث الثانوي',
    subtitle: 'شرح تفصيلي لجميع فروع علمي رياضة مع حل أكثر من ١٥٠٠ مسألة وامتحانات أسبوعية بنظام البابل شيت.',
    grade: 'الصف الثالث الثانوي',
    category: 'رياضيات (عربي)',
    studyMode: 'سنتر وأونلاين',
    priceEgp: 240,
    totalHours: 36,
    instructorId: 'inst-ezz',
    image: '/src/assets/images/course_math_calculus_1794779284413.jpg',
    fallbackTitle: 'رياضيات الصف الثالث الثانوي',
    freePreview: true,
    modules: [
      {
        id: 'mod-sec3-calc',
        title: 'الوحدة الأولى: التفاضل وتطبيقات القيم العظمى والصغرى',
        lessons: [
          {
            id: 'les-sec3-1',
            title: 'معدل التغير، المشتقة الأولى، ومعادلة المماس والعمودي',
            durationMinutes: 42,
            summary:
              'نستعرض العلاقة الهندسية بين ميل المماس للمنحنى وقيمة المشتقة الأولى عند نقطة التماس، مع تطبيقات مباشرة من امتحانات الثانوية العامة.',
            keyTakeaways: [
              'ميل المماس عند س = أ يساوي المشتقة الأولى دَ(أ).',
              'ميل العمودي يساوي سالب مقلوب ميل المماس بشرط ألا يساوي المماس صفرًا.',
              'عند القيم العظمى والصغرى المحلية يكون المماس أفقيًا (المشتقة تساوي صفرًا أو غير معرفة).',
            ],
            simulationKind: 'math-calculus',
            quiz: {
              question: 'إذا كان ميل المماس لمنحنى د(س) عند نقطة ما يساوي ٢، فما ميل العمودي على المنحنى عند نفس النقطة؟',
              options: ['-٠.٥', '٢', '-٢', '٠.٥'],
              correctIndex: 0,
              explanation:
                'حاصل ضرب ميل المماس في ميل العمودي يساوي -١؛ إذن ميل العمودي = -١ / ٢ = -٠.٥.',
            },
          },
          {
            id: 'les-sec3-2',
            title: 'تزايد وتناقص الدوال ونقط الانقلاب',
            durationMinutes: 38,
            summary:
              'تحديد فترات التزايد والتناقص من إشارة المشتقة الأولى، ودراسة التحدب لأعلى ولأسفل عبر المشتقة الثانية.',
            keyTakeaways: [
              'الدالة متزايدة في الفترة التي تكون فيها دَ(س) > ٠.',
              'نقطة الانقلاب يتغير عندها اتجاه التحدب وتنعدم عندها المشتقة الثانية أو تكون غير معرفة.',
              'اختبار المشتقة الثانية يحدد نوع النقطة الحرجة بسرعة في مسائل الاختيار من متعدد.',
            ],
            simulationKind: 'math-calculus',
            quiz: {
              question: 'إذا كانت دَ(٣) = ٠ وكانت دً(٣) = -٥ < ٠، فإن للدالة عند س = ٣:',
              options: [
                'قيمة عظمى محلية',
                'قيمة صغرى محلية',
                'نقطة انقلاب',
                'لا توجد نقطة حرجة',
              ],
              correctIndex: 0,
              explanation:
                'عندما تنعدم المشتقة الأولى وتكون المشتقة الثانية سالبة، يكون المنحنى محدبًا لأعلى مما يعني وجود قيمة عظمى محلية.',
            },
          },
        ],
      },
      {
        id: 'mod-sec3-dyn',
        title: 'الوحدة الثانية: تطبيقات الاستاتيكا والديناميكا',
        lessons: [
          {
            id: 'les-sec3-3',
            title: 'تفاضل الدوال المتجهة والحركة في خط مستقيم',
            durationMinutes: 35,
            summary:
              'الربط بين الإزاحة والسرعة والعجلة بالتفاضل والتكامل المحدد وقراءة منحنيات (السرعة - الزمن).',
            keyTakeaways: [
              'السرعة ع هي مشتقة الموضع بالنسبة للزمن، والعجلة جـ هي مشتقة السرعة.',
              'المساحة تحت منحنى (ع - ن) تمثل الإزاحة عند أخذ الإشارة في الاعتبار.',
              'تكون الحركة متسارعة عندما يكون ع × جـ > ٠.',
            ],
            simulationKind: 'math-calculus',
            quiz: {
              question: 'متى تكون حركة الجسيم متسارعة في اللحظة ن؟',
              options: [
                'عندما يكون حاصل ضرب السرعة في العجلة موجبًا (ع × جـ > ٠)',
                'عندما تكون السرعة سالبة دائمًا',
                'عندما تنعدم العجلة تمامًا',
                'عندما تكون الإزاحة تساوي صفرًا',
              ],
              correctIndex: 0,
              explanation:
                'تتسارع الحركة عندما تكون السرعة والعجلة في نفس الاتجاه، أي لهما نفس الإشارة (ع × جـ > ٠).',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'course-sec3-math-lang',
    title: 'Pure & Applied Mathematics — 3rd Secondary (لغات)',
    subtitle: 'Full Calculus, Algebra, Statics & Dynamics curriculum in English with bilingual concept explanations.',
    grade: 'الصف الثالث الثانوي',
    category: 'Mathematics (لغات)',
    studyMode: 'سنتر وأونلاين',
    priceEgp: 260,
    totalHours: 34,
    instructorId: 'inst-ezz',
    image: '/src/assets/images/course_math_languages_1794779284241.jpg',
    fallbackTitle: 'Mathematics 3rd Secondary',
    modules: [
      {
        id: 'mod-lang-1',
        title: 'Unit 1: Differentiation & Curve Sketching',
        lessons: [
          {
            id: 'les-lang-1',
            title: 'Implicit Differentiation & Related Time Rates',
            durationMinutes: 40,
            summary:
              'Solving related rates geometry problems step by step with live curve slope inspection.',
            keyTakeaways: [
              'Always differentiate every variable with respect to time t using the chain rule.',
              'Substitute instantaneous values only AFTER completing the differentiation step.',
              'Verify sign consistency: decreasing lengths have negative rates of change.',
            ],
            simulationKind: 'math-calculus',
            quiz: {
              question: 'In related time rates problems, when should we substitute numerical values for changing quantities?',
              options: [
                'After differentiating the geometric relation with respect to time t',
                'Before writing the algebraic equation',
                'Before differentiating the equation',
                'Only for constant parameters that never change',
              ],
              correctIndex: 0,
              explanation:
                'Substituting variable values before differentiation turns them into constants whose derivative would wrongly become zero.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'course-sec3-rescue',
    title: 'معسكر مراجعات الإنقاذ وشوامل الأوائل — تالتة ثانوي',
    subtitle: 'تجميع كامل لأفكار الامتحانات المتوقعة وحل ٣٠ امتحانًا شاملًا في البحتة والتطبيقية بأسلوب السنتر.',
    grade: 'الصف الثالث الثانوي',
    category: 'مراجعات الإنقاذ والشوامل',
    studyMode: 'أونلاين',
    priceEgp: 180,
    totalHours: 22,
    instructorId: 'inst-karim',
    image: '/src/assets/images/course_math_calculus_1794779284413.jpg',
    fallbackTitle: 'مراجعات الإنقاذ تالتة ثانوي',
    modules: [
      {
        id: 'mod-rescue-1',
        title: 'المراجعة الأولى: ليالي امتحان التفاضل والجبر',
        lessons: [
          {
            id: 'les-rescue-1',
            title: 'أهم ٢٥ فكرة امتحانية في التكامل المحدد والمساحات',
            durationMinutes: 45,
            summary:
              'مراجعة مركزة لطرق التكامل بالتعويض والتجزيء وحساب المساحات والحجوم الدورانية بسرعة ودقة.',
            keyTakeaways: [
              'التكامل المحدد من أ إلى ب يعطي المساحة الجبرية؛ لذا نفصل الفترات عند نقاط التقاطع مع محور السينات.',
              'الدوال الفردية تكاملها المتماثل من -أ إلى أ يساوي صفرًا مباشرة.',
              'مراجعة الوحدات واستخدام الآلة الحاسبة للتحقق من الناتج العددي في البابل شيت.',
            ],
            simulationKind: 'math-calculus',
            quiz: {
              question: 'ما قيمة التكامل المحدد من -٤ إلى ٤ للدالة الفردية د(س) = س³ + س؟',
              options: ['٠', '٨', '١٦', '-٨'],
              correctIndex: 0,
              explanation:
                'لأن الدالة فردية وحدود التكامل متماثلة حول الصفر [-٤، ٤]، فإن التكامل المحدد يساوي صفرًا.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'course-sec2-math',
    title: 'الرياضيات البحتة والتطبيقية — الصف الثاني الثانوي',
    subtitle: 'تغطية كاملة لمنهج العلمي والأدبي في الجبر والتفاضل والمثلثات والاستاتيكا تمهيدًا لتالتة ثانوي.',
    grade: 'الصف الثاني الثانوي',
    category: 'رياضيات (عربي)',
    studyMode: 'سنتر وأونلاين',
    priceEgp: 190,
    totalHours: 24,
    instructorId: 'inst-ezz',
    image: '/src/assets/images/course_math_calculus_1794779284413.jpg',
    fallbackTitle: 'رياضيات الصف الثاني الثانوي',
    modules: [
      {
        id: 'mod-sec2-1',
        title: 'الوحدة الأولى: النهايات والاتصال ورسم الدوال',
        lessons: [
          {
            id: 'les-sec2-1',
            title: 'نهاية الدالة عند نقطة وعند اللانهاية والتحويلات الهندسية',
            durationMinutes: 32,
            summary:
              'فهم النهايات بيانيًا وجبريًا واستنتاج مدى الدالة واطرادها ونوعها (زوجية أم فردية) من الرسم.',
            keyTakeaways: [
              'وجود النهاية يتطلب تساوي النهاية اليمنى مع النهاية اليسرى.',
              'الإزاحة الأفقية والرأسية تغير رأس المنحنى وتنقل محور التماثل.',
              'الدالة المتصلة لا تحتوي على فجوات أو قفزات عند النقطة المدروسة.',
            ],
            simulationKind: 'math-calculus',
            quiz: {
              question: 'ما شرط وجود نهاية للدالة د(س) عندما تقترب س من أ؟',
              options: [
                'تساوي النهاية اليمنى والنهاية اليسرى عند أ',
                'أن تكون الدالة معرفة عند أ فقط',
                'أن تمر الدالة بنقطة الأصل',
                'أن تكون الدالة زوجية',
              ],
              correctIndex: 0,
              explanation:
                'تُوجد النهاية عند نقطة إذا وفقط إذا اقتربت الدالة من نفس القيمة من اليمين ومن اليسار.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'course-sec1-math',
    title: 'التأسيس الشامل في الرياضيات — الصف الأول الثانوي',
    subtitle: 'شرح مبسط لمنهج أولى ثانوي (الجبر، حساب المثلثات، وتشابه المثلثات) مع اختبارات إلكترونية مستمرة.',
    grade: 'الصف الأول الثانوي',
    category: 'رياضيات (عربي)',
    studyMode: 'سنتر وأونلاين',
    priceEgp: 160,
    totalHours: 20,
    instructorId: 'inst-karim',
    image: '/src/assets/images/course_math_languages_1794779284241.jpg',
    fallbackTitle: 'رياضيات الصف الأول الثانوي',
    freePreview: true,
    modules: [
      {
        id: 'mod-sec1-1',
        title: 'الوحدة الأولى: المعادلات التربيعية والأعداد المركبة',
        lessons: [
          {
            id: 'les-sec1-1',
            title: 'بحث إشارة الدالة التربيعية وتحديد نوع الجذرين',
            durationMinutes: 28,
            summary:
              'استخدام المميز (ب² - ٤أجـ) لتحديد تقاطع القطع المكافئ مع محور السينات وحل المتباينات التربيعية.',
            keyTakeaways: [
              'المميز الموجب يعني جذرين حقيقيين مختلفين ونقطتي تقاطع مع محور السينات.',
              'المميز السالب يعني عدم تقاطع المنحنى مع محور السينات وإشارة الدالة تتبع معامل س² دائمًا.',
              'تحديد إشارة الدالة هو الأساس لحل متباينات الدرجة الثانية.',
            ],
            simulationKind: 'math-calculus',
            quiz: {
              question: 'إذا كان المميز (ب² - ٤أجـ) لمعادلة تربيعية أقل من صفر، فما عدد نقط تقاطع منحناها مع محور السينات؟',
              options: ['صفر (لا يقطع محور السينات)', 'نقطة واحدة', 'نقطتان', 'ثلاث نقاط'],
              correctIndex: 0,
              explanation:
                'المميز السالب يعني عدم وجود جذور حقيقية، وبالتالي لا يقطع المنحنى محور السينات.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'course-sec-ai-coding',
    title: 'البرمجة والذكاء الاصطناعي لطلاب المرحلة الثانوية',
    subtitle: 'تعلم أساسيات Python، التفكير الخوارزمي، وبناء النماذج التنبؤية لطلاب أولى وتانية وتالتة ثانوي.',
    grade: 'الصف الأول الثانوي',
    category: 'البرمجة والذكاء الاصطناعي',
    studyMode: 'أونلاين',
    priceEgp: 200,
    totalHours: 18,
    instructorId: 'inst-salma',
    image: '/src/assets/images/course_ai_datascience_1794779036557.jpg',
    fallbackTitle: 'البرمجة والذكاء الاصطناعي',
    modules: [
      {
        id: 'mod-prog-1',
        title: 'الوحدة الأولى: أساسيات الخوارزميات والشبكات العصبية',
        lessons: [
          {
            id: 'les-prog-1',
            title: 'كيف يتعلم النموذج من البيانات؟ (معدل التعلم ودالة الخسارة)',
            durationMinutes: 26,
            summary:
              'تجربة عملية لضبط معدل التعلم ومعامل التنظيم في الشبكات العصبية لربط الرياضيات بالبرمجة.',
            keyTakeaways: [
              'التدريب هو عملية تقليل دالة الخطأ تدريجيًا باستخدام المشتقات (Gradient Descent).',
              'التنظيم (Regularization) يمنع النموذج من حفظ بيانات التدريب فقط.',
              'فهم التفاضل في الثانوية هو المدخل الحقيقي لهندسة الذكاء الاصطناعي.',
            ],
            codeSnippet: {
              language: 'python',
              label: 'تحديث الوزن في بايثون',
              code: `learning_rate = 0.15
for epoch in range(20):
    gradient = compute_gradient(weights, data)
    weights = weights - learning_rate * gradient`,
            },
            simulationKind: 'neural-convergence',
            quiz: {
              question: 'ما الدور الرياضي للمشتقة (Gradient) أثناء تدريب نموذج الذكاء الاصطناعي؟',
              options: [
                'تحديد اتجاه ومقدار تعديل الأوزان لتقليل خطأ النموذج',
                'حذف البيانات النصية من الذاكرة',
                'تحويل لغة بايثون إلى شيفرة آلة',
                'زيادة حجم الخط في الواجهة',
              ],
              correctIndex: 0,
              explanation:
                'الميل أو التدرج يوجه النموذج نحو الاتجاه الذي تنخفض فيه دالة الخسارة بأسرع شكل ممكن.',
            },
          },
        ],
      },
    ],
  },
];

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
> = {
  'EZZ-VIP-2026': {
    label: 'باقة التفعيل الشاملة لجميع كورسات Ezz Academy',
    courseIds: COURSES.map((c) => c.id),
  },
  'EZZ-3SEC-MATH': {
    label: 'باقة الصف الثالث الثانوي (عربي ولغات)',
    courseIds: ['course-sec3-pure-applied', 'course-sec3-math-lang', 'course-sec3-rescue'],
  },
  'EZZ-RESCUE-100': {
    label: 'كود معسكر مراجعات الإنقاذ وشوامل الأوائل',
    courseIds: ['course-sec3-rescue'],
  },
};

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

export function getInstructorById(id: string): Instructor {
  return INSTRUCTORS.find((i) => i.id === id) ?? INSTRUCTORS[0];
}
