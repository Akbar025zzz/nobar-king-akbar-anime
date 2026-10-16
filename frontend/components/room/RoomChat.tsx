"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { formatRelativeTime } from "@/lib/format";
import type { ChatMessageDTO } from "@/lib/types";

interface RoomChatProps {
  messages: ChatMessageDTO[];
  onSend: (text: string) => void;
  currentUserId: string | null;
  disabled?: boolean;
  className?: string;
}

export function RoomChat({ messages, onSend, currentUserId, disabled = false, className = "" }: RoomChatProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedToBottomRef = useRef(true);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (pinnedToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    pinnedToBottomRef.current = distance < 60;
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text.slice(0, 500));
    setDraft("");
  };

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-fog-600">
            Belum ada obrolan. Sapa teman-temanmu di sini.
          </p>
        ) : (
          messages.map((message) => {
            const own = message.userId === currentUserId;
            return (
              <div key={message.id} className={`flex gap-2.5 ${own ? "flex-row-reverse" : ""}`}>
                <Avatar name={message.username} color={message.avatarColor} size="sm" />
                <div className={`max-w-[78%] ${own ? "text-right" : ""}`}>
                  <div className={`flex items-baseline gap-2 ${own ? "flex-row-reverse" : ""}`}>
                    <span className="text-[11px] font-semibold text-fog-300">{message.username}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-fog-700">
                      {formatRelativeTime(message.createdAt)}
                    </span>
                  </div>
                  <p
                    className={`mt-1 inline-block rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                      own
                        ? "rounded-tr-sm bg-accent-500/15 text-accent-100"
                        : "rounded-tl-sm bg-white/[0.05] text-fog-200"
                    }`}
                  >
                    {message.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-white/[0.07] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={500}
            disabled={disabled}
            placeholder={disabled ? "Masuk untuk ikut mengobrol" : "Tulis pesan…"}
            className="input max-h-28 min-h-[42px] resize-none !py-2.5 text-[13px]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={disabled || draft.trim().length === 0}
            className="btn btn-primary !rounded-xl !px-3.5 !py-2.5"
            aria-label="Kirim pesan"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m4 12 16-7-5 7 5 7-16-7Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
