import { Lobby } from './studentLobby';

export default async function SessionLobbyPage(props: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const { sessionId } = await props.params;
  // The lobby draws its own full chalkboard (same frame as the attempt page)
  return <Lobby sessionId={sessionId} />;
}
// EOF
