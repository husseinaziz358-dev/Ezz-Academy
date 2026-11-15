# Ezz Academy Firestore Security Specification

## 1. Data Invariants
1. Every document under `/students/{studentUid}` MUST have `uid == studentUid`, match `^[a-zA-Z0-9_\-]+$`, and be created only by the authenticated, email-verified owner (`request.auth.uid == studentUid`).
2. PII fields (`studentPhone`, `parentName`, `parentPhone`, `motherName`, `email`) are isolated into `/students/{studentUid}/private/contact` and guarded by the Master Gate (`get()` on parent `/students/{studentUid}`).
3. Only the verified supervisor (`request.auth.token.email == 'fatmasoltan1972@gmail.com'` with `email_verified == true`) can list `/students`, modify `supervisorNotes`, modify `attendanceRate`, or delete student records.
4. Students can only update their own learning progress (`unlockedCourseIds`, `completedLessonIds`, `quizAnswers`, `notesByLesson`, `updatedAt`) and cannot escalate `attendanceRate`, `supervisorNotes`, `uid`, or `createdAt`.
5. Every `createdAt` and `updatedAt` timestamp must equal `request.time`.

## 2. Dirty Dozen Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /students/stu1` with `auth = null`.
2. **Unverified Email Write**: `CREATE /students/stu1` with `auth.token.email_verified = false`.
3. **Cross-User PII Read**: `GET /students/stu1/private/contact` as `auth.uid = 'stu2'`.
4. **Blanket List Scraping**: `LIST /students` as non-admin `auth.uid = 'stu2'`.
5. **Email Spoofing Admin**: `LIST /students` with `email = 'fatmasoltan1972@gmail.com'`, `email_verified = false`.
6. **Identity Spoofing on Create**: `CREATE /students/stu1` by `stu2` with `uid: 'stu1'`.
7. **Shadow Field Injection**: `CREATE /students/stu1` with extra field `isAdmin: true`.
8. **Privilege Escalation Update**: `UPDATE /students/stu1` by `stu1` modifying `attendanceRate: 100` or `supervisorNotes`.
9. **Immutable Timestamp Tampering**: `UPDATE /students/stu1` modifying `createdAt` or omitting `request.time` for `updatedAt`.
10. **ID Poisoning**: `GET /students/bad$id..with.chars` exceeding regex or length guard.
11. **Value Poisoning**: `UPDATE /students/stu1` with `unlockedCourseIds` containing > 20 entries or invalid type (`unlockedCourseIds: "all"`).
12. **Orphaned Private Subcollection**: `CREATE /students/stu1/private/contact` when parent `/students/stu1` does not exist.
