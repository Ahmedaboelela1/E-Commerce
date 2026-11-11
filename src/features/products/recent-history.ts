export const RECENT_LIMIT = 12;
export const RECENT_EVENT = 'skillverse-recent-updated';
const MAX_AGE = 30 * 86400000;
export type RecentVisit = {id: string; viewedAt: number};
export const recentKey = (channelId: string) =>
    `skillverse.recent.v1.${channelId}`;
export function parseRecentHistory(
    raw: string | null,
    now = Date.now(),
): RecentVisit[] {
    try {
        const value: unknown = JSON.parse(raw || '[]');
        if (!Array.isArray(value)) return [];
        const seen = new Set<string>();
        return value
            .filter((entry): entry is RecentVisit => {
                if (!entry || typeof entry !== 'object') return false;
                const {id, viewedAt} = entry;
                if (
                    typeof id !== 'string' ||
                    !/^[1-9]\d{0,15}$/.test(id) ||
                    seen.has(id) ||
                    typeof viewedAt !== 'number' ||
                    !Number.isFinite(viewedAt) ||
                    viewedAt < now - MAX_AGE ||
                    viewedAt > now + 86400000
                )
                    return false;
                seen.add(id);
                return true;
            })
            .slice(0, RECENT_LIMIT);
    } catch {
        return [];
    }
}
export function readRecentHistory(channelId: string) {
    try {
        return parseRecentHistory(localStorage.getItem(recentKey(channelId)));
    } catch {
        return [];
    }
}
export function recordRecentVisit(channelId: string, productId: string) {
    if (!/^[1-9]\d{0,15}$/.test(productId)) return;
    try {
        const visits = [
            {id: productId, viewedAt: Date.now()},
            ...readRecentHistory(channelId).filter((v) => v.id !== productId),
        ].slice(0, RECENT_LIMIT);
        localStorage.setItem(recentKey(channelId), JSON.stringify(visits));
        window.dispatchEvent(new Event(RECENT_EVENT));
    } catch {
        /* Browsing remains available when local storage is blocked. */
    }
}
export function clearRecentHistory(channelId: string) {
    try {
        localStorage.removeItem(recentKey(channelId));
    } catch {
        /* No persisted history is available. */
    }
    window.dispatchEvent(new Event(RECENT_EVENT));
}
