//profile update endpoint can update any number of fields, none are required, that's why this type looks stupid
export type UpdateUserProfileInput = {
  username?: string;
  displayName?: string | null;
  email?: string | null;
  avatarKey?: string | null;
};
