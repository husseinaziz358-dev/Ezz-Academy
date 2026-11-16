export type EducationalStage =
  | 'الصف الأول الثانوي'
  | 'الصف الثاني الثانوي'
  | 'الصف الثالث الثانوي'
  | 'البكالوريا';

export interface StudentNotification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface StudentRecord {
  id: string;
  studentName: string;
  studentPhone: string;
  parentName: string;
  parentPhone: string;
  motherName: string;
  stage: string;
  specializationType: 'شعبة' | 'مسار';
  specialization: string;
  unlockedCourseIds: string[];
  completedLessonIds: string[];
  quizAnswers: Record<string, number>;
  notesByLesson: Record<string, string>;
  supervisorNotes: string;
  attendanceRate: number;
  attendanceDates?: Record<string, string>;
  walletBalance?: number;
  isBlocked?: boolean;
  activeDeviceIds?: string[];
  notifications?: StudentNotification[];
  createdAt: string;
  updatedAt: string;
}

export const EDUCATIONAL_STAGES: EducationalStage[] = [
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي',
  'البكالوريا',
];

export const SECONDARY_BRANCHES: Record<
  Exclude<EducationalStage, 'البكالوريا'>,
  string[]
> = {
  'الصف الأول الثانوي': ['عام (عربي)', 'لغات (Mathematics)'],
  'الصف الثاني الثانوي': ['علمي (عربي)', 'علمي (لغات)', 'أدبي'],
  'الصف الثالث الثانوي': ['علمي رياضة', 'علمي علوم', 'أدبي', 'لغات (Mathematics)'],
};

export const BACCALAUREATE_TRACKS: string[] = [
  'مسار الطب وعلوم الحياة',
  'مسار الهندسة وعلوم الحاسب',
  'مسار الأعمال',
  'مسار الآداب والفنون',
];

export interface DynamicTeacher {
  id: string;
  name: string;
  subject: string;
  grades: EducationalStage[];
  image: string;
  createdAt: string;
}

