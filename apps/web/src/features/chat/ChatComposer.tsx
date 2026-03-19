import { useCallback, useMemo, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import type { sendMessageFunction } from "./hooks/useChatMessaging";
import { useEmojiCatalog } from "./hooks/useEmojiCatalog";
import EmojiPicker, { type EmojiSelection } from "./emoji/EmojiPicker";
import { parseChatTextSegments } from "./text/chatTextProcessing";

const CUSTOM_EMOJI_TOKEN_ATTR = "data-custom-emoji-token";

function isCustomEmojiChip(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && node.hasAttribute(CUSTOM_EMOJI_TOKEN_ATTR);
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (isCustomEmojiChip(node)) {
    return node.getAttribute(CUSTOM_EMOJI_TOKEN_ATTR) ?? "";
  }

  if (node.nodeName === "BR") {
    return "\n";
  }

  let serialized = "";
  node.childNodes.forEach((child) => {
    serialized += serializeNode(child);
  });
  return serialized;
}

function serializeComposerBody(root: HTMLElement): string {
  return serializeNode(root);
}

function getSelectionOffsetWithin(root: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return serializeComposerBody(root).length;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) {
    return serializeComposerBody(root).length;
  }

  const preCaretRange = document.createRange();
  preCaretRange.selectNodeContents(root);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  return serializeNode(preCaretRange.cloneContents()).length;
}

function restoreSelectionOffsetWithin(root: HTMLElement, targetOffset: number): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const totalLength = serializeComposerBody(root).length;
  const safeOffset = Math.max(0, Math.min(targetOffset, totalLength));
  const range = document.createRange();
  let remaining = safeOffset;

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (remaining <= text.length) {
        range.setStart(node, remaining);
        range.collapse(true);
        return true;
      }

      remaining -= text.length;
      return false;
    }

    if (isCustomEmojiChip(node)) {
      const token = node.getAttribute(CUSTOM_EMOJI_TOKEN_ATTR) ?? "";
      const tokenLength = token.length;
      if (remaining <= tokenLength) {
        if (remaining === 0) {
          range.setStartBefore(node);
        } else {
          range.setStartAfter(node);
        }
        range.collapse(true);
        return true;
      }

      remaining -= tokenLength;
      return false;
    }

    if (node.nodeName === "BR") {
      if (remaining <= 1) {
        range.setStartAfter(node);
        range.collapse(true);
        return true;
      }

      remaining -= 1;
      return false;
    }

    for (const child of Array.from(node.childNodes)) {
      if (walk(child)) {
        return true;
      }
    }

    return false;
  };

  const found = walk(root);

  if (!found) {
    range.selectNodeContents(root);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

function renderComposerTextSegments(root: HTMLElement, customEmojiById: Map<string, { assetUrl: string; name: string }>): string {
  const rawText = serializeComposerBody(root);
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

    if (segment.kind === "customEmojiToken") {
      const resolved = customEmojiById.get(segment.id);
      if (resolved) {
        const chip = document.createElement("span");
        chip.setAttribute(CUSTOM_EMOJI_TOKEN_ATTR, segment.value);
        chip.setAttribute("contenteditable", "false");
        chip.className = "mx-[1px] inline-flex h-[1.35em] w-[1.35em] align-[-0.2em]";

        const image = document.createElement("img");
        image.src = resolved.assetUrl;
        image.alt = `:${resolved.name}:`;
        image.title = `:${resolved.name}:`;
        image.className = "h-full w-full object-contain";
        image.draggable = false;

        chip.appendChild(image);
        fragment.appendChild(chip);
        continue;
      }
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
  const customEmojiById = useMemo(
    () => new Map(emojis.map((emoji) => [emoji.id, { assetUrl: emoji.assetUrl, name: emoji.name }])),
    [emojis],
  );

  const handleInputChange = (event: FormEvent<HTMLDivElement>) => {
    const inputEvent = event.nativeEvent as InputEvent;
    if (inputEvent.isComposing) {
      setMessageText(serializeComposerBody(event.currentTarget));
      return;
    }

    const plainText = renderComposerTextSegments(event.currentTarget, customEmojiById);
    setMessageText(plainText);
  };

  const handleCompositionEnd = () => {
    if (!editorRef.current) {
      return;
    }

    const plainText = renderComposerTextSegments(editorRef.current, customEmojiById);
    setMessageText(plainText);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };
  
  const handleSendMessage = async () => {
    const text = (editorRef.current ? serializeComposerBody(editorRef.current) : messageText).trim();

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
  };

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
      const plainText = renderComposerTextSegments(editor, customEmojiById);
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

    const plainText = renderComposerTextSegments(editor, customEmojiById);
    setMessageText(plainText);
    editor.focus();
  }, [customEmojiById]);

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
