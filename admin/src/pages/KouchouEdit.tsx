import { useEffect, useState } from "react";
import type { FC, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { STATUS_LABELS, VISIBILITY_LABELS } from "../components/kouchou/labels";
import { Button } from "../components/ui/button";
import { FormInput } from "../components/ui/form-input";
import { apiClient } from "../services/api/apiClient";
import type { KouchouReport, KouchouVisibility } from "../services/api/types";

// 利用者向けサイトのURL（設定されていれば「公開ページを見る」リンクを出す）
const FRONTEND_BASE_URL = (
  import.meta.env.VITE_FRONTEND_BASE_URL ?? ""
).replace(/\/$/, "");

const KouchouEdit: FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<KouchouReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [intro, setIntro] = useState("");
  const [visibility, setVisibility] = useState<KouchouVisibility>("public");
  // 一度「保存」を押した後は、入力に合わせてエラー表示を更新する
  const [attempted, setAttempted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      // 個別取得のAPIがないため、一覧から対象の分析を探す
      const result = await apiClient.getKouchouReports();
      result.match(
        (data) => {
          const found = data.find((r) => r.slug === slug) ?? null;
          setReport(found);
          if (found) {
            setQuestion(found.title);
            setIntro(found.description);
            setVisibility(found.visibility);
          }
          setError(null);
        },
        (error) => {
          console.error("Failed to fetch kouchou report:", error);
          setError(`分析の取得に失敗しました。${error.message}`);
        }
      );
      setLoading(false);
    };
    fetchReport();
  }, [slug]);

  const findErrors = () => {
    const next: Record<string, string> = {};
    if (!question.trim()) next.question = "タイトルは必須です";
    if (!intro.trim()) next.intro = "調査概要は必須です";
    return next;
  };
  const errors = attempted ? findErrors() : {};

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!report) return;
    setMessage(null);
    setSaveError(null);

    setAttempted(true);
    if (Object.keys(findErrors()).length > 0) return;

    setIsSaving(true);
    const failures: string[] = [];

    if (
      question.trim() !== report.title ||
      intro.trim() !== report.description
    ) {
      const result = await apiClient.updateKouchouReportConfig(slug, {
        question: question.trim(),
        intro: intro.trim(),
      });
      if (result.isErr())
        failures.push(`タイトル・調査概要：${result.error.message}`);
    }
    if (visibility !== report.visibility) {
      const result = await apiClient.updateKouchouReportVisibility(
        slug,
        visibility
      );
      if (result.isErr()) failures.push(`公開設定：${result.error.message}`);
    }

    setIsSaving(false);
    if (failures.length > 0) {
      setSaveError(`保存に失敗しました。${failures.join(" / ")}`);
      return;
    }
    setReport({
      ...report,
      title: question.trim(),
      description: intro.trim(),
      visibility,
    });
    setMessage(
      "保存しました。公開ページへの反映には少し時間がかかることがあります。"
    );
  };

  const handleDelete = async () => {
    if (
      !confirm("この分析を削除しますか？公開ページからも見られなくなります。")
    ) {
      return;
    }
    const result = await apiClient.deleteKouchouReport(slug);
    result.match(
      () => navigate("/kouchou"),
      (error) => setSaveError(`削除に失敗しました。${error.message}`)
    );
  };

  if (loading) {
    return <div className="text-center py-4">読み込み中...</div>;
  }
  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>
    );
  }
  if (!report) {
    return (
      <div className="text-center py-4">
        分析が見つかりません。
        <Link to="/kouchou" className="text-primary underline ml-2">
          一覧へ戻る
        </Link>
      </div>
    );
  }

  const canEditContent = report.status === "ready";

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">分析の編集</h1>
      <div className="text-sm text-muted-foreground mb-6 space-x-4">
        <span>ID：{report.slug}</span>
        <span>状態：{STATUS_LABELS[report.status]}</span>
        {report.model && <span>モデル：{report.model}</span>}
        {report.estimatedCost != null && (
          <span>費用（推定）：${report.estimatedCost.toFixed(2)}</span>
        )}
      </div>

      {!canEditContent && (
        <div className="mb-6 rounded-md border border-warning/50 bg-warning/10 p-4 text-sm">
          {report.status === "processing"
            ? "分析中のため、タイトル・調査概要は完了後に編集できます。"
            : "分析がエラーで終了しているため、タイトル・調査概要は編集できません。新規分析で作り直してください。"}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormInput
          label="タイトル（問い）"
          name="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          error={errors.question}
          disabled={!canEditContent}
          required
        />
        <div className="mb-4">
          <label
            htmlFor="intro"
            className="block text-foreground font-medium mb-2"
          >
            調査概要
            <span className="text-destructive ml-1">*</span>
          </label>
          <textarea
            id="intro"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={4}
            disabled={!canEditContent}
            className={`w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${errors.intro ? "border-destructive" : ""}`}
          />
          {errors.intro && (
            <p className="text-destructive text-sm mt-1">{errors.intro}</p>
          )}
        </div>

        <fieldset className="mb-6">
          <legend className="text-foreground font-medium mb-2">公開設定</legend>
          <div className="space-y-1">
            {(Object.keys(VISIBILITY_LABELS) as KouchouVisibility[]).map(
              (v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="visibility"
                    value={v}
                    checked={visibility === v}
                    onChange={() => setVisibility(v)}
                  />
                  {VISIBILITY_LABELS[v]}
                </label>
              )
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            「公開」にすると、利用者向けサイトの「広聴AI」一覧に表示されます。
          </p>
        </fieldset>

        {message && (
          <div className="border border-success bg-success/10 text-foreground p-4 rounded mb-4">
            {message}
          </div>
        )}
        {saveError && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            {saveError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
          <Link to="/kouchou">
            <Button type="button" variant="secondary">
              一覧へ戻る
            </Button>
          </Link>
          {FRONTEND_BASE_URL &&
            report.status === "ready" &&
            visibility !== "private" && (
              <a
                href={`${FRONTEND_BASE_URL}/kouchou/${encodeURIComponent(report.slug)}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline text-sm"
              >
                公開ページを見る
              </a>
            )}
          <Button
            type="button"
            variant="destructive"
            className="ml-auto"
            onClick={handleDelete}
            disabled={report.status === "processing"}
          >
            削除
          </Button>
        </div>
      </form>
    </div>
  );
};

export default KouchouEdit;
