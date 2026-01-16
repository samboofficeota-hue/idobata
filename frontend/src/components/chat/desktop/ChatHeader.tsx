import type React from "react";
import { Button } from "../../ui/button";

interface ChatHeaderProps {
  onSendMessage?: (message: string) => void;
  onChangeTopic?: () => void;
  onEndConversation?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onSendMessage,
  onChangeTopic,
  onEndConversation,
}) => {
  const handleChangeTopicClick = () => {
    if (onChangeTopic) {
      onChangeTopic();
    } else if (onSendMessage) {
      // フォールバック: 既存の動作を維持（後方互換性）
      onSendMessage("このテーマに関して別の話題を話しましょう");
    }
  };

  const handleEndConversationClick = () => {
    if (onEndConversation) {
      onEndConversation();
    } else if (onSendMessage) {
      // フォールバック: 既存の動作を維持（後方互換性）
      onSendMessage("会話を終了");
    }
  };

  return (
    <div className="border-b flex items-center justify-between p-3">
      <h3 className="font-medium">チャット</h3>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleChangeTopicClick}
          className="text-sm bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200"
        >
          新しいチャット
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEndConversationClick}
          className="text-sm bg-red-100 text-red-800 border border-red-300 hover:bg-red-200"
        >
          チャットを終了
        </Button>
      </div>
    </div>
  );
};
