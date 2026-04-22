import { useCallback, useState } from "react";

export type ProfileField = "avatar" | "username" | "displayName" | "email";

type ProfileFieldMap<T> = Record<ProfileField, T>;

function createProfileFieldMap<T>(value: T): ProfileFieldMap<T> {
  return {
    avatar: value,
    username: value,
    displayName: value,
    email: value,
  };
}

export function useProfileFieldState() {
  const [editingByField, setEditingByField] = useState<ProfileFieldMap<boolean>>(createProfileFieldMap(false));
  const [savingByField, setSavingByField] = useState<ProfileFieldMap<boolean>>(createProfileFieldMap(false));
  const [errorByField, setErrorByField] = useState<ProfileFieldMap<string | null>>(createProfileFieldMap(null));

  const setFieldEditing = useCallback((field: ProfileField, value: boolean) => {
    setEditingByField((previous) => ({ ...previous, [field]: value }));
  }, []);

  const setFieldSaving = useCallback((field: ProfileField, value: boolean) => {
    setSavingByField((previous) => ({ ...previous, [field]: value }));
  }, []);

  const setFieldError = useCallback((field: ProfileField, message: string | null) => {
    setErrorByField((previous) => ({ ...previous, [field]: message }));
  }, []);

  const beginEdit = useCallback(
    (field: ProfileField) => {
      setFieldError(field, null);
      setFieldEditing(field, true);
    },
    [setFieldEditing, setFieldError],
  );

  const resetAllFieldUiState = useCallback(() => {
    setEditingByField(createProfileFieldMap(false));
    setSavingByField(createProfileFieldMap(false));
    setErrorByField(createProfileFieldMap(null));
  }, []);

  return {
    editingByField,
    savingByField,
    errorByField,
    setFieldEditing,
    setFieldSaving,
    setFieldError,
    beginEdit,
    resetAllFieldUiState,
  };
}
