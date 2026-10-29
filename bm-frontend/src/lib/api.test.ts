import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("frontend API client", () => {
    it("unwraps the common data envelope", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValue(
                    new Response(JSON.stringify({ data: [{ id: "design" }] }), { status: 200 }),
                ),
        );
        await expect(api.listCollections()).resolves.toEqual([{ id: "design" }]);
    });

    it("sends JSON, bearer authorization, and reports API errors", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: "Session is invalid or expired" }), {
                status: 401,
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        await expect(
            api.createLink("design", "token", { url: "github.com/sdda" }),
        ).rejects.toBeInstanceOf(ApiError);
        const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
        const headers = new Headers(requestInit.headers);
        expect(requestInit.method).toBe("POST");
        expect(headers.get("Authorization")).toBe("Bearer token");
        expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("handles empty 204 responses", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
        await expect(api.closeSession("design", "token")).resolves.toBeUndefined();
    });

    it("returns a useful message when a server error is not JSON", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("upstream failed", { status: 502 })),
        );
        await expect(api.listCollections()).rejects.toMatchObject({
            name: "ApiError",
            status: 502,
            message: "The API returned an unreadable error (502).",
        });
    });

    it("keeps the timeout active while reading a response body", async () => {
        vi.useFakeTimers();
        vi.stubGlobal(
            "fetch",
            vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
                const response = {
                    status: 200,
                    json: () =>
                        new Promise((_resolve, reject) => {
                            const rejectForAbort = () =>
                                reject(new DOMException("Aborted", "AbortError"));
                            if (init?.signal?.aborted) rejectForAbort();
                            else init?.signal?.addEventListener("abort", rejectForAbort);
                        }),
                } as unknown as Response;
                return Promise.resolve(response);
            }),
        );
        const pendingRequest = api.listCollections();
        const timeoutAssertion = expect(pendingRequest).rejects.toMatchObject({
            name: "ApiError",
            message: "The API did not respond in time. Check that bm-backend is running.",
        });
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(15_000);
        await timeoutAssertion;
    });
});
