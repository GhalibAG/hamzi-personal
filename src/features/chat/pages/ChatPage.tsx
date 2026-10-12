// Chat Hamzi `/chat` — Chat.dc.html (HP, layar penuh tanpa navigasi bawah) · desktop: percakapan di tengah maks 760.
// UI-SPEC §7, CHAT-01…11, AI-02 (?review=minggu), CHAT-07 (?shared=1).
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ChatConversation } from '../components/ChatConversation';
import { ChatHeader } from '../components/ChatHeader';
import { useChatController, type ChatController } from '../hooks';

/** Tangani parameter sekali saja: review mingguan & kotak masuk "Bagikan ke Hamzi". */
function useChatParams(ctl: ChatController) {
  const [params, setParams] = useSearchParams();
  const handled = useRef(false);
  const review = params.get('review');
  const shared = params.get('shared');
  const ready = ctl.settingsReady && !ctl.loading;
  useEffect(() => {
    if (!ready || handled.current || (!review && !shared)) return;
    handled.current = true;
    const next = new URLSearchParams(params);
    next.delete('review');
    next.delete('shared');
    setParams(next, { replace: true });
    if (review === 'minggu') void ctl.weeklyReview();
    if (shared) void ctl.importShared();
  }, [ready, review, shared, params, setParams, ctl]);
}

export default function ChatPage() {
  const ctl = useChatController();
  const nav = useNavigate();
  useChatParams(ctl);
  const back = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) nav(-1);
    else nav('/');
  };
  return (
    // HP: lapisan tetap selayar (banner offline global tertutup; status offline tampil di dalam chat). Desktop: di area utama.
    <div className="fixed inset-0 z-30 flex flex-col bg-surface-2 lg:static lg:z-auto lg:h-full lg:bg-bg">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col lg:max-w-190 lg:border-x lg:border-line">
        <ChatHeader ctl={ctl} onBack={back} />
        <ChatConversation ctl={ctl} />
      </div>
    </div>
  );
}
