import { ArrowRight, LayoutGrid, Timer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import BreadcrumbView from "../components/common/BreadcrumbView";
import KaigiChat from "../components/kaigi/KaigiChat";
import MeetingLink from "../components/kaigi/MeetingLink";
import OutputsCard from "../components/kaigi/OutputsCard";
import OverviewPanel from "../components/kaigi/OverviewPanel";
import SlideCard from "../components/kaigi/SlideCard";
import StepIndicator from "../components/kaigi/StepIndicator";
import { STEP_LABELS } from "../components/kaigi/labels";
import { formatClock, useCountdown } from "../components/kaigi/useCountdown";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useAuth } from "../contexts/AuthContext";
import { kaigiApi } from "../services/kaigi/kaigiApi";
import type {
  KaigiOutputs,
  KaigiRoom as KaigiRoomType,
  KaigiSession,
  KaigiSessionResponse,
  KaigiSlideContent,
} from "../services/kaigi/types";

// 工程ごとの「次へ」ボタンの文言
const ADVANCE_LABELS: Record<number, string> = {
  2: "書き終えたので、みんなの声を見る",
  3: "グループで課題を絞る",
  4: "課題の方向が決まった",
  5: "課題が決まった。アイディアを出す",
  6: "アイディアが出そろった",
  7: "そろそろ決める",
  8: "これで決める（ストーリーにする）",
};

const textareaClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const Countdown = ({ timing }: { timing: KaigiSession["timing"] }) => {
  const remaining = useCountdown(timing);
  if (!remaining) return null;
  const late = remaining.total < 0;
  return (
    <p
      className={`flex items-center gap-1 text-sm ${late ? "text-rose-700" : "text-neutral-700"}`}
      aria-live="off"
    >
      <Timer className="h-4 w-4" />
      {late
        ? "予定の20分を過ぎています"
        : `残り ${formatClock(remaining.total)}`}
      {!late && remaining.step !== null && (
        <span className="text-neutral-500">
          （この工程 {formatClock(Math.max(remaining.step, 0))}）
        </span>
      )}
    </p>
  );
};

const JoinForm = ({
  room,
  defaultNickname,
  isBusy,
  onJoin,
}: {
  room: KaigiRoomType;
  defaultNickname: string;
  isBusy: boolean;
  onJoin: (nickname: string) => void;
}) => {
  const [nickname, setNickname] = useState(defaultNickname);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) onJoin(nickname.trim());
  };
  return (
    <Card className="max-w-xl">
      <h2 className="text-xl font-bold">参加する</h2>
      <p className="mt-2 text-base text-neutral-700">
        できあがった提案は、このニックネームで壁に貼り出されます。本名でなくてかまいません。
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <Input
          label="ニックネーム"
          requiredMark
          maxLength={30}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <Button type="submit" disabled={isBusy || !nickname.trim()}>
          参加する
        </Button>
      </form>
      <p className="mt-3 text-sm text-neutral-500">
        参加できる人数：{room.capacity}人まで
      </p>
    </Card>
  );
};

const StoryStep = ({
  draft,
  isBusy,
  onRevise,
  onConfirm,
}: {
  draft: string;
  isBusy: boolean;
  onRevise: (comment: string) => Promise<boolean>;
  onConfirm: (story: string) => void;
}) => {
  const [story, setStory] = useState(draft);
  const [comment, setComment] = useState("");
  useEffect(() => setStory(draft), [draft]);

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="kaigi-story" className="font-bold">
          編集者がまとめたストーリー
        </label>
        <p className="mt-1 text-sm text-neutral-600">
          そのまま直接書き直すこともできます。
        </p>
        <textarea
          id="kaigi-story"
          rows={8}
          value={story}
          onChange={(e) => setStory(e.target.value)}
          className={`${textareaClass} mt-2`}
        />
      </div>
      <div>
        <label htmlFor="kaigi-comment" className="font-bold">
          編集者へのコメント
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="kaigi-comment"
            value={comment}
            placeholder="例：もっと短く／経験の話を入れてほしい"
            onChange={(e) => setComment(e.target.value)}
            className={textareaClass}
          />
          <Button
            variant="outline"
            disabled={isBusy || !comment.trim()}
            onClick={async () => {
              if (await onRevise(comment.trim())) setComment("");
            }}
            className="shrink-0"
          >
            書き直してもらう
          </Button>
        </div>
      </div>
      <Button
        disabled={isBusy || !story.trim()}
        onClick={() => onConfirm(story)}
      >
        このストーリーで確定する
      </Button>
    </div>
  );
};

const SlideStep = ({
  session,
  isBusy,
  onSubmit,
}: {
  session: KaigiSession;
  isBusy: boolean;
  onSubmit: (slide: Partial<KaigiSlideContent>) => void;
}) => {
  const [title, setTitle] = useState(session.slide.title);
  const [summary, setSummary] = useState(session.slide.summary);
  const preview = { ...session.slide, title, summary };
  const submitted = session.status === "submitted";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SlideCard
        slide={submitted ? session.slide : preview}
        nickname={session.nickname}
      />
      {submitted ? (
        <div className="space-y-4">
          <p className="text-lg font-bold">
            提出しました。壁に貼り出されています。
          </p>
          <Button asChild className="gap-1">
            <Link to={`/kaigi/${session.roomId}/wall`}>
              <LayoutGrid className="h-4 w-4" />
              壁を見る
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="見出し"
            maxLength={40}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div>
            <label htmlFor="kaigi-summary" className="font-bold">
              要点
            </label>
            <textarea
              id="kaigi-summary"
              rows={4}
              maxLength={200}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={`${textareaClass} mt-2`}
            />
          </div>
          <Button
            disabled={isBusy || !title.trim()}
            onClick={() => onSubmit({ title, summary })}
          >
            壁に貼る（提出する）
          </Button>
        </div>
      )}
    </div>
  );
};

const KaigiRoom = () => {
  const { roomId = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [room, setRoom] = useState<KaigiRoomType | null>(null);
  const [session, setSession] = useState<KaigiSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (authLoading || !user.id) return;
    kaigiApi
      .getMySession(roomId, user.id)
      .then((res) => {
        setRoom(res.room);
        setSession(res.session);
      })
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : "読み込みに失敗しました"
        )
      );
  }, [roomId, user.id, authLoading]);

  // サーバーを呼んで、返ってきたセッションに置き換える。失敗したら false
  const run = useCallback(
    async (action: () => Promise<KaigiSessionResponse>) => {
      setIsBusy(true);
      setActionError(null);
      try {
        const res = await action();
        setSession(res.session);
        setRoom(res.room);
        return true;
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "処理に失敗しました"
        );
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  // 工程3に入ったのに整理がまだなければ、用意してもらう
  const needsOverview = session?.step === 3 && !session.overview;
  const sessionId = session?.id;
  useEffect(() => {
    if (needsOverview && sessionId)
      run(() => kaigiApi.prepareOverview(sessionId, user.id));
  }, [needsOverview, sessionId, user.id, run]);

  const breadcrumbItems = [
    { label: "いどばた会議室", href: "/kaigi" },
    { label: room?.title ?? "お題", href: `/kaigi/${roomId}` },
  ];

  if (loadError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          {loadError}
        </p>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        読み込み中...
      </div>
    );
  }

  const sid = session?.id ?? "";
  const step = session?.step ?? 1;
  const isActive = session?.status === "active";
  const canAdvance = isActive && (session?.missingToLeave.length ?? 0) === 0;

  const advanceButton = ADVANCE_LABELS[step] && isActive && (
    <Button
      disabled={isBusy || !canAdvance || (step === 3 && !session?.overview)}
      onClick={() => run(() => kaigiApi.advance(sid, user.id))}
      className="w-full gap-1"
    >
      {ADVANCE_LABELS[step]}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <BreadcrumbView items={breadcrumbItems} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-snug">{room.title}</h1>
          {room.hostName && (
            <p className="text-sm text-neutral-500">{room.hostName}</p>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link to={`/kaigi/${roomId}/wall`}>
            <LayoutGrid className="h-4 w-4" />
            壁を見る
          </Link>
        </Button>
      </div>
      {room.meeting && (
        <div className="mb-4 max-w-3xl">
          <MeetingLink meeting={room.meeting} />
        </div>
      )}

      {!session && (
        <JoinForm
          room={room}
          defaultNickname={user.displayName ?? ""}
          isBusy={isBusy || authLoading}
          onJoin={(nickname) =>
            run(() => kaigiApi.join(roomId, user.id, nickname))
          }
        />
      )}

      {session && (
        <>
          <div className="mb-4 space-y-2">
            <StepIndicator step={step} />
            <Countdown timing={session.timing} />
          </div>

          {actionError && (
            <p
              className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
              role="alert"
            >
              {actionError}
            </p>
          )}

          {step === 1 && (
            <Card className="max-w-3xl space-y-4">
              <h2 className="text-xl font-bold">お題</h2>
              <p className="text-lg">{room.title}</p>
              {room.background && (
                <p className="whitespace-pre-wrap text-base leading-relaxed text-neutral-700">
                  {room.background}
                </p>
              )}
              <div className="rounded-md bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700">
                これから{room.sessionMinutes}分で、自分の提案を練り上げます。
                最初は進行役のファシリテーターと1対1で、思っていることを書き出します。
                途中から3人のAIメンバーが加わり、課題を絞り、解決策を考えます。
                最後に、対象領域・課題・解決策を一つのストーリーにして、1枚のスライドにまとめます。
              </div>
              <Button
                disabled={isBusy}
                onClick={() => run(() => kaigiApi.start(sid, user.id))}
              >
                {room.sessionMinutes}分を始める
              </Button>
            </Card>
          )}

          {(step === 2 || (step >= 4 && step <= 8)) && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <KaigiChat
                  messages={session.messages}
                  nickname={session.nickname}
                  isSending={isBusy}
                  onSend={(content) =>
                    run(() => kaigiApi.sendMessage(sid, user.id, content))
                  }
                />
              </div>
              <aside className="space-y-4">
                {step === 2 ? (
                  <div className="rounded-md bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700">
                    <p className="font-bold">{STEP_LABELS[2]}</p>
                    <p className="mt-1">
                      まだ課題を決めなくて大丈夫です。思っていること、見たこと、経験したことを、まとまっていなくてもいいので書いてください。
                    </p>
                  </div>
                ) : (
                  <OutputsCard
                    outputs={session.outputs}
                    missing={session.missingToLeave}
                    editable={isActive}
                    isSaving={isBusy}
                    onSave={(outputs: KaigiOutputs) =>
                      run(() => kaigiApi.updateOutputs(sid, user.id, outputs))
                    }
                  />
                )}
                {advanceButton}
              </aside>
            </div>
          )}

          {step === 3 && (
            <Card className="max-w-4xl space-y-6">
              <h2 className="text-xl font-bold">{STEP_LABELS[3]}</h2>
              {session.overview ? (
                <OverviewPanel overview={session.overview} />
              ) : (
                <div className="space-y-3">
                  <p>みんなの声を整理しています…</p>
                  {actionError && !isBusy && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        run(() => kaigiApi.prepareOverview(sid, user.id))
                      }
                    >
                      もう一度試す
                    </Button>
                  )}
                </div>
              )}
              <div className="max-w-sm">{advanceButton}</div>
            </Card>
          )}

          {step === 9 && (
            <Card className="max-w-3xl">
              <StoryStep
                draft={session.story.draft}
                isBusy={isBusy}
                onRevise={(comment) =>
                  run(() => kaigiApi.reviseStory(sid, user.id, comment))
                }
                onConfirm={(story) =>
                  run(() => kaigiApi.confirmStory(sid, user.id, story))
                }
              />
            </Card>
          )}

          {step === 10 && (
            <SlideStep
              session={session}
              isBusy={isBusy}
              onSubmit={(slide) =>
                run(() => kaigiApi.submit(sid, user.id, slide))
              }
            />
          )}
        </>
      )}
    </div>
  );
};

export default KaigiRoom;
