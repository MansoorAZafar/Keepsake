export type CollectionVisibility = "public" | "private";

export interface Collection {
    id: string;
    name: string;
    description: string;
    visibility: CollectionVisibility;
    createdAt: string;
    updatedAt: string;
    linkCount: number;
}

export interface StoredCollection extends Omit<Collection, "linkCount"> {
    passwordHash: string | null;
    deletePasswordHash: string;
}

export interface SavedLink {
    id: string;
    collectionId: string;
    url: string;
    domain: string;
    title: string;
    note: string;
    createdAt: string;
}

export interface CollectionSession {
    id: string;
    collectionId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
}

interface CreateCollectionFields {
    name: string;
    description?: string;
}

export type CreateCollectionInput =
    | (CreateCollectionFields & { visibility: "public"; password?: never })
    | (CreateCollectionFields & { visibility: "private"; password: string });

export interface UpdateCollectionInput {
    name?: string;
    description?: string;
}

export interface CreateLinkInput {
    url: string;
    title?: string;
    note?: string;
}

export interface CollectionSessionResult {
    accessToken: string;
    expiresAt: string;
}

export interface CreateCollectionResult extends CollectionSessionResult {
    collection: Collection;
    deletePassword: string;
}
