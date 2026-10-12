// Panel Chat desktop 380 px (DeskChat.dc.html, DESIGN-SYSTEM §11.4). Komponen pesan & komposer dipakai bersama /chat.
import { useChatController } from '../hooks';
import { ChatConversation } from './ChatConversation';
import { ChatHeader } from './ChatHeader';

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const ctl = useChatController();
  return (
    <div className="flex h-full flex-col bg-surface-2">
      <ChatHeader ctl={ctl} variant="panel" onClose={onClose} />
      <ChatConversation ctl={ctl} variant="panel" />
    </div>
  );
}
