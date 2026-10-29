import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { api } from "../lib/api";
import { theme } from "../app/theme";
import { HomePage } from "./HomePage";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
});

const collection = {
    id: "design",
    name: "Design inspiration",
    description: "Interfaces and visual ideas",
    visibility: "private" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    linkCount: 5,
};

function renderHome() {
    return render(
        <ThemeProvider theme={theme}>
            <MemoryRouter initialEntries={["/"]}>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route
                        path="/collections/:collectionId"
                        element={<div>Collection opened</div>}
                    />
                </Routes>
            </MemoryRouter>
        </ThemeProvider>,
    );
}

describe("HomePage", () => {
    it("loads API collections and filters the folder list from the controlled search field", async () => {
        vi.spyOn(api, "listCollections").mockResolvedValue([
            collection,
            { ...collection, id: "reading", name: "Read later" },
        ]);
        const user = userEvent.setup();
        renderHome();

        expect(
            await screen.findByRole("heading", { name: "Design inspiration" }),
        ).toBeInTheDocument();
        await user.type(screen.getByRole("textbox", { name: "Search your collections" }), "read");
        expect(screen.getByRole("heading", { name: "Read later" })).toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: "Design inspiration" }),
        ).not.toBeInTheDocument();
    });

    it("creates a protected collection, saves its session, and opens its detail page", async () => {
        vi.spyOn(api, "listCollections").mockResolvedValue([]);
        vi.spyOn(api, "createCollection").mockResolvedValue({
            collection,
            accessToken: "new-token",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            deletePassword: "one-time-delete-password",
        });
        const user = userEvent.setup();
        renderHome();

        await user.click(await screen.findByRole("button", { name: "New collection" }));
        await user.type(
            screen.getByRole("textbox", { name: "Collection name" }),
            "Design inspiration",
        );
        await user.type(
            screen.getByRole("textbox", { name: "Description" }),
            "Interfaces and visual ideas",
        );
        await user.type(screen.getByLabelText(/Collection password/), "a strong password");
        await user.click(screen.getByRole("button", { name: "Create collection" }));

        expect(await screen.findByLabelText("Deletion password")).toHaveValue(
            "one-time-delete-password",
        );
        await user.click(screen.getByRole("button", { name: "I saved it — open collection" }));
        expect(await screen.findByText("Collection opened")).toBeInTheDocument();
        await waitFor(() =>
            expect(window.sessionStorage.getItem("keepsake.session.design")).toContain("new-token"),
        );
        expect(api.createCollection).toHaveBeenCalledWith({
            name: "Design inspiration",
            description: "Interfaces and visual ideas",
            visibility: "private",
            password: "a strong password",
        });
    });

    it("creates a public collection without sending an empty password and offers a backup download", async () => {
        vi.spyOn(api, "listCollections").mockResolvedValue([]);
        vi.spyOn(api, "createCollection").mockResolvedValue({
            collection: { ...collection, visibility: "public" },
            accessToken: "creator-token",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            deletePassword: "one-time-delete-password",
        });
        const user = userEvent.setup();
        renderHome();

        await user.click(await screen.findByRole("button", { name: "New collection" }));
        await user.type(screen.getByRole("textbox", { name: "Collection name" }), "Open links");
        await user.click(screen.getByRole("combobox", { name: "Visibility" }));
        await user.click(screen.getByRole("option", { name: "Public — anyone can view" }));
        await user.click(screen.getByRole("button", { name: "Create collection" }));

        expect(await screen.findByLabelText("Deletion password")).toHaveValue(
            "one-time-delete-password",
        );
        expect(api.createCollection).toHaveBeenCalledWith({
            name: "Open links",
            description: "",
            visibility: "public",
        });
        expect(
            screen.getByRole("button", { name: "Download collection + deletion password" }),
        ).toBeInTheDocument();
    });
});
