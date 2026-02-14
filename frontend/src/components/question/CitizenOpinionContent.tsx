import MarkdownRenderer from "../common/MarkdownRenderer";

interface DigestDraft {
  title: string;
  content: string;
  createdAt: string;
}

interface CitizenOpinionContentProps {
  digestDraft: DigestDraft | null | undefined;
}

/** Markdown を ## 見出しで分割し、各ブロックの body を返す（見出し行も含む） */
function splitByH2(markdown: string): string[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];

  // 行頭の ## 見出しの位置で分割（見出し行は各ブロックの先頭に含める）
  const parts = trimmed.split(/\n(?=##\s+)/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const CitizenOpinionContent = ({
  digestDraft,
}: CitizenOpinionContentProps) => {
  if (!digestDraft) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-base leading-relaxed">
          市民の意見レポートはまだ生成されていません。
        </p>
        <p className="mt-2 text-sm">
          より多くの意見が集まると表示されるようになります。
        </p>
      </div>
    );
  }

  if (!digestDraft.content || digestDraft.content.trim() === "") {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-base leading-relaxed">
          市民の意見レポートはまだ生成されていません。
        </p>
        <p className="mt-2 text-sm">
          より多くの意見が集まると表示されるようになります。
        </p>
      </div>
    );
  }

  // Markdownコンテンツを加工
  let processedContent = digestDraft.content;

  processedContent = processedContent.replace(
    /^#+\s*市民の意見レポート\s*\n*/gm,
    ""
  );
  processedContent = processedContent.replace(
    /^##?\s*問い\s*\n[\s\S]*?(?=\n##?\s|\n\n##?\s|$)/gm,
    ""
  );
  processedContent = processedContent.replace(
    /^(##?\s*)概要(\s*)$/gm,
    "$1まとめ$2"
  );

  const blocks = splitByH2(processedContent);

  return (
    <div className="space-y-6">
      {blocks.map((body) => (
        <div
          key={body.slice(0, 60)}
          className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-sm"
        >
          <div className="text-gray-800 leading-relaxed text-base">
            <MarkdownRenderer markdown={body} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CitizenOpinionContent;
