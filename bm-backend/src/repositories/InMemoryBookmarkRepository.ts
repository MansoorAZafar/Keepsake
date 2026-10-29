import { randomUUID } from "node:crypto";
import { hashPassword } from "../security/passwords.js";
import type { BookmarkRepository } from "./BookmarkRepository.js";
import type {
    CollectionSession,
    SavedLink,
    StoredCollection,
    UpdateCollectionInput,
} from "../types/domain.js";

export class InMemoryBookmarkRepository implements BookmarkRepository {
    private readonly collections = new Map<string, StoredCollection>();
    private readonly links = new Map<string, SavedLink>();
    private readonly sessions = new Map<string, CollectionSession>();

    constructor(options: { seed?: boolean } = {}) {
        if (options.seed !== false) this.seedDesignCollection();
    }

    private seedDesignCollection() {
        const now = new Date().toISOString();
        this.collections.set("design", {
            id: "design",
            name: "Design inspiration",
            description: "Interfaces, systems, and visual ideas",
            visibility: "private",
            passwordHash: hashPassword("design-demo"),
            deletePasswordHash: hashPassword("design-delete-demo"),
            createdAt: now,
            updatedAt: now,
        });
        const examples = [
            ["github.com/sdda", "sdda", "A saved GitHub profile."],
            ["https://www.github.com/32424", "32424", "Another GitHub page."],
            ["google.com/", "Google", "A useful place to start a search."],
            ["figma.com/design/sdfsdfs", "Figma design", "A design file to revisit."],
            ["example.com", "Example Domain", "A reference link."],
        ] as const;
        for (const [rawUrl, title, note] of examples) {
            const url = new URL(
                /^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`,
            );
            const id = randomUUID();
            this.links.set(id, {
                id,
                collectionId: "design",
                url: url.toString(),
                domain: url.hostname.toLowerCase().replace(/^www\./, ""),
                title,
                note,
                createdAt: now,
            });
        }
    }

    async close() {}

    async listCollections() {
        return [...this.collections.values()];
    }
    async findCollection(id: string) {
        return this.collections.get(id);
    }

    async createCollection(input: {
        name: string;
        description: string;
        visibility: "public" | "private";
        passwordHash: string | null;
        deletePasswordHash: string;
    }) {
        const now = new Date().toISOString();
        const collection: StoredCollection = {
            id: randomUUID(),
            ...input,
            createdAt: now,
            updatedAt: now,
        };
        this.collections.set(collection.id, collection);
        return collection;
    }

    async updateCollection(id: string, changes: UpdateCollectionInput) {
        const current = this.collections.get(id);
        if (!current) return undefined;
        const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
        this.collections.set(id, updated);
        return updated;
    }

    async deleteCollection(id: string) {
        if (!this.collections.delete(id)) return false;
        for (const [linkId, link] of this.links)
            if (link.collectionId === id) this.links.delete(linkId);
        for (const [sessionId, session] of this.sessions)
            if (session.collectionId === id) this.sessions.delete(sessionId);
        return true;
    }

    async listLinks(collectionId: string) {
        return [...this.links.values()].filter((link) => link.collectionId === collectionId);
    }

    async createLink(input: Omit<SavedLink, "id" | "createdAt">) {
        const link: SavedLink = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
        this.links.set(link.id, link);
        return link;
    }

    async deleteLink(collectionId: string, linkId: string) {
        const link = this.links.get(linkId);
        return link?.collectionId === collectionId ? this.links.delete(linkId) : false;
    }

    async createSession(input: Omit<CollectionSession, "id" | "createdAt">) {
        const session: CollectionSession = {
            id: randomUUID(),
            ...input,
            createdAt: new Date().toISOString(),
        };
        this.sessions.set(session.id, session);
        return session;
    }

    async findSessionByTokenHash(tokenHash: string) {
        return [...this.sessions.values()].find((session) => session.tokenHash === tokenHash);
    }

    async deleteSessionByTokenHash(tokenHash: string) {
        for (const [sessionId, session] of this.sessions) {
            if (session.tokenHash === tokenHash) this.sessions.delete(sessionId);
        }
    }
}
