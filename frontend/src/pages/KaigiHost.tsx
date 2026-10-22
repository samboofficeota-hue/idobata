import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import BreadcrumbView from "../components/common/BreadcrumbView";
import SectionHeading from "../components/common/SectionHeading";
import MeetingLink, {
  formatMeetingTime,
} from "../components/kaigi/MeetingLink";
import ThemeAxesCard from "../components/kaigi/ThemeAxesCard";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  KaigiHostKeyError,
  kaigiApi,
  storedHostKeys,
} from "../services/kaigi/kaigiApi";
import type { KaigiHostView, KaigiMeetRecord } from "../services/kaigi/types";

const fieldClass =
  "rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const GOOGLE_RESULTS: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Google アカウントを連携しました。" },
  cancelled: { ok: false, text: "Google との連携を取りやめました。" },
  failed: {
    ok: false,
    text: "Google との連携に失敗しました。もう一度やり直してください。",
  },
};

const DURATIONS = [30, 60, 90, 120];

// <input type="datetime-local"> の値（端末の時刻）
const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultStart = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
};

const formatTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const transcriptText = (record: KaigiMeetRecord) =>
  record.transcripts
    .flatMap((t) => t.entries)
    .map((e) => `${e.speaker || "（名前なし）"}：${e.text}`)
    .join("\n");

const downloadText = (filename: string, body: string) => {
  const url = URL.createObjectURL(
    new Blob([body], { type: "text/plain;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const RecordCard = ({
  record,
  title,
}: { record: KaigiMeetRecord; title: string }) => {
  const entries = record.transcripts.flatMap((t) => t.entries);
  const pending = record.transcripts.some((t) => t.state === "STARTED");
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">
          {formatTime(record.startTime)}
          {record.endTime ? `〜${formatTime(record.endTime)}` : "（開催中）"}
        </h3>
        {entries.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() =>
              downloadText(`${title}_文字起こし.txt`, transcriptText(record))
            }
          >
            <Download className="h-4 w-4" />
            文字起こしを保存
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {record.transcripts
          .filter((t) => t.docsUrl)
          .map((t) => (
            <a
              key={t.docsUrl}
              href={t.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary-700 underline"
            >
              文字起こし（Google ドキュメント）
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        {record.recordings
          .filter((r) => r.url)
          .map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary-700 underline"
            >
              録画（Google ドライブ）
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
      </div>
      {entries.length > 0 ? (
        <ol className="max-h-80 space-y-1 overflow-y-auto rounded-md bg-neutral-50 p-3 text-sm">
          {entries.map((e, i) => (
            // 発言には ID がないので、順番で区別する
            // biome-ignore lint/suspicious/noArrayIndexKey: 発言の順番は変わらない
            <li key={i}>
              <span className="font-bold">{e.speaker || "（名前なし）"}</span>：
              {e.text}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-neutral-600">
          {pending
            ? "文字起こしは会議の終了後に取り込めます。"
            : "この会議には文字起こしがありません。"}
        </p>
      )}
    </Card>
  );
};

// いどばた会議室のホスト用の画面：Google 連携、Meet の予定、文字起こしと録画
const KaigiHost = () => {
  const { roomId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hostKey, setHostKey] = useState<string | null>(() =>
    storedHostKeys.get(roomId)
  );
  const [view, setView] = useState<KaigiHostView | null>(null);
  const [records, setRecords] = useState<KaigiMeetRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [startAt, setStartAt] = useState(defaultStart);
  const [duration, setDuration] = useState(60);
  const googleResult = GOOGLE_RESULTS[searchParams.get("google") ?? ""];

  // ほかの端末で開いたときは、URLの # の後ろにある鍵を受け取り、URLからは消す
  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get(
      "key"
    );
    if (fromHash) {
      storedHostKeys.set(roomId, fromHash);
      setHostKey(fromHash);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }, [roomId]);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof KaigiHostKeyError) {
        storedHostKeys.remove(roomId);
        setHostKey(null);
        setKeyError(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : "処理に失敗しました");
    },
    [roomId]
  );

  useEffect(() => {
    if (!hostKey) return;
    Promise.all([
      kaigiApi.getHost(roomId, hostKey),
      kaigiApi.getRecords(roomId, hostKey),
    ])
      .then(([host, rec]) => {
        setView(host);
        setRecords(rec.records);
        if (host.meeting?.startAt) {
          setStartAt(toLocalInput(new Date(host.meeting.startAt)));
        }
      })
      .catch(handleError);
  }, [roomId, hostKey, handleError]);

  const run = async (action: () => Promise<KaigiHostView>) => {
    setIsBusy(true);
    setError(null);
    try {
      setView(await action());
    } catch (err) {
      handleError(err);
    } finally {
      setIsBusy(false);
    }
  };

  if (!hostKey) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl space-y-4">
          <SectionHeading title="ホスト用の画面" />
          {keyError && (
            <p className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
              {keyError}
            </p>
          )}
          <p>
            この画面は、お題をつくったときに表示された「ホスト用のURL」から開いてください。
          </p>
          <Button asChild variant="outline">
            <Link to={`/kaigi/${roomId}`}>お題のページへ</Link>
          </Button>
        </div>
      </div>
    );
  }

  const connectGoogle = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const { url } = await kaigiApi.connectGoogle(roomId, hostKey);
      window.location.assign(url);
    } catch (err) {
      handleError(err);
      setIsBusy(false);
    }
  };

  const syncRecords = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const res = await kaigiApi.syncRecords(roomId, hostKey);
      setRecords(res.records);
      setView(await kaigiApi.getHost(roomId, hostKey));
    } catch (err) {
      handleError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSchedule = (e: FormEvent) => {
    e.preventDefault();
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) {
      setError("開始日時を入力してください");
      return;
    }
    run(() =>
      kaigiApi.scheduleMeeting(roomId, hostKey, start.toISOString(), duration)
    );
  };

  const google = view?.google;
  const meeting = view?.meeting;
  const title = view?.room.title ?? "お題";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl space-y-6">
        <BreadcrumbView
          items={[
            { label: "いどばた会議室", href: "/kaigi" },
            { label: title, href: `/kaigi/${roomId}` },
            { label: "ホスト用の画面", href: `/kaigi/${roomId}/host` },
          ]}
        />
        <SectionHeading title="ホスト用の画面" className="mb-0" />
        {view && <p className="text-lg">{view.room.title}</p>}

        {googleResult && (
          <p
            className={
              googleResult.ok
                ? "rounded border border-green-400 bg-green-50 px-4 py-3 text-green-800"
                : "rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
            }
          >
            {googleResult.text}
            <button
              type="button"
              className="ml-3 text-sm underline"
              onClick={() => setSearchParams({})}
            >
              閉じる
            </button>
          </p>
        )}
        {error && (
          <p
            className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {view && (
          <ThemeAxesCard
            theme={view.theme}
            isBusy={isBusy}
            onRemove={() => run(() => kaigiApi.removeTheme(roomId, hostKey))}
            onRelink={() => run(() => kaigiApi.relinkTheme(roomId, hostKey))}
          />
        )}

        {view && !google?.available && (
          <Card>
            <p>Google 連携は準備中です（サーバーの設定がまだありません）。</p>
          </Card>
        )}

        {view && google?.available && (
          <Card className="space-y-3">
            <h2 className="text-xl font-bold">Google アカウント</h2>
            {google.connected ? (
              <>
                <p>
                  <span className="font-bold">{google.email}</span>{" "}
                  と連携しています。このアカウントのカレンダーに予定を作り、Meet
                  の文字起こしを取り込みます。
                </p>
                {(!google.canCreateMeeting || !google.canReadRecords) && (
                  <p className="text-sm text-red-700">
                    許可されていない機能があります（
                    {[
                      !google.canCreateMeeting && "カレンダーの予定",
                      !google.canReadRecords && "Meet の記録",
                    ]
                      .filter(Boolean)
                      .join("・")}
                    ）。使うには連携し直して、すべてにチェックを入れてください。
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={connectGoogle}
                  >
                    連携し直す
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Google との連携を解除しますか？作った予定は残ります。"
                        )
                      ) {
                        run(() => kaigiApi.disconnectGoogle(roomId, hostKey));
                      }
                    }}
                  >
                    連携を解除する
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-700">
                  ホストの Google アカウントを連携すると、話し合いの予定を
                  Google カレンダーに作り、Google Meet
                  のURLを参加者に案内できます。 会議のあとで、Meet
                  の文字起こしと録画をここに取り込めます。
                </p>
                <Button disabled={isBusy} onClick={connectGoogle}>
                  Google アカウントを連携する
                </Button>
              </>
            )}
          </Card>
        )}

        {google?.connected && (
          <Card className="space-y-4">
            <h2 className="text-xl font-bold">話し合いの予定（Google Meet）</h2>
            {meeting && (
              <>
                <MeetingLink meeting={meeting} />
                <p className="text-sm text-neutral-600">
                  参加者のページと壁にも、このURLが表示されます。
                  {meeting.calendarHtmlLink && (
                    <>
                      {" "}
                      <a
                        href={meeting.calendarHtmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-700 underline"
                      >
                        Google カレンダーで開く
                      </a>
                      （参加者を招待するときはカレンダーから）
                    </>
                  )}
                </p>
              </>
            )}
            <form
              onSubmit={handleSchedule}
              className="flex flex-wrap items-end gap-3"
            >
              <label className="flex flex-col text-sm font-bold">
                開始日時
                <input
                  type="datetime-local"
                  required
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className={`${fieldClass} mt-1 font-normal`}
                />
              </label>
              <label className="flex flex-col text-sm font-bold">
                長さ
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className={`${fieldClass} mt-1 font-normal`}
                >
                  {DURATIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}分
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="submit"
                disabled={isBusy || !google.canCreateMeeting}
              >
                {meeting ? "日時を変える" : "予定と Meet をつくる"}
              </Button>
              {meeting && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `${formatMeetingTime(meeting)} の予定を Google カレンダーから削除しますか？`
                      )
                    ) {
                      run(() => kaigiApi.cancelMeeting(roomId, hostKey));
                    }
                  }}
                >
                  予定を削除する
                </Button>
              )}
            </form>
          </Card>
        )}

        {(meeting || records.length > 0) && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">文字起こしと録画</h2>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={
                  isBusy ||
                  !meeting ||
                  !google?.connected ||
                  !google.canReadRecords
                }
                onClick={syncRecords}
              >
                <RefreshCw className="h-4 w-4" />
                Meet から取り込む
              </Button>
            </div>
            <p className="text-sm text-neutral-600">
              会議中に Meet
              で「文字起こし」「録画」を始めると、会議のあとで取り込めます
              （Google Workspace
              の対応プランが必要です。終了から数分〜数十分かかります）。
              {meeting?.recordsSyncedAt &&
                ` 最後に取り込んだ日時：${formatTime(meeting.recordsSyncedAt)}`}
            </p>
            {records.length === 0 ? (
              <p className="text-sm">まだ取り込んだ記録はありません。</p>
            ) : (
              records.map((record) => (
                <RecordCard key={record.id} record={record} title={title} />
              ))
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default KaigiHost;
