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
  console.log(`[CitizenOpinionContent] Received digestDraft:`, digestDraft);
  console.log(`[CitizenOpinionContent] digestDraft type:`, typeof digestDraft);
  console.log(`[CitizenOpinionContent] digestDraft keys:`, digestDraft ? Object.keys(digestDraft) : null);
  
  if (!digestDraft) {
    console.log(`[CitizenOpinionContent] No digestDraft provided, showing placeholder`);
    return (
      <div className="text-gray-500 text-center py-12">
        <p className="text-base leading-relaxed">
          市民の意見レポートはまだ生成されていません。
        </p>
        <p className="text-sm mt-2">
          より多くの意見が集まると表示されるようになります。
        </p>
      </div>
    );
  }

  // contentが空または存在しない場合のチェック
  if (!digestDraft.content || digestDraft.content.trim() === "") {
    console.log(`[CitizenOpinionContent] digestDraft.content is empty`);
    return (
      <div className="text-gray-500 text-center py-12">
        <p className="text-base leading-relaxed">
          市民の意見レポートはまだ生成されていません。
        </p>
        <p className="text-sm mt-2">
          より多くの意見が集まると表示されるようになります。
        </p>
      </div>
    );
  }
  
  console.log(`[CitizenOpinionContent] Rendering digestDraft with title:`, digestDraft.title);
  console.log(`[CitizenOpinionContent] Content length:`, digestDraft.content.length);

  // Markdownコンテンツを加工
  // 1. タイトル「市民の意見レポート」を削除
  // 2. 「問い」セクションを削除
  // 3. 「概要」を「まとめ」に変更
  // 4. 「主要な課題」はそのまま表示
  let processedContent = digestDraft.content;

  // 「市民の意見レポート」というタイトル（h1またはh2）を削除
  processedContent = processedContent.replace(
    /^#+\s*市民の意見レポート\s*\n*/gm,
    ""
  );

  // 「問い」セクションを削除（「問い」から次の見出しまで、または文末まで）
  // より柔軟なパターンで削除
  processedContent = processedContent.replace(
    /^##?\s*問い\s*\n[\s\S]*?(?=\n##?\s|\n\n##?\s|$)/gm,
    ""
  );

  // 「概要」を「まとめ」に変更（h2またはh3の見出し）
  processedContent = processedContent.replace(
    /^(##?\s*)概要(\s*)$/gm,
    "$1まとめ$2"
  );

  return (
    <div className="space-y-6">
      {/* 本文（タイトルは表示しない） */}
      <div className="text-gray-800 leading-relaxed text-base">
        <MarkdownRenderer markdown={processedContent} />
      </div>
    </div>
  );
};

export default CitizenOpinionContent;
