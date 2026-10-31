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

export interface UpdateCollectionInput {
    name: string;
    description: string;
}

export interface NoteDeltaOperation {
    insert: string | { image: string };
    attributes?: Record<string, string | number | boolean>;
}

export interface NoteDelta {
    ops: NoteDeltaOperation[];
}

export interface UploadedNoteImage {
    imageUrl: string;
    imageKey: string;
}

export interface NoteImageUploadGrant extends UploadedNoteImage {
    uploadUrl: string;
}

export interface CollectionNote {
    id: string;
    collectionId: string;
    title: string;
    content: NoteDelta;
    createdAt: string;
    updatedAt: string;
}

export interface NoteComment {
    id: string;
    noteId: string;
    body: string;
    createdAt: string;
}

export interface CreateNoteInput {
    title: string;
    content: NoteDelta;
}

export interface UpdateNoteInput {
    title?: string;
    content?: NoteDelta;
}

export interface CreatedCollection extends CollectionAccess {
    deletePassword: string;
}

export interface CreateLinkInput {
    url: string;
    title?: string;
    note?: string;
}
