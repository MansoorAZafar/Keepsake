import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { api } from "../lib/api";
import { writeSession } from "../lib/sessions";
import { theme } from "../app/theme";
import { RepositoryDetailPage } from "./RepositoryDetailPage";

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
const links = [
    {
        id: "gh-one",
        collectionId: "design",
        url: "https://github.com/sdda",
        domain: "github.com",
        title: "sdda",
        note: "Profile",
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "gh-two",
        collectionId: "design",
        url: "https://www.github.com/32424",
        domain: "github.com",
        title: "32424",
        note: "Another profile",
        createdAt: "2026-01-02T00:00:00.000Z",
    },
    {
        id: "google",
        collectionId: "design",
        url: "https://google.com/",
        domain: "google.com",
        title: "Google",
        note: "Search",
        createdAt: "2026-01-03T00:00:00.000Z",
    },
];

function renderDetail() {
    return render(
        <ThemeProvider theme={theme}>
            <MemoryRouter initialEntries={["/collections/design"]}>
                <Routes>
                    <Route path="/collections/:collectionId" element={<RepositoryDetailPage />} />
                </Routes>
            </MemoryRouter>
        </ThemeProvider>,
    );
}

describe("RepositoryDetailPage", () => {
    it("asks for a password, unlocks, then groups and searches saved links by domain", async () => {
        vi.spyOn(api, "getCollection").mockResolvedValue(collection);
        vi.spyOn(api, "createSession").mockResolvedValue({
            accessToken: "valid-token",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
        vi.spyOn(api, "listLinks").mockResolvedValue(links);
        const user = userEvent.setup();
        renderDetail();

        expect(await screen.findByText(/Local demo password:/)).toBeInTheDocument();
        await user.type(screen.getByLabelText(/Collection password/), "design-demo");
        await user.click(screen.getByRole("button", { name: "Unlock collection" }));
        expect(await screen.findByRole("heading", { name: "github.com" })).toBeInTheDocument();
        expect(screen.getByText("2 saved links")).toBeInTheDocument();

        await user.type(screen.getByRole("textbox", { name: "Search links or domains" }), "github");
        expect(screen.getByText("sdda")).toBeInTheDocument();
        expect(screen.getByText("32424")).toBeInTheDocument();
        expect(screen.queryByText("google.com")).not.toBeInTheDocument();
        expect(api.createSession).toHaveBeenCalledWith("design", "design-demo");
    });

    it("adds and removes links through the API without changing the grouped layout", async () => {
        writeSession("design", {
            accessToken: "valid-token",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
        vi.spyOn(api, "getCollection").mockResolvedValue(collection);
        vi.spyOn(api, "listLinks").mockResolvedValue(links);
        const newLink = {
            id: "new",
            collectionId: "design",
            url: "https://figma.com/file",
            domain: "figma.com",
            title: "Figma file",
            note: "Mockup",
            createdAt: "2026-01-04T00:00:00.000Z",
        };
        vi.spyOn(api, "createLink").mockResolvedValue(newLink);
        vi.spyOn(api, "deleteLink").mockResolvedValue(undefined);
        const user = userEvent.setup();
        renderDetail();

        await user.click(await screen.findByRole("button", { name: "Add link" }));
        await user.type(screen.getByRole("textbox", { name: "URL" }), "figma.com/file");
        await user.type(screen.getByRole("textbox", { name: "Title (optional)" }), "Figma file");
        await user.type(screen.getByRole("textbox", { name: "Note (optional)" }), "Mockup");
        await user.click(screen.getByRole("button", { name: "Save link" }));

        expect(await screen.findByRole("heading", { name: "figma.com" })).toBeInTheDocument();
        expect(screen.getByText("Figma file")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Remove Figma file" }));
        await waitFor(() =>
            expect(api.deleteLink).toHaveBeenCalledWith("design", "new", "valid-token"),
        );
        expect(screen.queryByRole("heading", { name: "figma.com" })).not.toBeInTheDocument();
    });

    it("shows public links without asking for a password and does not expose edit controls", async () => {
        vi.spyOn(api, "getCollection").mockResolvedValue({ ...collection, visibility: "public" });
        vi.spyOn(api, "listLinks").mockResolvedValue(links);
        renderDetail();

        expect(await screen.findByRole("heading", { name: "github.com" })).toBeInTheDocument();
        expect(screen.getByText("Public · anyone can view")).toBeInTheDocument();
        expect(screen.queryByLabelText("Collection password")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Add link" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Remove sdda" })).not.toBeInTheDocument();
        expect(api.listLinks).toHaveBeenCalledWith("design", undefined);
    });
});
