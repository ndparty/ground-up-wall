export const SUBMITTER_NAME_KEY = "upload_submitter_name";
export const SOCIAL_HANDLE_KEY = "upload_social_handle";

export interface FormProfile {
  submitterName: string;
  socialHandle: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  return globalThis.localStorage;
}

export function loadFormProfile(storage: StorageLike | null = defaultStorage()): FormProfile {
  if (!storage) {
    return { submitterName: "", socialHandle: "" };
  }
  return {
    submitterName: storage.getItem(SUBMITTER_NAME_KEY) ?? "",
    socialHandle: storage.getItem(SOCIAL_HANDLE_KEY) ?? "",
  };
}

export function saveFormProfile(
  profile: FormProfile,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;

  const submitterName = profile.submitterName.trim();
  const socialHandle = profile.socialHandle.trim();

  if (submitterName) {
    storage.setItem(SUBMITTER_NAME_KEY, submitterName);
  } else {
    storage.removeItem(SUBMITTER_NAME_KEY);
  }

  if (socialHandle) {
    storage.setItem(SOCIAL_HANDLE_KEY, socialHandle);
  } else {
    storage.removeItem(SOCIAL_HANDLE_KEY);
  }
}
