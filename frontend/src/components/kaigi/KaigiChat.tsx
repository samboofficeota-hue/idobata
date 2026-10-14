import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { cn } from "../../lib/utils";
import type { KaigiMessage } from "../../services/kaigi/types";
import { Button } from "../ui/button";
import { SPEAKERS, STEP_LABELS } from "./labels";

interface KaigiChatProps {
  messages: KaigiMessage[];
  nickname: string;
  isSending: boolean;
  onSend: (content: string) => Promise<boolean>;
}

// 参加者とAIたちの会話。工程が変わったところに区切りを入れる
const KaigiChat = ({
  messages,
  nickname,
  isSending,
  onSend,
}: KaigiChatProps) => {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // 発言が増えたら、会話の枠の中だけを一番下へ（ページ全体は動かさない）
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length, isSending]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;
    // 送れなかったときは、書いた文章を残しておく
    if (await onSend(content)) setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
  };

  return (
    <div className="flex flex-col">
      <div
        ref={listRef}
        className="max-h-[55vh] min-h-[240px] space-y-3 overflow-y-auto rounded-md border bg-neutral-50 p-3"
      >
        {messages.map((m, i) => {
          const isUser = m.speaker === "user";
          const speaker = SPEAKERS[m.speaker];
          const stepChanged = i > 0 && messages[i - 1].step !== m.step;
          return (
            <div key={`${m.createdAt}-${i}`}>
              {stepChanged && (
                <p className="my-3 text-center text-xs text-neutral-500">
                  ── 工程{m.step}「{STEP_LABELS[m.step]}」 ──
                </p>
              )}
              <div
                className={cn(
                  "flex flex-col",
                  isUser ? "items-end" : "items-start"
                )}
              >
                <span
                  className={cn(
                    "mb-1 rounded-full px-2 py-0.5 text-xs",
                    speaker.badge
                  )}
                >
                  {isUser ? nickname : speaker.name}
                  {!isUser && speaker.role && (
                    <span className="opacity-80">（{speaker.role}）</span>
                  )}
                </span>
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg border px-3 py-2 text-base leading-relaxed",
                    speaker.bubble
                  )}
                >
                  {m.content}
                </p>
              </div>
            </div>
          );
        })}
        {isSending && (
          <p className="text-sm text-neutral-500" aria-live="polite">
            考えています…
          </p>
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <label htmlFor="kaigi-input" className="sr-only">
          発言
        </label>
        <textarea
          id="kaigi-input"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="思ったことを書いてください（音声入力も使えます）"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="shrink-0 gap-1 whitespace-nowrap"
        >
          <Send className="h-4 w-4" />
          送る
        </Button>
      </form>
    </div>
  );
};

export default KaigiChat;
