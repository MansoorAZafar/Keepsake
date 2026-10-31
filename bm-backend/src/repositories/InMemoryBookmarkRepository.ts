import { randomUUID } from "node:crypto";
import { hashPassword } from "../security/passwords.js";
import type { BookmarkRepository } from "./BookmarkRepository.js";
import type {
    CollectionSession,
    CollectionNote,
    NoteComment,
    SavedLink,
    StoredCollection,
    UpdateNoteInput,
    UpdateCollectionInput,
} from "../types/domain.js";

export class InMemoryBookmarkRepository implements BookmarkRepository {
    private readonly collections = new Map<string, StoredCollection>();
    private readonly links = new Map<string, SavedLink>();
    private readonly sessions = new Map<string, CollectionSession>();
    private readonly notes = new Map<string, CollectionNote>();
    private readonly comments = new Map<string, NoteComment>();

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
        const noteIds = new Set<string>();
        for (const [noteId, note] of this.notes) {
            if (note.collectionId === id) {
                noteIds.add(noteId);
                this.notes.delete(noteId);
            }
        }
        for (const [commentId, comment] of this.comments)
            if (noteIds.has(comment.noteId)) this.comments.delete(commentId);
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

    async listNotes(collectionId: string) {
        return [...this.notes.values()]
            .filter((note) => note.collectionId === collectionId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    async createNote(input: Omit<CollectionNote, "id" | "createdAt" | "updatedAt">) {
        const now = new Date().toISOString();
        const note: CollectionNote = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
        this.notes.set(note.id, note);
        return note;
    }

    async findNote(collectionId: string, noteId: string) {
        const note = this.notes.get(noteId);
        return note?.collectionId === collectionId ? note : undefined;
    }

    async updateNote(collectionId: string, noteId: string, changes: UpdateNoteInput) {
        const current = await this.findNote(collectionId, noteId);
        if (!current) return undefined;
        const updated: CollectionNote = {
            ...current,
            ...changes,
            updatedAt: new Date().toISOString(),
        };
        this.notes.set(noteId, updated);
        return updated;
    }

    async deleteNote(collectionId: string, noteId: string) {
        const note = await this.findNote(collectionId, noteId);
        if (!note) return false;
        this.notes.delete(noteId);
        for (const [commentId, comment] of this.comments)
            if (comment.noteId === noteId) this.comments.delete(commentId);
        return true;
    }

    async listComments(noteId: string) {
        return [...this.comments.values()]
            .filter((comment) => comment.noteId === noteId)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    async createComment(input: Omit<NoteComment, "id" | "createdAt">) {
        const comment: NoteComment = {
            id: randomUUID(),
            ...input,
            createdAt: new Date().toISOString(),
        };
        this.comments.set(comment.id, comment);
        return comment;
    }

    async updateComment(noteId: string, commentId: string, body: string) {
        const current = this.comments.get(commentId);
        if (!current || current.noteId !== noteId) return undefined;
        const updated = { ...current, body };
        this.comments.set(commentId, updated);
        return updated;
    }

    async deleteComment(noteId: string, commentId: string) {
        const current = this.comments.get(commentId);
        if (!current || current.noteId !== noteId) return false;
        return this.comments.delete(commentId);
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
