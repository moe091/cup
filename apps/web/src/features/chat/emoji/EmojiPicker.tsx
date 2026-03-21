import type { CustomEmojiDto } from "@cup/shared-types";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import EmojiPickerSection from "./EmojiPickerSection";
import { DEFAULT_UNICODE_EMOJIS } from "./unicodeEmojis";

export type EmojiSelection =
  | { type: "unicode"; unicode: string }
  | { type: "custom"; name: string; id: string };

type EmojiPickerProps = {
  isOpen: boolean;
  rootRef: RefObject<HTMLElement | null>;
  anchorX?: number;
  anchorY?: number;
  customEmojis: CustomEmojiDto[];
  isLoadingCustom: boolean;
  customError: string | null;
  onClose: () => void;
  onSelect: (selection: EmojiSelection, keepOpen: boolean) => void;
};

type EmojiSectionId = "standard" | "custom";

type CollapsedState = Record<EmojiSectionId, boolean>;

const DEFAULT_COLLAPSED_STATE: CollapsedState = {
  standard: false,
  custom: false,
};

export default function EmojiPicker({
  isOpen,
  rootRef,
  anchorX,
  anchorY,
  customEmojis,
  isLoadingCustom,
  customError,
  onClose,
  onSelect,
}: EmojiPickerProps) {
  const [collapsedBySection, setCollapsedBySection] = useState<CollapsedState>(DEFAULT_COLLAPSED_STATE);
  const isAnchored = anchorX !== undefined && anchorY !== undefined;
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [anchoredTop, setAnchoredTop] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !isAnchored || anchorY === undefined || !pickerRef.current) {
      return;
    }

    const viewportPadding = 8;
    const pickerHeight = pickerRef.current.getBoundingClientRect().height;
    const maxTop = window.innerHeight - pickerHeight - viewportPadding;
    const nextTop = Math.max(viewportPadding, Math.min(anchorY, maxTop));
    setAnchoredTop(nextTop);
  }, [isOpen, isAnchored, anchorY, collapsedBySection]);

  useEffect(() => {
    if (!isOpen || !isAnchored) {
      setAnchoredTop(null);
      return;
    }

    const onResize = () => {
      if (!pickerRef.current || anchorY === undefined) {
        return;
      }

      const viewportPadding = 8;
      const pickerHeight = pickerRef.current.getBoundingClientRect().height;
      const maxTop = window.innerHeight - pickerHeight - viewportPadding;
      const nextTop = Math.max(viewportPadding, Math.min(anchorY, maxTop));
      setAnchoredTop(nextTop);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [isOpen, isAnchored, anchorY]);

  const pickerStyle = useMemo<CSSProperties | undefined>(() => {
    if (!isAnchored || anchorX === undefined || anchorY === undefined) {
      return undefined;
    }

    const pickerWidth = 320;
    const gapPx = 8;
    const left = Math.max(8, anchorX - pickerWidth - gapPx);

    return {
      position: "fixed",
      left,
      top: anchoredTop ?? anchorY,
    };
  }, [isAnchored, anchorX, anchorY, anchoredTop]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      if (!root.contains(event.target as Node)) {
        onClose();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose, rootRef]);

  const handleToggleSection = useCallback((sectionId: string) => {
    if (sectionId !== "standard" && sectionId !== "custom") {
      return;
    }

    setCollapsedBySection((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={pickerRef}
      style={pickerStyle}
      className={`${
        isAnchored ? "fixed z-30" : "absolute bottom-full right-0 z-20 mb-2"
      } w-[320px] rounded-xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.35)]`}
    >
      <EmojiPickerSection
        sectionId="standard"
        title="Standard"
        isCollapsed={collapsedBySection.standard}
        onToggle={handleToggleSection}
      >
        <div className="grid max-h-36 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-2">
          {DEFAULT_UNICODE_EMOJIS.map((emoji) => (
            <button
              key={emoji.unicode}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => onSelect({ type: "unicode", unicode: emoji.unicode }, event.shiftKey)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-2xl leading-none hover:bg-[color:var(--highlight)]"
              title={emoji.label}
              aria-label={emoji.label}
            >
              {emoji.unicode}
            </button>
          ))}
        </div>
      </EmojiPickerSection>

      <div className="mt-3">
        <EmojiPickerSection
          sectionId="custom"
          title="Custom"
          isCollapsed={collapsedBySection.custom}
          onToggle={handleToggleSection}
        >
          <div className="max-h-44 overflow-y-auto rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-2">
            {isLoadingCustom ? (
              <p className="text-xs text-[color:var(--muted)]">Loading custom emojis...</p>
            ) : customError ? (
              <p className="text-xs text-red-300">{customError}</p>
            ) : customEmojis.length === 0 ? (
              <p className="text-xs text-[color:var(--muted)]">No custom emojis available.</p>
            ) : (
              <div className="grid grid-cols-6 gap-1">
                {customEmojis.map((emoji) => (
                  <button
                    key={emoji.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => onSelect({ type: "custom", id: emoji.id, name: emoji.name }, event.shiftKey)}
                    className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-[color:var(--highlight)]"
                    title={`:${emoji.name}:`}
                    aria-label={`:${emoji.name}:`}
                  >
                    <img src={emoji.assetUrl} alt={emoji.name} className="h-7 w-7 object-contain" draggable={false} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </EmojiPickerSection>
      </div>

      <p className="mt-3 text-[11px] text-[color:var(--muted)]">Tip: hold Shift while clicking an emoji to keep picker open.</p>
    </div>
  );
}
