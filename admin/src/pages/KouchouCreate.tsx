import { useState } from "react";
import type { ChangeEvent, FC, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  extractionPrompt,
  initialLabellingPrompt,
  mergeLabellingPrompt,
  overviewPrompt,
} from "../components/kouchou/defaultPrompts";
import {
  type ParsedCsv,
  guessCommentColumn,
  parseCsv,
  recommendedClusters,
} from "../components/kouchou/parseCsv";
import { Button } from "../components/ui/button";
import { FormInput } from "../components/ui/form-input";
import { apiClient } from "../services/api/apiClient";
import type { KouchouComment, KouchouPrompt } from "../services/api/types";

const MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o mini（低コスト・標準）" },
  { value: "gpt-4o", label: "GPT-4o（高精度・高コスト）" },
  { value: "o3-mini", label: "o3-mini" },
];

const PROMPT_FIELDS: { key: keyof KouchouPrompt; label: string }[] = [
  { key: "extraction", label: "意見の抽出" },
  { key: "initial_labelling", label: "グループのラベル付け" },
  { key: "merge_labelling", label: "ラベルの統合" },
  { key: "overview", label: "全体のまとめ" },
];

// kouchou-ai のIDの規則：英小文字・数字・ハイフン
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const defaultId = () => {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `analysis-${ymd}-${Math.random().toString(36).slice(2, 6)}`;
};

// CSVの行を kouchou-ai に送るコメントに変換する
// id列が空・重複している行には行番号のIDを振り、IDが一意になるようにする
const buildComments = (
  csv: ParsedCsv | null,
  commentColumn: string,
  attributeColumns: string[]
): KouchouComment[] => {
  if (!csv) return [];
  const seen = new Set<string>();
  const comments: KouchouComment[] = [];
  csv.rows.forEach((row, index) => {
    const text = (row[commentColumn] ?? "").trim();
    if (text === "") return;
    let id = row.id || row["comment-id"] || `csv-${index + 1}`;
    if (seen.has(id)) id = `csv-${index + 1}`;
    seen.add(id);
    const comment: KouchouComment = {
      id,
      comment: text,
      source: row.source || null,
      url: row.url || null,
    };
    for (const column of attributeColumns) {
      comment[`attribute_${column}`] = row[column] ?? "";
    }
    comments.push(comment);
  });
  return comments;
};

const textareaClass =
  "w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring";

const KouchouCreate: FC = () => {
  const navigate = useNavigate();

  // 必要情報
  const [slug, setSlug] = useState(defaultId);
  const [question, setQuestion] = useState("");
  const [intro, setIntro] = useState("");

  // アップロード
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [commentColumn, setCommentColumn] = useState("");
  const [attributeColumns, setAttributeColumns] = useState<string[]>([]);

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

  const comments: KouchouComment[] = buildComments(
    csv,
    commentColumn,
    attributeColumns
  );

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

  const findErrors = () => {
    const next: Record<string, string> = {};
    if (!ID_PATTERN.test(slug) || slug.length > 255) {
      next.slug =
        "英小文字・数字・ハイフンで入力してください（先頭と末尾は英数字）";
    }
    if (!question.trim()) next.question = "タイトルは必須です";
    if (!intro.trim()) next.intro = "調査概要は必須です";
    if (!csv) next.csv = "CSVファイルを選択してください";
    else if (comments.length === 0) {
      next.csv = "選択した列にコメントがありません";
    }
    if (clusterLv2 < clusterLv1 * 2) {
      next.cluster =
        "小さなグループ数は、大きなグループ数の2倍以上にしてください";
    }
    if (Object.values(prompt).some((p) => !p.trim())) {
      next.prompt = "プロンプトは空にできません";
    }
    return next;
  };
  const errors = attempted ? findErrors() : {};

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setAttempted(true);
    if (Object.keys(findErrors()).length > 0) return;

    if (
      comments.length < clusterLv2 &&
      !confirm(
        `コメント数（${comments.length}件）が小さなグループ数（${clusterLv2}）より少ないため、分析が失敗する可能性があります。このまま開始しますか？`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    const result = await apiClient.createKouchouReport({
      input: slug,
      question: question.trim(),
      intro: intro.trim(),
      cluster: [clusterLv1, clusterLv2],
      provider: "openai",
      model,
      workers,
      prompt,
      comments,
      is_pubcom: isPubcom,
      inputType: "file",
      is_embedded_at_local: false,
    });
    setIsSubmitting(false);

    result.match(
      () => navigate("/kouchou"),
      (error) => {
        console.error("Failed to create kouchou report:", error);
        setSubmitError(`分析を開始できませんでした。${error.message}`);
      }
    );
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">新規分析</h1>

      <form onSubmit={handleSubmit} noValidate>
        {/* 1. アップロード */}
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">
            1. 意見データのアップロード
          </h2>
          <div className="mb-4">
            <label
              htmlFor="csv"
              className="block text-foreground font-medium mb-2"
            >
              CSVファイル
              <span className="text-destructive ml-1">*</span>
            </label>
            <input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground hover:file:bg-primary/90"
            />
            <p className="text-sm text-muted-foreground mt-1">
              1行目に列名を入れてください。UTF-8・Shift_JISのどちらでも読み込めます。
            </p>
            {(csvError || errors.csv) && (
              <p className="text-destructive text-sm mt-1">
                {csvError || errors.csv}
              </p>
            )}
          </div>

          {csv && (
            <div className="rounded-md border border-border p-4 space-y-4">
              <p className="text-sm">
                <span className="font-medium">{fileName}</span>：
                {csv.rows.length.toLocaleString()}行 / 分析対象のコメント
                {comments.length.toLocaleString()}件
              </p>

              <div>
                <label
                  htmlFor="commentColumn"
                  className="block text-foreground font-medium mb-2"
                >
                  コメントが入っている列
                  <span className="text-destructive ml-1">*</span>
                </label>
                <select
                  id="commentColumn"
                  value={commentColumn}
                  onChange={(e) => {
                    setCommentColumn(e.target.value);
                    setAttributeColumns((cols) =>
                      cols.filter((c) => c !== e.target.value)
                    );
                  }}
                  className="w-full px-3 py-2 border border-input rounded bg-background"
                >
                  {csv.columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="text-foreground font-medium mb-2">
                  属性として残す列（任意）
                </legend>
                <p className="text-sm text-muted-foreground mb-2">
                  年代・地域など、分析結果で絞り込みに使いたい列を選びます。
                </p>
                <div className="flex flex-wrap gap-3">
                  {csv.columns
                    .filter((c) => c !== commentColumn)
                    .map((c) => (
                      <label
                        key={c}
                        className="flex items-center gap-1 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={attributeColumns.includes(c)}
                          onChange={() => toggleAttribute(c)}
                        />
                        {c}
                      </label>
                    ))}
                </div>
              </fieldset>

              <div>
                <p className="text-foreground font-medium mb-2">
                  プレビュー（先頭3件）
                </p>
                <ul className="space-y-1">
                  {comments.slice(0, 3).map((c) => (
                    <li
                      key={c.id}
                      className="text-sm bg-muted/50 rounded px-3 py-2 line-clamp-2"
                    >
                      {c.comment}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* 2. 必要情報 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">2. 必要情報の記入</h2>
          <FormInput
            label="タイトル（問い）"
            name="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例：〇〇市の子育て支援について、どのような声が寄せられたか"
            error={errors.question}
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
              placeholder="例：2026年9月に実施したアンケート（回答数1,200件）の自由記述を分析しました。"
              className={`${textareaClass} ${errors.intro ? "border-destructive" : ""}`}
            />
            {errors.intro && (
              <p className="text-destructive text-sm mt-1">{errors.intro}</p>
            )}
          </div>
          <FormInput
            label="分析ID（URLに使われます）"
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            error={errors.slug}
            required
          />
        </section>

        {/* 3. AI詳細設定 */}
        <section className="mb-8">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-primary font-medium hover:underline"
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? "▼" : "▶"} AI詳細設定（任意）
          </button>

          {showAdvanced && (
            <div className="mt-4 rounded-md border border-border p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="clusterLv1"
                    className="block text-foreground font-medium mb-2"
                  >
                    大きなグループの数
                  </label>
                  <input
                    id="clusterLv1"
                    type="number"
                    min={2}
                    max={40}
                    value={clusterLv1}
                    onChange={(e) => setClusterLv1(Number(e.target.value))}
                    className={textareaClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="clusterLv2"
                    className="block text-foreground font-medium mb-2"
                  >
                    小さなグループの数
                  </label>
                  <input
                    id="clusterLv2"
                    type="number"
                    min={4}
                    max={1000}
                    value={clusterLv2}
                    onChange={(e) => setClusterLv2(Number(e.target.value))}
                    className={textareaClass}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground -mt-2">
                CSVを読み込むと、コメント数に合わせた推奨値が自動で入ります。
              </p>
              {errors.cluster && (
                <p className="text-destructive text-sm">{errors.cluster}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="model"
                    className="block text-foreground font-medium mb-2"
                  >
                    AIモデル
                  </label>
                  <select
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded bg-background"
                  >
                    {MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="workers"
                    className="block text-foreground font-medium mb-2"
                  >
                    同時に処理する数
                  </label>
                  <input
                    id="workers"
                    type="number"
                    min={1}
                    max={100}
                    value={workers}
                    onChange={(e) => setWorkers(Number(e.target.value))}
                    className={textareaClass}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPubcom}
                  onChange={(e) => setIsPubcom(e.target.checked)}
                />
                元のコメントと分析結果を対応づけたCSVを出力する（パブコムモード）
              </label>

              {PROMPT_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label
                    htmlFor={`prompt-${key}`}
                    className="block text-foreground font-medium mb-2"
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
                <p className="text-destructive text-sm">{errors.prompt}</p>
              )}
            </div>
          )}
        </section>

        <div className="mb-6 rounded-md border border-warning/50 bg-warning/10 p-4 text-sm">
          分析にはOpenAIのAPI利用料がかかります。費用はコメント数とAIモデルによって変わり、完了後に一覧画面で確認できます。分析には数分〜数十分かかり、進み具合も一覧画面で確認できます。
        </div>

        {submitError && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            {submitError}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "送信中..." : "分析を開始"}
          </Button>
          <Link to="/kouchou">
            <Button type="button" variant="secondary">
              キャンセル
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
};

export default KouchouCreate;
