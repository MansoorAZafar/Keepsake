import type { CollectionSession } from "../types/api";

function sessionKey(collectionId: string) {
    return `keepsake.session.${collectionId}`;
}

export function readSession(collectionId: string): CollectionSession | null {
    try {
        const saved = window.sessionStorage.getItem(sessionKey(collectionId));
        if (!saved) return null;
        const session = JSON.parse(saved) as CollectionSession;
        if (!session.accessToken || Date.parse(session.expiresAt) <= Date.now()) {
            window.sessionStorage.removeItem(sessionKey(collectionId));
            return null;
        }
        return session;
    } catch {
        try {
            window.sessionStorage.removeItem(sessionKey(collectionId));
        } catch {
            // Session storage may be unavailable in restricted browser contexts.
        }
        return null;
    }
}

export function writeSession(collectionId: string, session: CollectionSession): void {
    window.sessionStorage.setItem(sessionKey(collectionId), JSON.stringify(session));
}

export function removeSession(collectionId: string): void {
    window.sessionStorage.removeItem(sessionKey(collectionId));
}
