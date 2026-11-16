import { Course, getCourseAllLessons } from '../data/academyData';

export interface AttendanceSummary {
  rate: number;
  watchedCount: number;
  totalLessons: number;
}

export function computeStudentAttendance(
  student: {
    unlockedCourseIds: string[];
    completedLessonIds: string[];
    stage?: string;
  },
  courses: Course[]
): AttendanceSummary {
  const unlockedSet = new Set(student.unlockedCourseIds || []);
  const completedSet = new Set(student.completedLessonIds || []);

  const enrolledCourses = courses.filter((c) => unlockedSet.has(c.id));
  if (enrolledCourses.length === 0) {
    return { rate: 0, watchedCount: 0, totalLessons: 0 };
  }

  const uniqueLessonIds: string[] = [];
  const seen = new Set<string>();
  for (const course of enrolledCourses) {
    for (const lesson of getCourseAllLessons(course)) {
      if (!seen.has(lesson.id)) {
        seen.add(lesson.id);
        uniqueLessonIds.push(lesson.id);
      }
    }
  }

  const totalLessons = uniqueLessonIds.length;
  if (totalLessons === 0) {
    return { rate: 0, watchedCount: 0, totalLessons: 0 };
  }

  const watchedCount = uniqueLessonIds.filter((id) => completedSet.has(id)).length;
  const rate = Math.max(0, Math.min(100, Math.round((watchedCount / totalLessons) * 100)));
  return { rate, watchedCount, totalLessons };
}

export function getTodayDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatAttendanceDateArabic(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getDistinctAttendanceDays(
  attendanceDates?: Record<string, string>
): string[] {
  if (!attendanceDates || typeof attendanceDates !== 'object') return [];
  const days = new Set(
    Object.values(attendanceDates).filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0
    )
  );
  return Array.from(days).sort((a, b) => b.localeCompare(a));
}

