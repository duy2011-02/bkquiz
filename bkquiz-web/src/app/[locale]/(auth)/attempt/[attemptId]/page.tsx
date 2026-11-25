import { AttemptClient } from './studentAttempt';

export default async function AttemptPage(props: {
  params: Promise<{ locale: string; attemptId: string }>;
}) {
  const { attemptId } = await props.params;
  return <AttemptClient attemptId={attemptId} />;
}
