/**
 * P2P trade chat — placeholder. Will become a full chat UI bound to the
 * Message model on the server (sender, receiver, type, metadata).
 */

import { useLocalSearchParams } from 'expo-router';
import { ScreenStub } from '@/components/ui/ScreenStub';
import { TopGradient } from '@/components/ui/ScreenShell';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ScreenStub
      title="Chat"
      subtitle={`Trade · ${id ?? '—'}`}
      description="Buyer ↔ seller messaging during a P2P trade. Includes payment proof upload, dispute escalation, and system events."
    />
  );
}
