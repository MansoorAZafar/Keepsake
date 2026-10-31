import { randomBytes } from "node:crypto";
import { HttpError } from "../errors/HttpError.js";
import { hashPassword, hashSessionToken, verifyPassword } from "../security/passwords.js";
import type { BookmarkRepository } from "../repositories/BookmarkRepository.js";
import type {
    Collection,
    CollectionSessionResult,
    CollectionNote,
    CreateCollectionInput,
    CreateCollectionResult,
    CreateLinkInput,
    SavedLink,
    NoteComment,
    NoteDelta,
    UpdateNoteInput,
    UpdateCollectionInput,
} from "../types/domain.js";
import type { NoteImageStorage } from "./FilebaseStorage.js";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export class BookmarkService {
    constructor(
        private readonly repository: BookmarkRepository,
        private readonly now: () => Date = () => new Date(),
        private readonly imageStorage?: NoteImageStorage,
    ) {}

    async listCollections(): Promise<Collection[]> {
        const stored = await this.repository.listCollections();
        return Promise.all(stored.map((collection) => this.toPublicCollection(collection)));
    }

    async getCollection(id: string): Promise<Collection> {
        return this.toPublicCollection(await this.requireCollection(id));
    }

    async createCollection(input: CreateCollectionInput): Promise<CreateCollectionResult> {
        const deletePassword = randomBytes(24).toString("base64url");
        const stored = await this.repository.createCollection({
            name: input.name.trim(),
            description: input.description?.trim() ?? "",
            visibility: input.visibility,
            passwordHash: input.visibility === "private" ? hashPassword(input.password!) : null,
            deletePasswordHash: hashPassword(deletePassword),
        });
        const session = await this.issueSession(stored.id);
        return { collection: await this.toPublicCollection(stored), deletePassword, ...session };
    }

    async createSession(collectionId: string, password: string): Promise<CollectionSessionResult> {
        const collection = await this.requireCollection(collectionId);
        if (collection.visibility === "public")
            throw new HttpError(401, "Public collections do not use password sessions");
        if (!collection.passwordHash || !verifyPassword(password, collection.passwordHash))
            throw new HttpError(401, "Incorrect collection password");
        return this.issueSession(collectionId);
    }

    async closeSession(collectionId: string, accessToken: string): Promise<void> {
        const tokenHash = hashSessionToken(accessToken);
        const session = await this.repository.findSessionByTokenHash(tokenHash);
        if (!session || session.collectionId !== collectionId)
            throw new HttpError(401, "Session is invalid or expired");
        await this.repository.deleteSessionByTokenHash(tokenHash);
    }

    async updateCollection(
        collectionId: string,
        input: UpdateCollectionInput,
        accessToken: string,
    ): Promise<Collection> {
        await this.requireAccess(collectionId, accessToken);
        const updated = await this.repository.updateCollection(collectionId, {
            ...(input.name === undefined ? {} : { name: input.name.trim() }),
            ...(input.description === undefined ? {} : { description: input.description.trim() }),
        });
        if (!updated) throw new HttpError(404, "Collection not found");
        return this.toPublicCollection(updated);
    }

    async deleteCollection(collectionId: string, deletePassword: string): Promise<void> {
        const collection = await this.requireCollection(collectionId);
        if (!verifyPassword(deletePassword, collection.deletePasswordHash))
            throw new HttpError(401, "Incorrect deletion password");
        const deleted = await this.repository.deleteCollection(collectionId);
        if (deleted && this.imageStorage?.deleteCollectionImages) {
            try {
                await this.imageStorage.deleteCollectionImages(collectionId);
            } catch (error) {
                console.error("Could not remove deleted collection images from Filebase", error);
            }
        }
    }

    async listLinks(collectionId: string, accessToken?: string): Promise<SavedLink[]> {
        const collection = await this.requireCollection(collectionId);
        if (collection.visibility === "private") {
            if (!accessToken) throw new HttpError(401, "A collection session is required");
            await this.requireAccess(collectionId, accessToken);
        }
        return this.repository.listLinks(collectionId);
    }

    async createLink(
        collectionId: string,
        input: CreateLinkInput,
        accessToken: string,
    ): Promise<SavedLink> {
        await this.requireAccess(collectionId, accessToken);
        const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(input.url)
            ? input.url
            : `https://${input.url}`;
        let url: URL;
        try {
            url = new URL(candidate);
        } catch {
            throw new HttpError(400, "Enter a valid HTTP or HTTPS URL");
        }
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
            throw new HttpError(400, "Enter a valid HTTP or HTTPS URL");
        return this.repository.createLink({
            collectionId,
            url: url.toString(),
            domain: url.hostname.toLowerCase().replace(/^www\./, ""),
            title:
                input.title?.trim() ||
                url.pathname.split("/").filter(Boolean).at(-1) ||
                url.hostname,
            note: input.note?.trim() ?? "",
        });
    }

    async deleteLink(collectionId: string, linkId: string, accessToken: string): Promise<void> {
        await this.requireAccess(collectionId, accessToken);
        if (!(await this.repository.deleteLink(collectionId, linkId)))
            throw new HttpError(404, "Link not found");
    }

    async listNotes(collectionId: string, accessToken?: string): Promise<CollectionNote[]> {
        await this.requireReadAccess(collectionId, accessToken);
        const notes = await this.repository.listNotes(collectionId);
        return Promise.all(notes.map((note) => this.exposeImages(note)));
    }

    async createNote(
        collectionId: string,
        input: { title: string; content: NoteDelta },
        accessToken: string,
    ): Promise<CollectionNote> {
        await this.requireAccess(collectionId, accessToken);
        const content = this.normalizeImages(collectionId, input.content);
        const note = await this.repository.createNote({ collectionId, ...input, content });
        return this.exposeImages(note);
    }

    async updateNote(
        collectionId: string,
        noteId: string,
        input: UpdateNoteInput,
        accessToken: string,
    ): Promise<CollectionNote> {
        await this.requireAccess(collectionId, accessToken);
        const current = await this.requireNote(collectionId, noteId);
        const changes = {
            ...input,
            ...(input.content === undefined
                ? {}
                : { content: this.normalizeImages(collectionId, input.content) }),
        };
        const updated = await this.repository.updateNote(collectionId, noteId, changes);
        if (!updated) throw new HttpError(404, "Note not found");
        if (input.content !== undefined)
            await this.removeUnreferencedImages(
                collectionId,
                this.getImageKeys(current.content, collectionId).filter(
                    (key) => !this.getImageKeys(updated.content, collectionId).includes(key),
                ),
            );
        return this.exposeImages(updated);
    }

    async deleteNote(collectionId: string, noteId: string, accessToken: string): Promise<void> {
        await this.requireAccess(collectionId, accessToken);
        const note = await this.requireNote(collectionId, noteId);
        if (!(await this.repository.deleteNote(collectionId, noteId)))
            throw new HttpError(404, "Note not found");
        await this.removeUnreferencedImages(
            collectionId,
            this.getImageKeys(note.content, collectionId),
        );
    }

    async listNoteComments(
        collectionId: string,
        noteId: string,
        accessToken?: string,
    ): Promise<NoteComment[]> {
        await this.requireReadAccess(collectionId, accessToken);
        await this.requireNote(collectionId, noteId);
        return this.repository.listComments(noteId);
    }

    async createNoteComment(
        collectionId: string,
        noteId: string,
        body: string,
        accessToken: string,
    ): Promise<NoteComment> {
        await this.requireAccess(collectionId, accessToken);
        await this.requireNote(collectionId, noteId);
        return this.repository.createComment({ noteId, body: body.trim() });
    }

    async updateNoteComment(
        collectionId: string,
        noteId: string,
        commentId: string,
        body: string,
        accessToken: string,
    ): Promise<NoteComment> {
        await this.requireAccess(collectionId, accessToken);
        await this.requireNote(collectionId, noteId);
        const updated = await this.repository.updateComment(noteId, commentId, body.trim());
        if (!updated) throw new HttpError(404, "Comment not found");
        return updated;
    }

    async deleteNoteComment(
        collectionId: string,
        noteId: string,
        commentId: string,
        accessToken: string,
    ): Promise<void> {
        await this.requireAccess(collectionId, accessToken);
        await this.requireNote(collectionId, noteId);
        if (!(await this.repository.deleteComment(noteId, commentId)))
            throw new HttpError(404, "Comment not found");
    }

    async createNoteImageUpload(
        collectionId: string,
        contentType: string,
        size: number,
        accessToken: string,
    ): Promise<{
        uploadUrl: string;
        imageUrl: string;
        imageKey: string;
    }> {
        await this.requireAccess(collectionId, accessToken);
        const storage = this.requireImageStorage();
        try {
            return await storage.createUploadUrl(collectionId, contentType, size);
        } catch (error) {
            if (error instanceof HttpError) throw error;
            if (error instanceof Error && /JPEG|PNG|GIF|WebP|smaller than 5 MB/.test(error.message))
                throw new HttpError(400, error.message);
            throw error;
        }
    }

    async discardUnusedNoteImage(
        collectionId: string,
        imageKey: string,
        accessToken: string,
    ): Promise<void> {
        await this.requireAccess(collectionId, accessToken);
        const prefix = `collections/${collectionId}/images/`;
        if (!imageKey.startsWith(prefix) || imageKey.includes(".."))
            throw new HttpError(400, "The image does not belong to this collection");
        const storage = this.requireImageStorage();
        const stillReferenced = (await this.repository.listNotes(collectionId)).some((note) =>
            this.getImageKeys(note.content, collectionId).includes(imageKey),
        );
        if (!stillReferenced) await storage.deleteImages([imageKey]);
    }

    private async issueSession(collectionId: string): Promise<CollectionSessionResult> {
        const accessToken = randomBytes(32).toString("base64url");
        const expiresAt = new Date(this.now().getTime() + SESSION_TTL_MS).toISOString();
        await this.repository.createSession({
            collectionId,
            tokenHash: hashSessionToken(accessToken),
            expiresAt,
        });
        return { accessToken, expiresAt };
    }

    private async requireAccess(collectionId: string, accessToken: string): Promise<void> {
        await this.requireCollection(collectionId);
        const tokenHash = hashSessionToken(accessToken);
        const session = await this.repository.findSessionByTokenHash(tokenHash);
        if (!session || session.collectionId !== collectionId)
            throw new HttpError(401, "Session is invalid or expired");
        if (Date.parse(session.expiresAt) <= this.now().getTime()) {
            await this.repository.deleteSessionByTokenHash(tokenHash);
            throw new HttpError(401, "Session is invalid or expired");
        }
    }

    private async requireReadAccess(collectionId: string, accessToken?: string): Promise<void> {
        const collection = await this.requireCollection(collectionId);
        if (collection.visibility === "private") {
            if (!accessToken) throw new HttpError(401, "A collection session is required");
            await this.requireAccess(collectionId, accessToken);
        }
    }

    private async requireNote(collectionId: string, noteId: string): Promise<CollectionNote> {
        const note = await this.repository.findNote(collectionId, noteId);
        if (!note) throw new HttpError(404, "Note not found");
        return note;
    }

    private requireImageStorage(): NoteImageStorage {
        if (!this.imageStorage)
            throw new HttpError(503, "Note image storage is not configured on this server");
        return this.imageStorage;
    }

    private normalizeImages(collectionId: string, content: NoteDelta): NoteDelta {
        const images = content.ops.filter((operation) => typeof operation.insert !== "string");
        if (images.length === 0) return content;
        const storage = this.requireImageStorage();
        return {
            ops: content.ops.map((operation) => {
                if (typeof operation.insert === "string") return operation;
                const key = storage.isObjectUrl(operation.insert.image);
                if (!key || !key.startsWith(`collections/${collectionId}/images/`))
                    throw new HttpError(
                        400,
                        "Notes can only contain images uploaded to this collection",
                    );
                return { ...operation, insert: { image: `filebase://${key}` } };
            }),
        };
    }

    private getImageKeys(content: NoteDelta, collectionId: string): string[] {
        const storage = this.imageStorage;
        if (!storage) return [];
        const prefix = `collections/${collectionId}/images/`;
        return content.ops.flatMap((operation) => {
            if (typeof operation.insert === "string") return [];
            const key = storage.isObjectUrl(operation.insert.image);
            return key?.startsWith(prefix) ? [key] : [];
        });
    }

    private async removeUnreferencedImages(collectionId: string, candidateKeys: string[]) {
        if (!this.imageStorage || candidateKeys.length === 0) return;
        try {
            const stillReferenced = new Set(
                (await this.repository.listNotes(collectionId)).flatMap((note) =>
                    this.getImageKeys(note.content, collectionId),
                ),
            );
            const safeToDelete = [...new Set(candidateKeys)].filter(
                (key) => !stillReferenced.has(key),
            );
            if (safeToDelete.length) await this.imageStorage.deleteImages(safeToDelete);
        } catch (error) {
            console.error("Could not remove unused note images from object storage", error);
        }
    }

    private async exposeImages(note: CollectionNote): Promise<CollectionNote> {
        const images = note.content.ops.filter((operation) => typeof operation.insert !== "string");
        if (images.length === 0) return note;
        const storage = this.requireImageStorage();
        return {
            ...note,
            content: {
                ops: await Promise.all(
                    note.content.ops.map(async (operation) => {
                        if (typeof operation.insert === "string") return operation;
                        const key = storage.isObjectUrl(operation.insert.image);
                        if (!key || !key.startsWith(`collections/${note.collectionId}/images/`))
                            throw new HttpError(500, "A note contains an invalid image reference");
                        return {
                            ...operation,
                            insert: { image: await storage.createReadUrl(key) },
                        };
                    }),
                ),
            },
        };
    }

    private async requireCollection(id: string) {
        const collection = await this.repository.findCollection(id);
        if (!collection) throw new HttpError(404, "Collection not found");
        return collection;
    }

    private async toPublicCollection(
        stored: Awaited<ReturnType<BookmarkRepository["findCollection"]>>,
    ): Promise<Collection> {
        if (!stored) throw new HttpError(404, "Collection not found");
        const {
            passwordHash: _passwordHash,
            deletePasswordHash: _deletePasswordHash,
            ...collection
        } = stored;
        const links = await this.repository.listLinks(stored.id);
        return { ...collection, linkCount: links.length };
    }
}
