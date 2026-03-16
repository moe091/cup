import { useState, type ChangeEvent } from "react";
import type { sendMessageFunction } from "./hooks/useChatMessaging";

type ChatComposerProps = {
  placeholder: string;
  sendMessage: sendMessageFunction;
};

export default function ChatComposer({ placeholder, sendMessage }: ChatComposerProps) {
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(event.target.value);
  };
  
  const handleSendMessage = async () => {
    const text = messageText.trim();

    if (text) {
      setIsSending(true);
      await sendMessage(text);
      setIsSending(false);
      setMessageText('');
    }
  }

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="border-t border-[color:var(--line)] p-3">
      <div className="flex gap-2">
        <textarea
          placeholder={placeholder}
          rows={2}
          onChange={handleInputChange}
          onKeyDown={handleTextareaKeyDown}
          value={messageText}
          className="min-h-16 flex-1 resize-none rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2 text-sm text-[color:var(--text)] outline-none"
        />
        <button
          type="button"
          onClick={handleSendMessage}
          className="h-fit rounded-full border border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--muted)]"
        >
          { isSending ? 'Sending...' : 'Send' }
        </button>
      </div>
    </div>
  );
}
