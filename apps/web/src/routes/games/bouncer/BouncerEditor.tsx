import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createBouncerEditor,
  type BouncerEditorConnection,
} from "@cup/bouncer-client";
import { listLevels, type LevelListItem } from "../../../api/bouncer";

export function BouncerEditor() {
  const editorRef = useRef<BouncerEditorConnection | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [levels, setLevels] = useState<LevelListItem[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [saveState, setSaveState] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const levelDetails = useMemo(() => {
    const map = new Map<string, LevelListItem>();
    for (const level of levels) map.set(level.id, level);

    return map;
  }, [levels]);

  useEffect(() => {
    const updateLevelList = async () => {
      const list: LevelListItem[] = await listLevels();
      setLevels(list);
      if (list.length > 0) {
        setSelectedLevel(list[0].id);
      }
    };

    updateLevelList();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    editorRef.current?.disconnect();
    el.replaceChildren();
    editorRef.current = createBouncerEditor(el, "Unnamed");

    const container = containerRef.current;
    return () => {
      editorRef.current?.disconnect();
      editorRef.current = null;
      container?.replaceChildren();
    };
  }, []);

  function getLevelName(id: string): string {
    return levelDetails.get(id)?.name || "";
  }

  async function saveLevel() {
    if (!editorRef.current) return;
    setIsSaving(true);
    setSaveState(null);

    const raw = window.prompt(
      "Enter level name(letters, numbers, and underscores only): ",
      getLevelName(selectedLevel),
    );
    const name = raw?.trim();

    try {
      const level = editorRef.current.getLevelDefinition();
      const payload = { ...level, name: name };

      const res = await fetch("/api/games/bouncer/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      setSaveState("Saved");
    } catch (err) {
      console.error("Error saving level:", err);
      setSaveState("Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  function fullScreen(): void {
    containerRef.current?.requestFullscreen();
  }

  function startLoadLevel(): void {
    setIsLoading(true);
  }

  function cancelLoadLevel(): void {
    setIsLoading(false);
  }

  async function loadSelected() {
    if (!selectedLevel) return;

    editorRef.current?.loadExistingLevel(selectedLevel);
    setIsLoading(false);
  }

  function getLoadLevelModal(): ReactNode {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,12,15,0.7)] backdrop-blur">
        <div className="w-full max-w-md rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/95 p-6 text-[color:var(--text)] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <h3 className="mb-4 text-lg font-semibold">Select Level</h3>

          <select
            className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--accent)]"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            {levels.map((lvl) => (
              <option
                key={`${lvl.ownerUserId ?? "system"}:${lvl.name}`}
                value={lvl.id}
              >
                {lvl.ownerUserId ? lvl.name : `${lvl.name} (System Level)`}
              </option>
            ))}
          </select>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={cancelLoadLevel}
              className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--text)] hover:border-[color:var(--text)] transition"
            >
              Cancel
            </button>
            <button
              onClick={loadSelected}
              className="rounded-full bg-[color:var(--panel-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:brightness-110 transition"
            >
              Load
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/80 p-2 md:p-8 backdrop-blur">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl sm:text-3xl text-[color:var(--text)]">
            Level Editor: {getLevelName(selectedLevel) || "Unnamed"}
          </h2>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={fullScreen}
              className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--text)] hover:border-[color:var(--text)] transition"
            >
              Fullscreen
            </button>
            <button
              onClick={startLoadLevel}
              className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--text)] hover:border-[color:var(--text)] transition"
            >
              Load Level
            </button>
            <button
              onClick={saveLevel}
              disabled={isSaving}
              className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--text)] hover:border-[color:var(--text)] transition disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Level"}
            </button>
            {saveState && (
              <span className="self-center text-sm text-[color:var(--muted)]">
                {saveState}
              </span>
            )}
          </div>
        </div>

        <div ref={containerRef} id="bouncer_editor_container" />

        {isLoading && getLoadLevelModal()}
      </div>
    </div>
  );
}
