import { useEffect, useRef, useState } from 'react';
import { createBouncerEditor, type BouncerEditorConnection } from '@cup/bouncer-client';
import { levelNames } from '@cup/bouncer-shared';

export function BouncerEditor() {
  const editorRef = useRef<BouncerEditorConnection | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [levelName, setLevelName] = useState('');
  const [saveState, setSaveState] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(levelNames[0] ?? '');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    editorRef.current?.disconnect();
    el.replaceChildren();
    editorRef.current = createBouncerEditor(el, "Unnamed");

    return () => {
      editorRef.current?.disconnect();
      editorRef.current = null;
      containerRef.current?.replaceChildren();
    };
  }, [1]);

  async function saveLevel() {
    if (!editorRef.current) return;
    setIsSaving(true);
    setSaveState(null);
    
    const raw = window.prompt('Enter level name(letters, numbers, and underscores only): ', levelName) ?? '';
    //TODO:: add some client-side name validation and display error messages
    const name = raw?.trim();
    setLevelName(name);

    try {
      const level = editorRef.current.getLevelDefinition();
      const payload = { ...level, name: name };

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

  function fullScreen(): void {
      containerRef.current?.requestFullscreen();
  }

  function startLoadLevel(): void {
    setIsLoading(true);
  }

  function cancelLoadLevel(): void {
    setIsLoading(false);
  }

  function loadSelected(): void {
    console.log("LOADING: " + selectedLevel);
    editorRef.current?.loadExistingLevel(selectedLevel);
    setIsLoading(false);
  }

  function getLoadLevelModal(): import("react").ReactNode {
    return (
      <div className="modal_container">
        <div className="modal_content">
          <h3>Select Level:</h3>
          <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
            {levelNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="modal_buttons">
            <button onClick={loadSelected}>Load</button>
            <button onClick={cancelLoadLevel}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="editorPage">
      <div className="editorToolbar">
        <div className="editorTitle">Level Editor: {levelName || 'Unnamed'}</div>
        <div className="editorActions">
          <button onClick={fullScreen}>Fullscreen</button>
          <button onClick={startLoadLevel}>Load Level</button>
          <button onClick={saveLevel} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Level'}
          </button>
          {saveState && <span className="editorStatus">{saveState}</span>}

          {isLoading && getLoadLevelModal()}
        </div>
      </div>
      <div ref={containerRef} id="bouncer_editor_container" className="editorCanvas" />
    </div>
  );
}
