import type { SavedLink } from "../types/api";

export interface DomainGroup {
    domain: string;
    links: SavedLink[];
}

export function getDomain(url: string): string {
    try {
        const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`;
        return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return "Other links";
    }
}

export function filterAndGroupLinks(links: SavedLink[], query: string): DomainGroup[] {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredLinks = links.filter((link) =>
        `${link.title} ${link.url} ${link.note} ${getDomain(link.url)}`
            .toLowerCase()
            .includes(normalizedQuery),
    );
    const grouped = new Map<string, SavedLink[]>();

    for (const link of filteredLinks) {
        const domain = getDomain(link.url);
        const domainLinks = grouped.get(domain) ?? [];
        domainLinks.push(link);
        grouped.set(domain, domainLinks);
    }

    return [...grouped.entries()]
        .sort(([firstDomain], [secondDomain]) => firstDomain.localeCompare(secondDomain))
        .map(([domain, domainLinks]) => ({ domain, links: domainLinks }));
}
