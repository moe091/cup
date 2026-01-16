import { useEffect, useMemo, useRef, useState } from 'react';
import { createBouncerEditor, type BouncerEditorConnection } from '@cup/bouncer-client';
import { listLevels, type LevelListItem } from '../../../api/bouncer';

export function BouncerEditor() {
  const editorRef = useRef<BouncerEditorConnection | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [levels, setLevels] = useState<LevelListItem[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [saveState, setSaveState] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const levelDetails = useMemo(() => {
    const map = new Map<string, LevelListItem>();
    for (const level of levels) map.set(level.id, level);
    
    return map;
  }, [levels]);

  
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
      } catch {
        console.error("auth/me reqeust failed");
      }
    })();
  }, []);
  
  useEffect(() => {
    const updateLevelList = async () => {
      const list: LevelListItem[] = await listLevels();
      setLevels(list);
      if (list.length > 0) {
        setSelectedLevel(list[0].id);
      }
    }

    updateLevelList();
    
  }, []);

  useEffect(() => { // Create the actual editor and get a reference to it
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
  }, []);

  function getLevelName(id: string): string {
    return levelDetails.get(id)?.name || '';
  }

  async function saveLevel() {
    if (!editorRef.current) return;
    setIsSaving(true);
    setSaveState(null);
    
    const raw = window.prompt('Enter level name(letters, numbers, and underscores only): ', getLevelName(selectedLevel));
    //TODO:: add some client-side name validation and display error messages
    const name = raw?.trim();

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

  async function loadSelected() {
    if (!selectedLevel) return;

    editorRef.current?.loadExistingLevel(selectedLevel);
    setIsLoading(false);
  }

  function getLoadLevelModal(): import("react").ReactNode {
    return (
      <div className="modal_container">
        <div className="modal_content">
          <h3>Select Level:</h3>
          <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
            {levels.map((lvl) => (
              <option key={`${lvl.ownerUserId ?? 'system'}:${lvl.name}`} value={lvl.id}>
                {lvl.ownerUserId ? lvl.name : `${lvl.name} (System Level)`}
              </option>
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
        <div className="editorTitle">Level Editor: {getLevelName(selectedLevel) || 'Unnamed'}</div>
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
