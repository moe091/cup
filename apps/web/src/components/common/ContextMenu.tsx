import { useEffect, useRef } from "react";


type ContextMenuItem = {
  id: string; //used for key since label may not always be unique
  label: string;
  clickHandler: () => Promise<void> | void;
  variant?: "default" | "danger" | "muted";
  disabled?: boolean;
}

export type ContextMenuState = {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
};

export type ContextMenuProps = ContextMenuState & {
  onClose: () => void;
};

export default function ContextMenu(props: ContextMenuProps) {
  const { isOpen, items, x, y, onClose } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen)
      return;

    //define this handler inside the effect where it's added as a listener to keep things simple and avoid stale closures. It calls onClose so we need to include that in deps for the effect
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current)
        return;
  
      if (!menuRef.current.contains(event.target as Node)) { //checks of the right-click target is inside our menuRef(which would mean they clicked inside the context menu). if not, close the menu
        onClose();
      }
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    }
  }, [isOpen, onClose]);
  
  
  async function itemClickHandler(item: ContextMenuItem) {
    if (item.disabled) 
      return;
    try {
      await item.clickHandler();
    } finally {//no catch, just let error propogate up so I can see it and fix if it happens
      onClose();
    }
  }

  if (!isOpen || items.length == 0) //if not open, or if we have 0 items to show, don't render
    return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[120] min-w-44 rounded-lg border border-[color:var(--line)] bg-[#1a1e24] p-1 text-sm text-[color:var(--text)] shadow-[0_14px_30px_rgba(0,0,0,0.45)]"
      style={{ top: y, left: x }}
    >
      {items.map((item) => {
        const baseClass = "block w-full rounded-md px-2.5 py-2 text-left transition";
        const variantClass =
          item.variant === "danger"
            ? "text-red-300 hover:bg-red-500/20"
            : item.variant === "muted"
              ? "text-[color:var(--muted)] hover:bg-white/10"
              : "hover:bg-white/10";
        const disabledClass = item.disabled
          ? "cursor-default opacity-60 hover:bg-transparent"
          : "cursor-pointer";
        return (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => void itemClickHandler(item)}
            className={`${baseClass} ${variantClass} ${disabledClass}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}