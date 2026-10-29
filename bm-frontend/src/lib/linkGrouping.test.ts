import { describe, expect, it } from "vitest";
import { filterAndGroupLinks, getDomain } from "./linkGrouping";
import type { SavedLink } from "../types/api";

const links: SavedLink[] = [
    {
        id: "1",
        collectionId: "c",
        url: "https://github.com/sdda",
        domain: "github.com",
        title: "sdda",
        note: "Profile",
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "2",
        collectionId: "c",
        url: "https://www.github.com/32424",
        domain: "github.com",
        title: "32424",
        note: "Second profile",
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "3",
        collectionId: "c",
        url: "https://google.com/",
        domain: "google.com",
        title: "Google",
        note: "Search",
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "4",
        collectionId: "c",
        url: "https://figma.com/design/file",
        domain: "figma.com",
        title: "Figma",
        note: "Mockup",
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "5",
        collectionId: "c",
        url: "https://example.com/",
        domain: "example.com",
        title: "Example",
        note: "Reference",
        createdAt: "2026-01-01T00:00:00.000Z",
    },
];

describe("domain grouping", () => {
    it("normalizes schemes, case, and www to a consistent hostname", () => {
        expect(getDomain("github.com/sdda")).toBe("github.com");
        expect(getDomain("https://www.GitHub.com/32424")).toBe("github.com");
        expect(getDomain("not a url")).toBe("Other links");
    });

    it("groups the five sample URLs into four sorted domain sections", () => {
        const groups = filterAndGroupLinks(links, "");
        expect(groups.map((group) => group.domain)).toEqual([
            "example.com",
            "figma.com",
            "github.com",
            "google.com",
        ]);
        expect(
            groups.find((group) => group.domain === "github.com")?.links.map((link) => link.id),
        ).toEqual(["1", "2"]);
    });

    it("filters first, so a search only returns matching domain sections", () => {
        expect(filterAndGroupLinks(links, "github")).toMatchObject([
            { domain: "github.com", links: [{ id: "1" }, { id: "2" }] },
        ]);
        expect(filterAndGroupLinks(links, "second profile").map((group) => group.domain)).toEqual([
            "github.com",
        ]);
        expect(filterAndGroupLinks(links, "nothing")).toEqual([]);
    });
});
