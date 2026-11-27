import { redirect } from 'next/navigation';
import { canTeachSession, requireUser } from '@/server/authz';
import { TeacherScreen } from './teacherScreen';

export default async function TeacherScreenPage(props: {
  params: Promise<{ sessionId: string }>;
}) {
  const { userId } = await requireUser();
  const { sessionId } = await props.params;
  // Chủ lớp hoặc chủ quiz của phiên
  if (!(await canTeachSession(userId, sessionId))) {
    redirect('/dashboard');
  }

  return (
    <div className="py-5">
      <TeacherScreen sessionId={sessionId} userId={userId} />
    </div>
  );
}
// EOF
