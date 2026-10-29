import type { CollectionSummary } from "../types/api";

/** The recovery file deliberately excludes the bearer session token. */
export function buildCollectionBackup(collection: CollectionSummary, deletePassword: string) {
    return { collection, deletePassword };
}
