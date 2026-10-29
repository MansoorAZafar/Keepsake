import type {
    CollectionSession,
    SavedLink,
    StoredCollection,
    UpdateCollectionInput,
} from "../types/domain.js";

export interface BookmarkRepository {
    listCollections(): Promise<StoredCollection[]>;
    findCollection(id: string): Promise<StoredCollection | undefined>;
    createCollection(input: {
        name: string;
        description: string;
        visibility: "public" | "private";
        passwordHash: string | null;
        deletePasswordHash: string;
    }): Promise<StoredCollection>;
    updateCollection(
        id: string,
        changes: UpdateCollectionInput,
    ): Promise<StoredCollection | undefined>;
    deleteCollection(id: string): Promise<boolean>;
    listLinks(collectionId: string): Promise<SavedLink[]>;
    createLink(input: Omit<SavedLink, "id" | "createdAt">): Promise<SavedLink>;
    deleteLink(collectionId: string, linkId: string): Promise<boolean>;
    createSession(input: Omit<CollectionSession, "id" | "createdAt">): Promise<CollectionSession>;
    findSessionByTokenHash(tokenHash: string): Promise<CollectionSession | undefined>;
    deleteSessionByTokenHash(tokenHash: string): Promise<void>;
}
