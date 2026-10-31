import api from "../config/axios.config";

/**
 * Session-only. The token dies with the tab, so a shared or unattended machine
 * does not leave System Logs unlocked, and it never reaches localStorage where
 * it would outlive the person who typed the passphrase.
 */
const STORAGE_KEY = "system-logs-access";

interface StoredAccess {
    token: string;
    expiresAt: number;
}

const read = (): StoredAccess | null => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredAccess;
        if (!parsed?.token || !parsed?.expiresAt) return null;
        // Expiry is enforced server-side on every call; this check only avoids
        // firing requests that are already known to fail.
        if (parsed.expiresAt <= Date.now()) {
            window.sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

/** The header value for the current session, or null when locked. */
export const getLogsAccessToken = (): string | null => read()?.token ?? null;

export const hasLogsAccess = (): boolean => getLogsAccessToken() !== null;

export const clearLogsAccess = (): void => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(STORAGE_KEY);
};

/**
 * Exchange the development passphrase for a token.
 *
 * The passphrase is sent exactly once. Everything after this call carries the
 * token instead, so the passphrase never lands in proxy logs or browser history.
 */
export const unlockLogs = async (password: string): Promise<void> => {
    const res = await api.post<{ token: string; expiresAt: number }>(
        "/system-logs/access",
        { password },
    );
    if (typeof window !== "undefined") {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(res.data));
    }
};

/** Whether this environment has a passphrase configured at all. */
export const getLogsAccessStatus = async (): Promise<{ configured: boolean }> => {
    const res = await api.get<{ configured: boolean }>("/system-logs/access/status");
    return res.data;
};
