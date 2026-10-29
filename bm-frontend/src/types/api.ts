export interface CollectionSummary {
    id: string;
    name: string;
    description: string;
    visibility: "public" | "private";
    createdAt: string;
    updatedAt: string;
    linkCount: number;
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

export interface CollectionAccess {
    collection: CollectionSummary;
    accessToken: string;
    expiresAt: string;
}

export interface CollectionSession {
    accessToken: string;
    expiresAt: string;
}

export interface CreateCollectionInput {
    name: string;
    description: string;
    visibility: "public" | "private";
    password?: string;
}

export interface CreatedCollection extends CollectionAccess {
    deletePassword: string;
}

export interface CreateLinkInput {
    url: string;
    title?: string;
    note?: string;
}
