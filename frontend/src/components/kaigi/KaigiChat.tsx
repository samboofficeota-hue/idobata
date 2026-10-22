import { Loader2, Mic, Send, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { cn } from "../../lib/utils";
import type {
  KaigiMembers,
  KaigiMessage,
  KaigiSpeaker,
} from "../../services/kaigi/types";
import { Button } from "../ui/button";
import { SPEAKERS, STEP_LABELS } from "./labels";
import {
  MAX_RECORDING_SEC,
  useVoiceInput,
  voiceInputSupported,
} from "./useVoiceInput";

interface KaigiChatProps {
  messages: KaigiMessage[];
  nickname: string;
  members?: KaigiMembers;
  isSending: boolean;
  onSend: (content: string) => Promise<boolean>;
  // 録音を文字にする。渡されなければマイクのボタンを出さない
  onTranscribe?: (audio: Blob) => Promise<string>;
}

const MAX_LABEL = `${MAX_RECORDING_SEC}秒`;

const formatSec = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

// 参加者とAIたちの会話。工程が変わったところに区切りを入れる
// お題に合わせたメンバーの名前と立場があれば、既定のものより優先する
const speakerOf = (speaker: KaigiSpeaker, members?: KaigiMembers) => {
  const base = SPEAKERS[speaker];
  const custom =
    speaker === "member1" || speaker === "member2" || speaker === "member3"
      ? members?.[speaker]
      : undefined;
  return custom ? { ...base, ...custom } : base;
};

const KaigiChat = ({
  messages,
  nickname,
  members,
  isSending,
  onSend,
  onTranscribe,
}: KaigiChatProps) => {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // 文字にした声は、書きかけの文章の後ろに足す（送るのは本人）
  const appendText = useCallback((text: string) => {
    setDraft((prev) => (prev.trim() ? `${prev.trimEnd()}\n${text}` : text));
  }, []);
  const noTranscribe = useCallback(async () => "", []);
  const voice = useVoiceInput(onTranscribe ?? noTranscribe, appendText);
  const [canUseVoice] = useState(
    () => Boolean(onTranscribe) && voiceInputSupported()
  );

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
          const speaker = speakerOf(m.speaker, members);
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
          placeholder={
            canUseVoice
              ? "思ったことを書くか、マイクを押して話してください"
              : "思ったことを書いてください（音声入力も使えます）"
          }
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex min-w-[5.5rem] shrink-0 flex-col gap-2">
          {canUseVoice && (
            <Button
              type="button"
              variant={voice.state === "recording" ? "destructive" : "outline"}
              disabled={voice.state === "transcribing"}
              onClick={voice.state === "recording" ? voice.stop : voice.start}
              aria-label={
                voice.state === "recording" ? "録音を止める" : "話して入力する"
              }
              className="gap-1 whitespace-nowrap"
            >
              {voice.state === "recording" ? (
                <>
                  <Square className="h-4 w-4" />
                  {formatSec(voice.elapsedSec)}
                </>
              ) : voice.state === "transcribing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  話す
                </>
              )}
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="gap-1 whitespace-nowrap"
          >
            <Send className="h-4 w-4" />
            送る
          </Button>
        </div>
      </form>
      {canUseVoice && (
        <p className="mt-1 min-h-5 text-sm" aria-live="polite">
          {voice.state === "recording" ? (
            <span className="text-rose-700">
              録音しています。話し終えたら、もう一度押してください（{MAX_LABEL}
              まで）
            </span>
          ) : voice.state === "transcribing" ? (
            <span className="text-neutral-600">文字にしています…</span>
          ) : voice.error ? (
            <span className="text-rose-700">{voice.error}</span>
          ) : null}
        </p>
      )}
    </div>
  );
};

export default KaigiChat;
