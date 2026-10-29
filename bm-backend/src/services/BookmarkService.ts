import { randomBytes } from "node:crypto";
import { HttpError } from "../errors/HttpError.js";
import { hashPassword, hashSessionToken, verifyPassword } from "../security/passwords.js";
import type { BookmarkRepository } from "../repositories/BookmarkRepository.js";
import type {
    Collection,
    CollectionSessionResult,
    CreateCollectionInput,
    CreateCollectionResult,
    CreateLinkInput,
    SavedLink,
    UpdateCollectionInput,
} from "../types/domain.js";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export class BookmarkService {
    constructor(
        private readonly repository: BookmarkRepository,
        private readonly now: () => Date = () => new Date(),
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
        await this.repository.deleteCollection(collectionId);
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
