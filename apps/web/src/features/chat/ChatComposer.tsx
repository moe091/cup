import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import type { sendMessageFunction } from "./hooks/useChatMessaging";
import { useEmojiCatalog } from "./hooks/useEmojiCatalog";

type ChatComposerProps = {
  placeholder: string;
  sendMessage: sendMessageFunction;
  communityId: string | null;
};

export default function ChatComposer({ placeholder, sendMessage, communityId }: ChatComposerProps) {
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const { emojis, isLoading: isEmojiCatalogLoading, errorMessage: emojiCatalogErrorMessage } = useEmojiCatalog({ communityId });

  useEffect(() => {
    console.log("DEBUG:: Emoji catalog: ", emojis);
  }, [emojis]);

  const handleInputChange = (event: FormEvent<HTMLDivElement>) => {
    setMessageText(event.currentTarget.textContent ?? "");
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };
  
  const handleSendMessage = async () => {
    const text = (editorRef.current?.textContent ?? messageText).trim();

    if (text) {
      setIsSending(true);
      try {
        await sendMessage(text);
        setMessageText('');
        if (editorRef.current) {
          editorRef.current.textContent = "";
        }
      } finally {
        setIsSending(false);
      }
    }
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <div className="border-t border-[color:var(--line)] p-3">
      <div className="flex gap-2">
        <div className="relative min-h-16 flex-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2 text-sm text-[color:var(--text)] outline-none">
          {messageText.length === 0 ? (
            <span className="pointer-events-none absolute left-3 top-2 text-[color:var(--muted)]">
              {placeholder}
            </span>
          ) : null}
          <div
            ref={editorRef}
            role="textbox"
            aria-label={placeholder}
            aria-multiline="true"
            data-emoji-count={emojis.length}
            data-emoji-loading={isEmojiCatalogLoading ? 'true' : 'false'}
            data-emoji-error={emojiCatalogErrorMessage ? 'true' : 'false'}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInputChange}
            onKeyDown={handleEditorKeyDown}
            onPaste={handlePaste}
            className="min-h-11 whitespace-pre-wrap break-words outline-none"
          />
        </div>
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

