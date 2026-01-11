import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createBouncerEditor, type BouncerEditorConnection } from '@cup/bouncer-client';

export function BouncerEditor() {
  const [searchParams] = useSearchParams();
  const levelName = (searchParams.get('name') ?? '').trim();
  const editorRef = useRef<BouncerEditorConnection | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [saveState, setSaveState] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !levelName) return;

    editorRef.current?.disconnect();
    el.replaceChildren();
    editorRef.current = createBouncerEditor(el, levelName);

    return () => {
      editorRef.current?.disconnect();
      editorRef.current = null;
      containerRef.current?.replaceChildren();
    };
  }, [levelName]);

  async function saveLevel() {
    if (!editorRef.current || !levelName) return;
    setIsSaving(true);
    setSaveState(null);
    try {
      const level = editorRef.current.getLevelDefinition();
      const payload = { ...level, name: levelName };

      const res = await fetch('/api/games/bouncer/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      setSaveState('Saved');
    } catch (err) {
      console.error('Error saving level:', err);
      setSaveState('Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  if (!levelName) {
    return (
      <div>
        <p>Missing level name.</p>
        <Link to="/games/bouncer">Back</Link>
      </div>
    );
  }

  function fullScreen(): void {
      containerRef.current?.requestFullscreen();
  }

  return (
    <div className="editorPage">
      <div className="editorToolbar">
        <div className="editorTitle">Level Editor: {levelName}</div>
        <div className="editorActions">
          <button onClick={fullScreen}>Fullscreen</button>
          <button onClick={saveLevel} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Level'}
          </button>
          {saveState && <span className="editorStatus">{saveState}</span>}
        </div>
      </div>
      <div ref={containerRef} id="bouncer_editor_container" className="editorCanvas" />
    </div>
  );
}
