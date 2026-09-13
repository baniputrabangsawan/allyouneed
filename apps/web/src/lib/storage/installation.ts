import { getLocalStorage, type StorageLike } from "./preferences";

export const INSTALLATION_STORAGE_KEY = "utility:installation-id";
export const DEVICE_SECRET_STORAGE_KEY = "utility:device-secret";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deviceSecretPattern = /^[A-Za-z0-9_-]{43}$/;

const createId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

export const isInstallationId = (value: unknown): value is string =>
  typeof value === "string" && uuidPattern.test(value);

export const isDeviceSecret = (value: unknown): value is string =>
  typeof value === "string" && deviceSecretPattern.test(value);

export const getInstallationId = (
  storage: StorageLike | undefined = getLocalStorage(),
): string | undefined => {
  try {
    const value = storage?.getItem(INSTALLATION_STORAGE_KEY);
    return isInstallationId(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

export const getOrCreateInstallationId = (
  storage: StorageLike | undefined = getLocalStorage(),
): string | undefined => {
  const existing = getInstallationId(storage);
  if (existing) return existing;
  if (!storage) return undefined;
  const created = createId();
  try {
    storage.setItem(INSTALLATION_STORAGE_KEY, created);
    return created;
  } catch {
    return undefined;
  }
};

export const getDeviceSecret = (
  storage: StorageLike | undefined = getLocalStorage(),
): string | undefined => {
  try {
    const value = storage?.getItem(DEVICE_SECRET_STORAGE_KEY);
    return isDeviceSecret(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

export const getOrCreateDeviceSecret = (
  storage: StorageLike | undefined = getLocalStorage(),
): string | undefined => {
  const existing = getDeviceSecret(storage);
  if (existing) return existing;
  if (!storage || typeof crypto === "undefined") return undefined;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    "",
  );
  const created = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  try {
    storage.setItem(DEVICE_SECRET_STORAGE_KEY, created);
    return created;
  } catch {
    return undefined;
  }
};

export interface InstallationCredentials {
  installationId: string;
  deviceSecret: string;
}

export const getOrCreateInstallationCredentials = (
  storage: StorageLike | undefined = getLocalStorage(),
): InstallationCredentials | undefined => {
  const installationId = getOrCreateInstallationId(storage);
  const deviceSecret = getOrCreateDeviceSecret(storage);
  return installationId && deviceSecret
    ? { installationId, deviceSecret }
    : undefined;
};

export const ensureInstallationId = getOrCreateInstallationId;
