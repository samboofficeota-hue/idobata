import MarkdownRenderer from "../common/MarkdownRenderer";

interface DigestDraft {
  title: string;
  content: string;
  createdAt: string;
}

interface OpinionSummaryContentProps {
  digestDraft: DigestDraft | null | undefined;
}

const OpinionSummaryContent = ({
  digestDraft,
}: OpinionSummaryContentProps) => {
  if (!digestDraft) {
    return (
      <div className="text-gray-500 text-center py-8">
        意見まとめはまだ生成されていません。より多くの意見が集まると意見まとめが表示されるようになります。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* タイトル */}
      <h3 className="text-2xl font-bold text-gray-800 mb-4">
        {digestDraft.title}
      </h3>

      {/* 本文 */}
      <div className="text-gray-800 leading-8">
        <MarkdownRenderer markdown={digestDraft.content} />
      </div>
    </div>
  );
};

export default OpinionSummaryContent;
