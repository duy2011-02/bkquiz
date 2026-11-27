export type ClassInfo = {
  id: string;
  name: string;
  classCode: string;
  createdAt: string;
  updatedAt: string;
  /** Lớp đã lưu trữ (kết thúc): không tạo phiên, không tham gia / thêm thành viên */
  archivedAt?: string | null;
  ownerTeacherId: string;
  ownerTeacher: { id: string; name: string | null; email: string | null };
  memberCount: number;
  userRole: 'student' | 'teacher';
  joinedAt: string;
};

export type Member = {
  userId: string;
  user: { id: string; name: string | null; email: string | null };
  roleInClass: 'student' | 'teacher';
  joinedAt: string;
};

export type Session = {
  id: string;
  status: 'lobby' | 'active' | 'ended';
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  quiz: { id: string; title: string };
  attemptCount: number;
  sessionName?: string | null; // Tên session (nếu có), mặc định là quiz.title
  durationSeconds?: number | null; // Thời gian làm bài (giây)
  scheduledStartAt?: string | null; // Thời gian bắt đầu đã lên lịch (cho lobby sessions)
  attempt?: {
    id: string;
    score: number | null;
    /** Điểm thang 10 */
    grade?: number | null;
    correctCount?: number | null;
    totalQuestions?: number | null;
    submittedAt: string | null;
    status: string;
  };
};

export type QuizLite = {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  ruleCount: number;
  durationSeconds: number | null;
  tags?: Array<{ id: string; name: string; normalizedName: string }>;
};

export function formatDate(dateString: string, locale: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

