import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CommunityJoinMode } from '@cup/shared-types';
import {
  fetchCommunitySettingsBySlug,
  requestCommunityIconUploadTarget,
  updateCommunityIconKey,
  updateCommunitySettingsBySlug,
} from '../../api/communities';
import { buildS3AssetUrl } from '../../config/s3';

const DESCRIPTION_MAX_LENGTH = 240;

type Params = { slug: string };

export default function CommunitySettingsPage() {
  const { slug } = useParams<Params>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const [communityId, setCommunityId] = useState<string | null>(null);
  const [communityName, setCommunityName] = useState('');
  const [description, setDescription] = useState('');
  const [joinMode, setJoinMode] = useState<CommunityJoinMode>('PUBLIC');
  const [iconKey, setIconKey] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [canEditGeneral, setCanEditGeneral] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);

  const [initialName, setInitialName] = useState('');
  const [initialDescription, setInitialDescription] = useState('');
  const [initialJoinMode, setInitialJoinMode] = useState<CommunityJoinMode>('PUBLIC');

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      setErrorMessage('Missing community slug');
      return;
    }

    let active = true;
    setIsLoading(true);
    setErrorMessage(null);

    const load = async () => {
      try {
        const settings = await fetchCommunitySettingsBySlug(slug);
        if (!active) {
          return;
        }

        setCommunityId(settings.id);
        setCommunityName(settings.name);
        const nextDescription = settings.description ?? '';
        const nextJoinMode = settings.joinMode === 'REQUEST' ? 'INVITE_ONLY' : settings.joinMode;
        setDescription(nextDescription);
        setJoinMode(nextJoinMode);
        setIconKey(settings.iconKey);
        setCanEditGeneral(settings.canEditGeneral);
        setInitialName(settings.name);
        setInitialDescription(nextDescription);
        setInitialJoinMode(nextJoinMode);
      } catch (error) {
        if (!active) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load community settings.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [slug]);

  const hasChanges = useMemo(() => {
    return (
      communityName.trim() !== initialName
      || (description.trim() ? description.trim() : '') !== initialDescription
      || joinMode !== initialJoinMode
      || iconFile !== null
    );
  }, [communityName, initialName, description, initialDescription, joinMode, initialJoinMode, iconFile]);

  const canSave = useMemo(() => {
    return canEditGeneral && communityName.trim().length > 0 && hasChanges && !isSaving;
  }, [canEditGeneral, communityName, hasChanges, isSaving]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  useEffect(() => {
    if (!iconFile) {
      setIconPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(iconFile);
    setIconPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [iconFile]);

  const onSave = async () => {
    if (!slug || !canSave) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setWarningMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await updateCommunitySettingsBySlug(slug, {
        name: communityName.trim(),
        description: description.trim() ? description.trim() : null,
        joinMode,
      });

      setCommunityName(updated.name);
      setDescription(updated.description ?? '');
      setJoinMode(updated.joinMode);
      setInitialName(updated.name);
      setInitialDescription(updated.description ?? '');
      setInitialJoinMode(updated.joinMode);

      if (iconFile && communityId) {
        try {
          const uploadTarget = await requestCommunityIconUploadTarget(communityId, {
            mimeType: iconFile.type,
            sizeBytes: iconFile.size,
          });
          const uploadResponse = await fetch(uploadTarget.uploadUrl, {
            method: uploadTarget.method,
            headers: uploadTarget.headers,
            body: iconFile,
          });
          if (!uploadResponse.ok) {
            throw new Error('upload failed');
          }
          await updateCommunityIconKey(communityId, { iconKey: uploadTarget.objectKey });
          setIconKey(uploadTarget.objectKey);
        } catch {
          setWarningMessage('Settings saved, but icon upload failed.');
        }
      }

      setIconFile(null);
      setSuccessMessage('Saved changes.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const onRemoveIcon = async () => {
    if (!communityId || !canEditGeneral || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await updateCommunityIconKey(communityId, { iconKey: null });
      setIconKey(null);
      setIconFile(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to remove icon.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <main className="min-h-screen w-full px-6 pt-[calc(var(--topbar-h)+2rem)] text-[color:var(--text)]" />;
  }

  if (errorMessage && !communityId) {
    return (
      <main className="min-h-screen w-full px-6 pt-[calc(var(--topbar-h)+2rem)] text-[color:var(--text)]">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-300">
          {errorMessage}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full px-6 pt-[calc(var(--topbar-h)+2rem)] text-[color:var(--text)]">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/90 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Community Settings</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">General</h1>

        {!canEditGeneral ? (
          <p className="mt-6 text-sm text-[color:var(--muted)]">You don&apos;t have permission to edit this server.</p>
        ) : (
          <div className="mt-6 grid gap-6">
            {errorMessage ? <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p> : null}
            {warningMessage ? <p className="rounded-md bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">{warningMessage}</p> : null}

            <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center sm:gap-2">
              <span className="text-sm text-[color:var(--muted)]">Current icon</span>
              <div className="flex items-center gap-3">
                {iconKey ? (
                  <img src={iconPreviewUrl ?? buildS3AssetUrl(iconKey) ?? ''} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  iconPreviewUrl ? (
                    <img src={iconPreviewUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[color:var(--panel-strong)] text-xl font-semibold uppercase">
                      {communityName.charAt(0) || '?'}
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={() => iconInputRef.current?.click()}
                  disabled={isSaving}
                  className="rounded-full border border-[color:var(--line)] px-3 py-1.5 text-xs transition enabled:cursor-pointer enabled:hover:border-[color:var(--text)] disabled:opacity-60"
                >
                  Change icon
                </button>
                <input
                  ref={iconInputRef}
                  id="community-settings-icon"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setIconFile(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
                {iconKey ? (
                  <button
                    type="button"
                    onClick={() => void onRemoveIcon()}
                    disabled={isSaving}
                    className="rounded-full border border-[color:var(--line)] px-3 py-1.5 text-xs transition enabled:cursor-pointer enabled:hover:border-[color:var(--text)] disabled:opacity-60"
                  >
                    Remove
                  </button>
                ) : null}
                {iconFile ? (
                  <span className="text-xs text-[color:var(--muted)]">{iconFile.name}</span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center sm:gap-2">
              <label className="text-sm text-[color:var(--muted)]" htmlFor="community-settings-name">Name</label>
              <input
                id="community-settings-name"
                type="text"
                value={communityName}
                onChange={(event) => setCommunityName(event.target.value)}
                className="w-full rounded-lg bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center sm:gap-2">
              <label className="text-sm text-[color:var(--muted)]" htmlFor="community-settings-join-mode">Join mode</label>
              <select
                id="community-settings-join-mode"
                value={joinMode}
                onChange={(event) => setJoinMode(event.target.value as CommunityJoinMode)}
                className="w-full rounded-lg bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              >
                <option value="PUBLIC">Public</option>
                <option value="INVITE_ONLY">Invite-only</option>
              </select>
            </div>

            <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start sm:gap-2">
              <label className="text-sm text-[color:var(--muted)]" htmlFor="community-settings-description">Description</label>
              <div>
                <textarea
                  id="community-settings-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
                  rows={4}
                  className="w-full resize-none rounded-lg bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                />
                <p className="mt-1 text-right text-xs text-[color:var(--muted)]">{description.length}/{DESCRIPTION_MAX_LENGTH}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={!canSave}
                className={`rounded-full px-5 py-2 text-sm text-[color:var(--text)] transition ${
                  hasChanges
                    ? 'border border-emerald-400/40 bg-emerald-500/10 enabled:hover:bg-emerald-500/15'
                    : 'bg-[color:var(--panel-strong)]'
                } enabled:cursor-pointer disabled:opacity-50`}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
      {successMessage ? (
        <div className="pointer-events-none fixed left-1/2 top-[calc(var(--topbar-h)+0.75rem)] z-[160] -translate-x-1/2">
          <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel-lighter)]/95 px-6 py-3 text-center text-base font-medium text-[color:var(--text)] shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
            {successMessage}
          </div>
        </div>
      ) : null}
    </main>
  );
}
