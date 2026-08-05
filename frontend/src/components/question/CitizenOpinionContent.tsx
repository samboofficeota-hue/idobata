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
  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-sm">
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        {digestDraft.title}
      </h3>
      <div className="text-gray-800 leading-relaxed text-base">
        <MarkdownRenderer markdown={digestDraft.content} />
      </div>
    </div>
  );
};

export default CitizenOpinionContent;
