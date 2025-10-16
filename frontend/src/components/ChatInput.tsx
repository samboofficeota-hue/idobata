import { useState } from "react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
}

function ChatInput({ onSendMessage }: ChatInputProps) {
  const [message, setMessage] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full relative">
      <textarea
        value={message}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          setMessage(e.target.value)
        }
        placeholder="メッセージを入力...（Enterで改行、⌘+Enterで送信）"
        className="w-full bg-white border-t border-b border-l border-neutral-300 focus:border-t-neutral-400 focus:border-b-neutral-400 focus:border-l-neutral-400 focus:ring-1 focus:ring-neutral-400 rounded-xl text-neutral-800 placeholder:text-neutral-400 py-2 md:py-3 px-3 md:px-4 pr-12 md:pr-16 min-h-[50px] md:min-h-[60px] text-sm md:text-base resize-none"
        onKeyDown={(
          e: React.KeyboardEvent<HTMLTextAreaElement> & {
            isComposing?: boolean;
            nativeEvent: { isComposing?: boolean };
          }
        ) => {
          // Command+Enter (Mac) or Ctrl+Enter (Windows/Linux) for sending
          if (
            e.key === "Enter" &&
            (e.metaKey || e.ctrlKey) &&
            !e.isComposing &&
            !e.nativeEvent.isComposing &&
            message.trim()
          ) {
            e.preventDefault();
            handleSubmit(e);
          }
          // Enter alone should just create a new line (default behavior)
        }}
      />
      <button
        type="submit"
        className="absolute right-2 md:right-3 top-[50%] transform -translate-y-1/2 h-8 w-8 md:h-10 md:w-10 rounded-full text-sm font-medium bg-neutral-700 text-white hover:bg-neutral-800 transition-colors duration-200 flex items-center justify-center"
        disabled={!message.trim()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <title>送信</title>
          <path
            fillRule="evenodd"
            d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </form>
  );
}

export default ChatInput;
