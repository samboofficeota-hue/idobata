import { ChevronDown, ChevronUp, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import BreadcrumbView from "../components/common/BreadcrumbView";
import SectionHeading from "../components/common/SectionHeading";
import KouchouCreateProgress from "../components/kouchou/KouchouCreateProgress";
import KouchouPasswordDialog from "../components/kouchou/KouchouPasswordDialog";
import {
  extractionPrompt,
  initialLabellingPrompt,
  mergeLabellingPrompt,
  overviewPrompt,
} from "../components/kouchou/defaultPrompts";
import {
  type ParsedCsv,
  buildComments,
  guessCommentColumn,
  parseCsv,
  recommendedClusters,
} from "../components/kouchou/parseCsv";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import {
  KouchouPasswordError,
  kouchouCreateApi,
  storedPassword,
} from "../services/kouchou/createApiClient";
import type { KouchouPrompt } from "../services/kouchou/types";

const MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o mini（低コスト・標準）" },
  { value: "gpt-4o", label: "GPT-4o（高精度・高コスト）" },
  { value: "o3-mini", label: "o3-mini" },
];

const PROMPT_FIELDS: { key: keyof KouchouPrompt; label: string }[] = [
  { key: "extraction", label: "意見の抽出" },
  { key: "initial_labelling", label: "グループ名の作成" },
  { key: "merge_labelling", label: "グループ名の統合" },
  { key: "overview", label: "全体のまとめ" },
];

// kouchou-ai のIDの規則：英小文字・数字・ハイフン
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const defaultId = () => {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `analysis-${ymd}-${Math.random().toString(36).slice(2, 6)}`;
};

const textareaClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const KouchouCreate = () => {
  const navigate = useNavigate();
  const breadcrumbItems = [
    { label: "広聴AI", href: "/kouchou" },
    { label: "新規分析", href: "/kouchou/new" },
  ];

  // パスワード（一覧の「新規分析」で確認済みなら sessionStorage に入っている）
  const [password, setPassword] = useState<string | null>(storedPassword.get);
  const [startedSlug, setStartedSlug] = useState<string | null>(null);
  // 入力途中でパスワード入力を閉じた場合は、ページに留まる
  const [dialogDismissed, setDialogDismissed] = useState(false);

  // アップロード
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [commentColumn, setCommentColumn] = useState("");
  const [attributeColumns, setAttributeColumns] = useState<string[]>([]);

  // 必要情報
  const [question, setQuestion] = useState("");
  const [intro, setIntro] = useState("");
  const [slug, setSlug] = useState(defaultId);

  // AI詳細設定
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clusterLv1, setClusterLv1] = useState(5);
  const [clusterLv2, setClusterLv2] = useState(25);
  const [model, setModel] = useState(MODELS[0].value);
  const [workers, setWorkers] = useState(30);
  const [isPubcom, setIsPubcom] = useState(true);
  const [prompt, setPrompt] = useState<KouchouPrompt>({
    extraction: extractionPrompt,
    initial_labelling: initialLabellingPrompt,
    merge_labelling: mergeLabellingPrompt,
    overview: overviewPrompt,
  });

  // 一度「分析を開始」を押した後は、入力に合わせてエラー表示を更新する
  const [attempted, setAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const comments = buildComments(csv, commentColumn, attributeColumns);

  const findErrors = () => {
    const next: Record<string, string> = {};
    if (!csv) next.csv = "CSVファイルを選択してください";
    else if (comments.length === 0) {
      next.csv = "選択した列にコメントがありません";
    }
    if (!question.trim()) next.question = "タイトルは必須です";
    if (!intro.trim()) next.intro = "調査概要は必須です";
    if (!ID_PATTERN.test(slug) || slug.length > 255) {
      next.slug =
        "英小文字・数字・ハイフンで入力してください（先頭と末尾は英数字）";
    }
    if (clusterLv2 < clusterLv1 * 2) {
      next.cluster =
        "小さなグループの数は、大きなグループの数の2倍以上にしてください";
    }
    if (Object.values(prompt).some((p) => !p.trim())) {
      next.prompt = "プロンプトは空にできません";
    }
    return next;
  };
  const errors = attempted ? findErrors() : {};

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCsv(null);
    setCsvError(null);
    setAttributeColumns([]);
    setFileName(file?.name ?? null);
    if (!file) return;

    try {
      const parsed = await parseCsv(file);
      if (parsed.columns.length === 0 || parsed.rows.length === 0) {
        setCsvError("CSVにデータがありません。1行目に列名が必要です。");
        return;
      }
      setCsv(parsed);
      setCommentColumn(guessCommentColumn(parsed));
      const [lv1, lv2] = recommendedClusters(parsed.rows.length);
      setClusterLv1(lv1);
      setClusterLv2(lv2);
    } catch (error) {
      console.error("Failed to parse CSV:", error);
      setCsvError(
        "CSVファイルを読み込めませんでした。形式を確認してください。"
      );
    }
  };

  const toggleAttribute = (column: string) => {
    setAttributeColumns((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : [...current, column]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setDialogDismissed(false);
      return;
    }
    setSubmitError(null);
    setAttempted(true);
    if (Object.keys(findErrors()).length > 0) return;

    if (
      comments.length < clusterLv2 &&
      !confirm(
        `コメント数（${comments.length}件）が小さなグループの数（${clusterLv2}）より少ないため、分析が失敗する可能性があります。このまま開始しますか？`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await kouchouCreateApi.createReport(password, {
        input: slug,
        question: question.trim(),
        intro: intro.trim(),
        cluster: [clusterLv1, clusterLv2],
        model,
        workers,
        prompt,
        comments,
        is_pubcom: isPubcom,
      });
      setStartedSlug(slug);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof KouchouPasswordError) {
        // パスワードが変更された場合など。入力内容は残したまま再入力してもらう
        storedPassword.clear();
        setPassword(null);
        setSubmitError(
          "パスワードを確認できませんでした。もう一度入力してから「分析を開始」を押してください。"
        );
      } else {
        setSubmitError(
          `分析を開始できませんでした。${err instanceof Error ? err.message : ""}`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl">
        <BreadcrumbView items={breadcrumbItems} />
        <SectionHeading title="新規分析" />

        <KouchouPasswordDialog
          open={!password && !dialogDismissed}
          onOpenChange={(open) => {
            if (open) return;
            // 何も入力していなければ一覧へ戻り、入力途中ならページに留まる
            const touched = csv !== null || question !== "" || intro !== "";
            if (touched) setDialogDismissed(true);
            else navigate("/kouchou");
          }}
          onVerified={(verified) => {
            setPassword(verified);
            setDialogDismissed(false);
          }}
        />

        {startedSlug && password ? (
          <KouchouCreateProgress slug={startedSlug} password={password} />
        ) : (
          <>
            <p className="text-base text-neutral-600 mb-8">
              集めた意見のCSVファイルをアップロードし、必要な情報を記入して分析を始めます。AIが似た意見ごとのグループに整理し、全体のまとめを作成します。
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* 1. アップロード */}
              <Card>
                <h3 className="text-xl-bold mb-4">
                  1. 意見データのアップロード
                </h3>
                <label
                  htmlFor="csv"
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary-300 bg-primary-weak/30 px-4 py-8 text-center cursor-pointer hover:bg-primary-weak/60"
                >
                  <FileSpreadsheet className="h-10 w-10 text-primary-700" />
                  <span className="text-md-bold">
                    {fileName ?? "CSVファイルを選択"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    1行目に列名を入れてください。UTF-8・Shift_JISのどちらでも読み込めます。
                  </span>
                  <input
                    id="csv"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
                {(csvError || errors.csv) && (
                  <p className="text-sm text-destructive mt-2">
                    {csvError || errors.csv}
                  </p>
                )}

                {csv && (
                  <div className="mt-6 space-y-6">
                    <p className="text-base">
                      {csv.rows.length.toLocaleString()}
                      行を読み込みました（分析するコメント：
                      {comments.length.toLocaleString()}件）
                    </p>
                    <Select
                      id="commentColumn"
                      label="コメントが入っている列"
                      requiredMark
                      value={commentColumn}
                      onChange={(e) => {
                        setCommentColumn(e.target.value);
                        setAttributeColumns((cols) =>
                          cols.filter((c) => c !== e.target.value)
                        );
                      }}
                      options={csv.columns.map((c) => ({ value: c, label: c }))}
                    />
                    <fieldset>
                      <legend className="font-bold text-base mb-1">
                        属性として残す列（任意）
                      </legend>
                      <p className="text-sm text-muted-foreground mb-2">
                        年代・地域など、あとで見比べたい列を選びます。
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {csv.columns
                          .filter((c) => c !== commentColumn)
                          .map((c) => (
                            <Checkbox
                              key={c}
                              label={c}
                              checked={attributeColumns.includes(c)}
                              onChange={() => toggleAttribute(c)}
                            />
                          ))}
                      </div>
                    </fieldset>
                    <div>
                      <p className="font-bold text-base mb-2">
                        プレビュー（先頭3件）
                      </p>
                      <ul className="space-y-2">
                        {comments.slice(0, 3).map((c) => (
                          <li
                            key={c.id}
                            className="border-l-4 border-primary-200 pl-3 text-sm line-clamp-2"
                          >
                            {c.comment}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </Card>

              {/* 2. 必要情報 */}
              <Card className="space-y-4">
                <h3 className="text-xl-bold">2. 必要情報の記入</h3>
                <Input
                  id="question"
                  label="タイトル（問い）"
                  requiredMark
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="例：〇〇市の子育て支援について、どのような声が寄せられたか"
                  error={!!errors.question}
                  errorText={errors.question}
                />
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="intro"
                    className="flex items-center gap-1 font-bold text-base"
                  >
                    調査概要
                    <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="intro"
                    value={intro}
                    onChange={(e) => setIntro(e.target.value)}
                    rows={4}
                    placeholder="例：2026年9月に実施したアンケート（回答数1,200件）の自由記述を分析しました。"
                    className={`${textareaClass} ${errors.intro ? "border-destructive" : ""}`}
                  />
                  {errors.intro && (
                    <span className="text-xs text-destructive">
                      {errors.intro}
                    </span>
                  )}
                </div>
                <Input
                  id="slug"
                  label="分析ID（URLに使われます）"
                  requiredMark
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  helperText="英小文字・数字・ハイフンが使えます。そのままでも構いません。"
                  error={!!errors.slug}
                  errorText={errors.slug}
                />
              </Card>

              {/* 3. AI詳細設定 */}
              <Card>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex w-full items-center justify-between text-left"
                  aria-expanded={showAdvanced}
                >
                  <h3 className="text-xl-bold">3. AI詳細設定（任意）</h3>
                  {showAdvanced ? (
                    <ChevronUp className="h-6 w-6 text-primary-700" />
                  ) : (
                    <ChevronDown className="h-6 w-6 text-primary-700" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        id="clusterLv1"
                        type="number"
                        min={2}
                        max={40}
                        label="大きなグループの数"
                        value={clusterLv1}
                        onChange={(e) => setClusterLv1(Number(e.target.value))}
                      />
                      <Input
                        id="clusterLv2"
                        type="number"
                        min={4}
                        max={1000}
                        label="小さなグループの数"
                        value={clusterLv2}
                        onChange={(e) => setClusterLv2(Number(e.target.value))}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      CSVを読み込むと、コメント数に合わせた推奨値が自動で入ります。
                    </p>
                    {errors.cluster && (
                      <p className="text-sm text-destructive">
                        {errors.cluster}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Select
                        id="model"
                        label="AIモデル"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        options={MODELS}
                      />
                      <Input
                        id="workers"
                        type="number"
                        min={1}
                        max={100}
                        label="同時に処理する数"
                        value={workers}
                        onChange={(e) => setWorkers(Number(e.target.value))}
                      />
                    </div>
                    <Checkbox
                      label="元のコメントと分析結果を対応づけたCSVを出力する（パブコムモード）"
                      checked={isPubcom}
                      onChange={(e) => setIsPubcom(e.target.checked)}
                    />
                    {PROMPT_FIELDS.map(({ key, label }) => (
                      <div key={key} className="flex flex-col gap-1">
                        <label
                          htmlFor={`prompt-${key}`}
                          className="font-bold text-base"
                        >
                          プロンプト：{label}
                        </label>
                        <textarea
                          id={`prompt-${key}`}
                          value={prompt[key]}
                          onChange={(e) =>
                            setPrompt((p) => ({ ...p, [key]: e.target.value }))
                          }
                          rows={6}
                          className={`${textareaClass} font-mono text-xs`}
                        />
                      </div>
                    ))}
                    {errors.prompt && (
                      <p className="text-sm text-destructive">
                        {errors.prompt}
                      </p>
                    )}
                  </div>
                )}
              </Card>

              <p className="rounded-lg bg-secondary-weak p-4 text-sm">
                分析にはOpenAIのAPI利用料がかかります。費用はコメント数とAIモデルによって変わります。分析には数分〜数十分かかります。
              </p>

              {submitError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <p>{submitError}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? "送信中..." : "分析を開始"}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/kouchou")}
                >
                  キャンセル
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default KouchouCreate;
