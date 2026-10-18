import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import BreadcrumbView from "../components/common/BreadcrumbView";
import SectionHeading from "../components/common/SectionHeading";
import KaigiPasswordDialog from "../components/kaigi/KaigiPasswordDialog";
import { CAPACITY_OPTIONS } from "../components/kaigi/labels";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  KaigiPasswordError,
  kaigiApi,
  storedHostKeys,
  storedHostPassword,
} from "../services/kaigi/kaigiApi";

const textareaClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CopyField = ({ label, url }: { label: string; url: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // コピーできない環境では、表示されたURLを手で選んでもらう
    }
  };
  return (
    <div>
      <p className="text-sm font-bold">{label}</p>
      <div className="mt-1 flex gap-2">
        <input
          readOnly
          value={url}
          className={textareaClass}
          onFocus={(e) => e.target.select()}
        />
        <Button
          type="button"
          variant="outline"
          onClick={copy}
          className="gap-1 shrink-0"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "コピーしました" : "コピー"}
        </Button>
      </div>
    </div>
  );
};

const KaigiCreate = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState<string | null>(
    storedHostPassword.get
  );
  const [dialogDismissed, setDialogDismissed] = useState(false);

  const [title, setTitle] = useState("");
  const [background, setBackground] = useState("");
  const [hostName, setHostName] = useState("");
  const [capacity, setCapacity] = useState(CAPACITY_OPTIONS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    hostKey: string;
  } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    if (!title.trim()) {
      setError("お題を入力してください");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const { id, hostKey } = await kaigiApi.createRoom(password, {
        title,
        background,
        hostName,
        capacity,
      });
      storedHostKeys.set(id, hostKey);
      setCreated({ id, hostKey });
    } catch (err) {
      if (err instanceof KaigiPasswordError) {
        storedHostPassword.clear();
        setPassword(null);
        setDialogDismissed(false);
      }
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const breadcrumbItems = [
    { label: "いどばた会議室", href: "/kaigi" },
    { label: "お題をつくる", href: "/kaigi/new" },
  ];

  if (created) {
    const createdId = created.id;
    const origin = window.location.origin;
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl space-y-6">
          <BreadcrumbView items={breadcrumbItems} />
          <SectionHeading title="お題をつくりました" />
          <p className="text-base">
            参加者にURLを共有してください。参加者は、それぞれ自分のタイミングで20分の打ち込みを行います。
          </p>
          <CopyField
            label="参加者に共有するURL"
            url={`${origin}/kaigi/${createdId}`}
          />
          <CopyField
            label="壁（みんなの提案）のURL"
            url={`${origin}/kaigi/${createdId}/wall`}
          />
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
            <CopyField
              label="ホスト用のURL（参加者には共有しないでください）"
              url={`${origin}/kaigi/${createdId}/host#key=${created.hostKey}`}
            />
            <p className="mt-2 text-sm text-neutral-700">
              Google カレンダーへの予定づくりや、Meet
              の文字起こしの取り込みはホスト用の画面で行います。
              このURLは今しか表示されません。ほかの端末から開くときのために控えておいてください。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to={`/kaigi/${createdId}`}>自分も参加する</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/kaigi/${createdId}/wall`}>壁を見る</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/kaigi/${createdId}/host`}>ホスト用の画面へ</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl">
        <BreadcrumbView items={breadcrumbItems} />
        <SectionHeading title="お題をつくる" />
        <KaigiPasswordDialog
          open={!password && !dialogDismissed}
          onOpenChange={(open) => {
            if (!open) {
              setDialogDismissed(true);
              navigate("/kaigi");
            }
          }}
          onVerified={(verified) => setPassword(verified)}
        />

        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          <Input
            label="お題"
            requiredMark
            value={title}
            maxLength={200}
            placeholder="例：マンションの共用自転車をどうするか"
            onChange={(e) => setTitle(e.target.value)}
          />
          <div>
            <label htmlFor="kaigi-background" className="text-base font-bold">
              背景の説明
            </label>
            <p className="mt-1 text-sm text-neutral-600">
              参加者が最初に読む説明です。これまでの経緯や、決めたいことを書いてください。AIはこれをもとに参加者と話します。
            </p>
            <textarea
              id="kaigi-background"
              rows={6}
              maxLength={4000}
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className={`${textareaClass} mt-2`}
            />
          </div>
          <Input
            label="ホストの名前（任意）"
            value={hostName}
            maxLength={50}
            placeholder="例：〇〇マンション管理組合 理事会"
            onChange={(e) => setHostName(e.target.value)}
          />
          <fieldset>
            <legend className="text-base font-bold">参加人数</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {CAPACITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col rounded-md border-2 p-3 ${
                    capacity === option.value
                      ? "border-primary-700 bg-primary-50"
                      : "border-input"
                  }`}
                >
                  <input
                    type="radio"
                    name="capacity"
                    className="sr-only"
                    checked={capacity === option.value}
                    onChange={() => setCapacity(option.value)}
                  />
                  <span className="font-bold">{option.label}</span>
                  <span className="text-sm text-neutral-600">
                    {option.price}（課金は準備中）
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting || !password}>
            {isSubmitting ? "作成中..." : "お題をつくる"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default KaigiCreate;
