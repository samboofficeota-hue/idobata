import {
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Play,
  Scale,
} from "lucide-react";
import MarkdownRenderer from "../common/MarkdownRenderer";

interface DigestDraft {
  title: string;
  content: string;
  createdAt: string;
}

interface CitizenOpinionContentProps {
  digestDraft: DigestDraft | null | undefined;
}

interface IdeaRow {
  label: string;
  body: string;
}

interface Idea {
  title: string;
  rows: IdeaRow[];
}

/**
 * ダイジェストのMarkdownを「まとめ」と「アイディア」に分解する。
 * 期待する構造（digestGenerator の IDEA_STRUCTURE_RULES が生成する形）:
 *   ## まとめ
 *   ## アイディア：〔タイトル〕
 *   **課題**：… / **すること**：… / **解決されること**：… / **論点**：…
 * 構造が崩れている場合は ideas を空で返し、呼び出し側が素のMarkdown表示に
 * フォールバックする。
 */
function parseDigest(markdown: string): {
  summary: string | null;
  ideas: Idea[];
} {
  const blocks = markdown.split(/^##\s+/m).filter((b) => b.trim());
  let summary: string | null = null;
  const ideas: Idea[] = [];

  for (const block of blocks) {
    const newlineAt = block.indexOf("\n");
    const heading = (newlineAt === -1 ? block : block.slice(0, newlineAt)).trim();
    const body = newlineAt === -1 ? "" : block.slice(newlineAt + 1).trim();

    if (heading.includes("まとめ")) {
      summary = body;
      continue;
    }

    // 「アイディア：〜」以外の見出しは、アイディア扱いしない
    if (!heading.startsWith("アイディア")) continue;

    const title = heading.replace(/^アイディア\s*[：:]\s*/, "").trim();
    const rows: IdeaRow[] = [];

    for (const line of body.split("\n")) {
      // アイディア間の区切り線（--- や *** など）は本文に混ぜない
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) continue;

      const matched = line.match(/^\s*\*\*(.+?)\*\*\s*[：:]?\s*(.*)$/);
      if (matched) {
        rows.push({ label: matched[1].trim(), body: matched[2].trim() });
      } else if (rows.length > 0 && line.trim()) {
        // 折り返した行は直前の項目に続ける
        rows[rows.length - 1].body += line.trim();
      }
    }

    if (title) ideas.push({ title, rows });
  }

  return { summary, ideas };
}

/** 項目ラベルごとのアイコンと配色。未知のラベルは既定のスタイルにフォールバック */
function styleForLabel(label: string) {
  if (label.includes("課題"))
    return {
      Icon: AlertCircle,
      icon: "bg-orange-100 text-orange-600",
      text: "text-orange-700",
    };
  if (label.includes("すること"))
    return {
      Icon: Play,
      icon: "bg-primary-weak text-primary-800",
      text: "text-primary-800",
    };
  if (label.includes("解決"))
    return {
      Icon: CheckCircle2,
      icon: "bg-emerald-100 text-emerald-600",
      text: "text-emerald-700",
    };
  if (label.includes("論点"))
    return {
      Icon: Scale,
      icon: "bg-amber-100 text-amber-600",
      text: "text-amber-700",
    };
  return {
    Icon: Lightbulb,
    icon: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  };
}

const EmptyState = () => (
  <div className="py-12 text-center text-muted-foreground">
    <p className="text-base leading-relaxed">
      みんなのアイディアはまだ生成されていません。
    </p>
    <p className="mt-2 text-sm">
      より多くの意見が集まると表示されるようになります。
    </p>
  </div>
);

const CitizenOpinionContent = ({
  digestDraft,
}: CitizenOpinionContentProps) => {
  if (!digestDraft?.content || digestDraft.content.trim() === "") {
    return <EmptyState />;
  }

  const { summary, ideas } = parseDigest(digestDraft.content);

  // 想定の構造で解析できなかった場合は、素のMarkdownとして表示する
  if (ideas.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 md:p-8 shadow-sm">
        <h3 className="text-xl md:text-2xl font-bold text-foreground font-biz mb-6 pb-4 border-b border-border">
          {digestDraft.title}
        </h3>
        <MarkdownRenderer markdown={digestDraft.content} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー：「みんなの論点」レポートと揃えたグラデーション */}
      <div className="rounded-2xl bg-gradient-to-r from-primary-800 to-primary-400 p-6 md:p-8 text-white">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
          <Lightbulb className="h-4 w-4" />
          みんなのアイディア
        </div>
        <h3 className="mt-4 text-xl md:text-2xl font-bold font-biz leading-relaxed">
          {digestDraft.title}
        </h3>
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm">
            <Lightbulb className="h-4 w-4" />
            アイディア：{ideas.length}件
          </span>
        </div>
      </div>

      {/* まとめ */}
      {summary && (
        <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold text-foreground font-biz">
              まとめ
            </h4>
          </div>
          <MarkdownRenderer markdown={summary} />
        </div>
      )}

      {/* アイディア一覧 */}
      <div className="space-y-4">
        {ideas.map((idea, index) => (
          <div
            key={idea.title}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <div className="flex items-center gap-3 border-b border-border bg-primary-weak/60 px-5 py-4">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">
                {index + 1}
              </span>
              <h4 className="text-base md:text-lg font-bold text-foreground font-biz">
                {idea.title}
              </h4>
            </div>

            <div className="divide-y divide-border">
              {idea.rows.map((row) => {
                const { Icon, icon, text } = styleForLabel(row.label);
                return (
                  <div
                    key={row.label}
                    className="flex flex-col gap-2 px-5 py-4 md:flex-row md:gap-4"
                  >
                    <div className="flex flex-shrink-0 items-center gap-2 md:w-40">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-md ${icon}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`text-sm font-bold ${text}`}>
                        {row.label}
                      </span>
                    </div>
                    <p className="flex-1 leading-8 text-foreground/90">
                      {row.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CitizenOpinionContent;
