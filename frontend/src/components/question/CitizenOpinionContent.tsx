import MarkdownRenderer from "../common/MarkdownRenderer";

interface DigestDraft {
  title: string;
  content: string;
  createdAt: string;
}

interface CitizenOpinionContentProps {
  digestDraft: DigestDraft | null | undefined;
}

const CitizenOpinionContent = ({
  digestDraft,
}: CitizenOpinionContentProps) => {
  if (!digestDraft) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-base leading-relaxed">
          みんなのアイディアはまだ生成されていません。
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
          みんなのアイディアはまだ生成されていません。
        </p>
        <p className="mt-2 text-sm">
          より多くの意見が集まると表示されるようになります。
        </p>
      </div>
    );
  }

  // レポート全体を1枚のカードとして表示する。
  // 以前は ## 見出しごとにカード分割していたが、### 見出しは分割対象外のため
  // 「## 主要な課題」配下に ### が並ぶと、そのカードだけが極端に長くなり
  // カードの粒度が不揃いになっていた。生成側が見出し・箇条書きで構造を
  // 作っているので、それをそのまま活かす。
  // 各アイディアは「**課題**：…」「**すること**：…」「**解決されること**：…」
  // 「**論点**：…」という段落で構成される。段落の先頭にある強調をラベル
  // （チップ）として見せることで、どの段落が何を述べているかを一目で追える
  // ようにする。ラベル名をハードコードせず、構造だけで装飾している。
  const ideaLabelStyles = [
    "[&_p>strong:first-child]:mb-1",
    "[&_p>strong:first-child]:mr-2",
    "[&_p>strong:first-child]:inline-block",
    "[&_p>strong:first-child]:rounded-md",
    "[&_p>strong:first-child]:bg-muted",
    "[&_p>strong:first-child]:px-2",
    "[&_p>strong:first-child]:py-0.5",
    "[&_p>strong:first-child]:text-sm",
    "[&_p>strong:first-child]:font-bold",
    "[&_p>strong:first-child]:text-muted-foreground",
  ].join(" ");

  return (
    <div className="rounded-xl border border-border bg-card p-5 md:p-8 shadow-sm">
      <h3 className="text-xl md:text-2xl font-bold text-foreground font-biz mb-6 pb-4 border-b border-border">
        {digestDraft.title}
      </h3>
      <MarkdownRenderer
        markdown={digestDraft.content}
        className={ideaLabelStyles}
      />
    </div>
  );
};

export default CitizenOpinionContent;
