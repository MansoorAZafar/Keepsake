import type {
    CreatedCollection,
    CollectionSession,
    CollectionSummary,
    CreateCollectionInput,
    CreateLinkInput,
    SavedLink,
} from "../types/api";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3001/api").replace(
    /\/$/,
    "",
);

export class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...init,
            headers,
            signal: init.signal ?? controller.signal,
        });
        if (response.status === 204) return undefined as T;

        let payload: {
            data?: T;
            error?: string;
            details?: Array<{ message: string }>;
        };
        try {
            payload = (await response.json()) as typeof payload;
        } catch {
            throw new ApiError(
                response.ok
                    ? "The API returned an invalid response."
                    : `The API returned an unreadable error (${response.status}).`,
                response.status,
            );
        }
        if (!response.ok) {
            const detail = payload.details?.map((item) => item.message).join(" ");
            throw new ApiError(
                detail || payload.error || "The request could not be completed.",
                response.status,
            );
        }
        return payload.data as T;
    } catch (error) {
        if (controller.signal.aborted)
            throw new ApiError(
                "The API did not respond in time. Check that bm-backend is running.",
                0,
            );
        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

export const api = {
    listCollections: () => request<CollectionSummary[]>("/collections"),
    getCollection: (collectionId: string) =>
        request<CollectionSummary>(`/collections/${encodeURIComponent(collectionId)}`),
    createCollection: (input: CreateCollectionInput) =>
        request<CreatedCollection>("/collections", { method: "POST", body: JSON.stringify(input) }),
    createSession: (collectionId: string, password: string) =>
        request<CollectionSession>(`/collections/${encodeURIComponent(collectionId)}/sessions`, {
            method: "POST",
            body: JSON.stringify({ password }),
        }),
    closeSession: (collectionId: string, token: string) =>
        request<void>(
            `/collections/${encodeURIComponent(collectionId)}/sessions/current`,
            { method: "DELETE" },
            token,
        ),
    listLinks: (collectionId: string, token?: string) =>
        request<SavedLink[]>(`/collections/${encodeURIComponent(collectionId)}/links`, {}, token),
    createLink: (collectionId: string, token: string, input: CreateLinkInput) =>
        request<SavedLink>(
            `/collections/${encodeURIComponent(collectionId)}/links`,
            { method: "POST", body: JSON.stringify(input) },
            token,
        ),
    deleteLink: (collectionId: string, linkId: string, token: string) =>
        request<void>(
            `/collections/${encodeURIComponent(collectionId)}/links/${encodeURIComponent(linkId)}`,
            { method: "DELETE" },
            token,
        ),
    deleteCollection: (collectionId: string, deletePassword: string) =>
        request<void>(`/collections/${encodeURIComponent(collectionId)}`, {
            method: "DELETE",
            body: JSON.stringify({ deletePassword }),
        }),
};
