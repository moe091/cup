import { useCallback, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import type { sendMessageFunction } from "./hooks/useChatMessaging";
import { useEmojiCatalog } from "./hooks/useEmojiCatalog";
import EmojiPicker, { type EmojiSelection } from "./EmojiPicker";
import { parseChatTextSegments } from "./text/chatTextProcessing";

function getSelectionOffsetWithin(root: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return root.textContent?.length ?? 0;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) {
    return root.textContent?.length ?? 0;
  }

  const preCaretRange = document.createRange();
  preCaretRange.selectNodeContents(root);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  return preCaretRange.toString().length;
}

function restoreSelectionOffsetWithin(root: HTMLElement, targetOffset: number): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const safeOffset = Math.max(0, Math.min(targetOffset, root.textContent?.length ?? 0));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let traversed = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const nextTraversed = traversed + node.data.length;
    if (safeOffset <= nextTraversed) {
      const localOffset = safeOffset - traversed;
      const range = document.createRange();
      range.setStart(node, localOffset);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    traversed = nextTraversed;
  }

  const fallbackRange = document.createRange();
  fallbackRange.selectNodeContents(root);
  fallbackRange.collapse(false);
  selection.removeAllRanges();
  selection.addRange(fallbackRange);
}

function renderComposerTextSegments(root: HTMLElement): string {
  const rawText = root.textContent ?? "";
  const caretOffset = getSelectionOffsetWithin(root);
  const segments = parseChatTextSegments(rawText);
  const fragment = document.createDocumentFragment();

  for (const segment of segments) {
    if (segment.kind === "unicodeEmoji") {
      const emojiSpan = document.createElement("span");
      emojiSpan.className = "inline text-[1.35em] leading-none align-[-0.1em]";
      emojiSpan.textContent = segment.value;
      fragment.appendChild(emojiSpan);
      continue;
    }

    fragment.appendChild(document.createTextNode(segment.value));
  }

  root.replaceChildren(fragment);
  restoreSelectionOffsetWithin(root, caretOffset);
  return rawText;
}

type ChatComposerProps = {
  placeholder: string;
  sendMessage: sendMessageFunction;
  communityId: string | null;
};

export default function ChatComposer({ placeholder, sendMessage, communityId }: ChatComposerProps) {
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const pickerRootRef = useRef<HTMLDivElement | null>(null);
  const { emojis, isLoading: isEmojiCatalogLoading, errorMessage: emojiCatalogErrorMessage } = useEmojiCatalog({ communityId });

  const handleInputChange = (event: FormEvent<HTMLDivElement>) => {
    const inputEvent = event.nativeEvent as InputEvent;
    if (inputEvent.isComposing) {
      setMessageText(event.currentTarget.textContent ?? "");
      return;
    }

    const plainText = renderComposerTextSegments(event.currentTarget);
    setMessageText(plainText);
  };

  const handleCompositionEnd = () => {
    if (!editorRef.current) {
      return;
    }

    const plainText = renderComposerTextSegments(editorRef.current);
    setMessageText(plainText);
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
        setIsPickerOpen(false);
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

  const insertTextAtCursor = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      editor.append(document.createTextNode(text));
      const plainText = renderComposerTextSegments(editor);
      setMessageText(plainText);
      return;
    }

    const hasSelectionInsideEditor =
      selection.rangeCount > 0 &&
      editor.contains(selection.anchorNode) &&
      editor.contains(selection.focusNode);

    const range = hasSelectionInsideEditor
      ? selection.getRangeAt(0).cloneRange()
      : (() => {
          const endRange = document.createRange();
          endRange.selectNodeContents(editor);
          endRange.collapse(false);
          return endRange;
        })();

    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    const caretRange = document.createRange();
    caretRange.setStartAfter(textNode);
    caretRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caretRange);

    const plainText = renderComposerTextSegments(editor);
    setMessageText(plainText);
    editor.focus();
  }, []);

  const handleEmojiSelect = useCallback(
    (selection: EmojiSelection, keepOpen: boolean) => {
      if (selection.type === "unicode") {
        insertTextAtCursor(selection.unicode);
      } else {
        insertTextAtCursor(` <:${selection.name}:${selection.id}> `);
      }

      if (!keepOpen) {
        setIsPickerOpen(false);
      }
    },
    [insertTextAtCursor],
  );

  return ( 
    <div className="border-t border-[color:var(--line)] p-3">
      <div className="relative min-h-16 rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2 text-base text-[color:var(--text)] outline-none">
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
          contentEditable
          suppressContentEditableWarning
          onInput={handleInputChange}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleEditorKeyDown}
          onPaste={handlePaste}
          className="min-h-11 max-h-64 overflow-y-auto pr-32 whitespace-pre-wrap break-words outline-none"
        />

        <div ref={pickerRootRef} className="absolute right-2 top-2 flex items-center gap-2">
          <button
            type="button"
            aria-label="Open emoji picker"
            title="Open emoji picker"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIsPickerOpen((prev) => !prev)}
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel-lighter)] px-2.5 py-1.5 text-sm text-[color:var(--muted)] hover:border-[color:var(--text)] hover:text-[color:var(--text)]"
          >
            🙂
          </button>
          <button
            type="button"
            onClick={handleSendMessage}
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel-lighter)] px-3.5 py-1.5 text-sm text-[color:var(--muted)] hover:border-[color:var(--text)] hover:text-[color:var(--text)]"
          >
            { isSending ? '...' : 'Send' }
          </button>

          <EmojiPicker
            isOpen={isPickerOpen}
            rootRef={pickerRootRef}
            customEmojis={emojis}
            isLoadingCustom={isEmojiCatalogLoading}
            customError={emojiCatalogErrorMessage}
            onClose={() => setIsPickerOpen(false)}
            onSelect={handleEmojiSelect}
          />
        </div>
      </div>
    </div>
  );
}
