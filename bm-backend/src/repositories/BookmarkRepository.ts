import type {
    CollectionSession,
    CollectionNote,
    NoteComment,
    SavedLink,
    StoredCollection,
    UpdateNoteInput,
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
    listNotes(collectionId: string): Promise<CollectionNote[]>;
    createNote(
        input: Omit<CollectionNote, "id" | "createdAt" | "updatedAt">,
    ): Promise<CollectionNote>;
    findNote(collectionId: string, noteId: string): Promise<CollectionNote | undefined>;
    updateNote(
        collectionId: string,
        noteId: string,
        changes: UpdateNoteInput,
    ): Promise<CollectionNote | undefined>;
    deleteNote(collectionId: string, noteId: string): Promise<boolean>;
    listComments(noteId: string): Promise<NoteComment[]>;
    createComment(input: Omit<NoteComment, "id" | "createdAt">): Promise<NoteComment>;
    updateComment(
        noteId: string,
        commentId: string,
        body: string,
    ): Promise<NoteComment | undefined>;
    deleteComment(noteId: string, commentId: string): Promise<boolean>;
    createSession(input: Omit<CollectionSession, "id" | "createdAt">): Promise<CollectionSession>;
    findSessionByTokenHash(tokenHash: string): Promise<CollectionSession | undefined>;
    deleteSessionByTokenHash(tokenHash: string): Promise<void>;
    close(): Promise<void>;
}
