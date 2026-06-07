import type { CreateCommunityResponseDto } from "@cup/shared-types";
import { useMemo, useState } from "react";
import {
  createCommunity,
  requestCommunityIconUploadTarget,
  updateCommunityIconKey,
} from "../../api/communities";

type CreateCommunityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (community: CreateCommunityResponseDto, warningMessage?: string) => Promise<void> | void;
};

type CreateCommunityJoinMode = "PUBLIC" | "INVITE_ONLY";

const DESCRIPTION_MAX_LENGTH = 240;

export default function CreateCommunityModal({ isOpen, onClose, onCreated }: CreateCommunityModalProps) {
  const [name, setName] = useState("");
  const [joinMode, setJoinMode] = useState<CreateCommunityJoinMode>("PUBLIC");
  const [description, setDescription] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedName = name.trim();
  const canCreate = useMemo(() => trimmedName.length > 0, [trimmedName]);

  const resetForm = () => {
    setName("");
    setJoinMode("PUBLIC");
    setDescription("");
    setIconFile(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!canCreate || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      //send api request to create community WITHOUT iconKey first
      const created = await createCommunity({
        name: trimmedName,
        joinMode,
        description: description.trim() ? description.trim() : null,
      });
      
      let iconUploadWarning: string | null = null;

      //if an icon file was specified(it's optional) then: request s3 target from api, upload file to s3 target, send api request to update backend if icon was uploaded
      if (iconFile) {
        try {
          //gets an s3 target from backend
          const uploadTarget = await requestCommunityIconUploadTarget(created.id, {
            mimeType: iconFile.type,
            sizeBytes: iconFile.size,
          });

          //uses s3 target to upload icon file specified by user
          const uploadResponse = await fetch(uploadTarget.uploadUrl, {
            method: uploadTarget.method,
            headers: uploadTarget.headers,
            body: iconFile,
          });
          if (!uploadResponse.ok) {
            throw new Error('upload failed');
          }

          //if no error then update backend with iconKey
          await updateCommunityIconKey(created.id, {
            iconKey: uploadTarget.objectKey,
          });
        } catch {
          iconUploadWarning = 'Community created but icon upload failed, using default. You can update the icon in settings later.';
        }
      }
      await onCreated(created, iconUploadWarning ?? undefined);
      handleClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create community.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-[color:var(--panel)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="relative -mx-6 -mt-6 mb-2 rounded-t-2xl bg-[color:var(--panel-lighter)] px-6 py-4">
          <h2 className="text-center text-3xl font-semibold text-[color:var(--text)]">Create Community</h2>
        </div>

        <div className="mx-auto mt-10 grid w-full max-w-[90%] gap-7">
          {errorMessage ? (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center sm:gap-2">
            <label className="text-sm text-[color:var(--muted)]" htmlFor="create-community-icon">
              Icon (optional)
            </label>
            <div className="grid gap-2">
              <input
                id="create-community-icon"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setIconFile(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-[color:var(--muted)] file:mr-3 file:cursor-pointer file:rounded-full file:bg-[color:var(--panel-strong)] file:px-3 file:py-1.5 file:text-sm file:text-[color:var(--text)]"
              />
              <p className="text-xs text-[color:var(--muted)]">{iconFile ? iconFile.name : "No file selected"}</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center sm:gap-2">
            <label className="text-sm text-[color:var(--muted)]" htmlFor="create-community-name">
              Name
            </label>
            <input
              id="create-community-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter community name"
              className="w-full rounded-lg bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center sm:gap-2">
            <label className="text-sm text-[color:var(--muted)]" htmlFor="create-community-join-mode">
              Join mode
            </label>
            <select
              id="create-community-join-mode"
              value={joinMode}
              onChange={(event) => setJoinMode(event.target.value as CreateCommunityJoinMode)}
              className="w-full rounded-lg bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
            >
              <option value="PUBLIC">Public</option>
              <option value="INVITE_ONLY">Invite-only</option>
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-start sm:gap-2">
            <label className="text-sm text-[color:var(--muted)]" htmlFor="create-community-description">
              Description
            </label>
            <div>
              <textarea
                id="create-community-description"
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
                placeholder="Add a short description"
                rows={4}
                className="w-full resize-none rounded-lg bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
              />
              <p className="mt-1 text-right text-xs text-[color:var(--muted)]">
                {description.length}/{DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            className="cursor-pointer rounded-full px-4 py-2 text-sm text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!canCreate || isSubmitting}
            className="rounded-full bg-[color:var(--panel-strong)] px-5 py-2 text-sm text-[color:var(--text)] transition enabled:cursor-pointer enabled:hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Community"}
          </button>
        </div>
      </div>
    </div>
  );
}
