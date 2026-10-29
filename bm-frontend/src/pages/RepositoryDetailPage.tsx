import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { api, ApiError } from "../lib/api";
import { filterAndGroupLinks } from "../lib/linkGrouping";
import { readSession, removeSession, writeSession } from "../lib/sessions";
import type {
    CollectionSession,
    CollectionSummary,
    CreateLinkInput,
    SavedLink,
} from "../types/api";

function linkHref(url: string) {
    return /^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}

function formatSavedAt(date: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(date));
}

export function RepositoryDetailPage() {
    const navigate = useNavigate();
    const { collectionId } = useParams<{ collectionId: string }>();
    if (!collectionId)
        return (
            <Container className="not-found" maxWidth="md">
                <Typography variant="h5">Collection ID is missing.</Typography>
                <Button component={RouterLink} to="/">
                    Back to collections
                </Button>
            </Container>
        );
    return (
        <CollectionDetail
            key={collectionId}
            collectionId={collectionId}
            navigateHome={() => navigate("/")}
        />
    );
}

function CollectionDetail({
    collectionId,
    navigateHome,
}: {
    collectionId: string;
    navigateHome: () => void;
}) {
    const [collection, setCollection] = useState<CollectionSummary | null>(null);
    const [session, setSession] = useState<CollectionSession | null>(() =>
        readSession(collectionId),
    );
    const [links, setLinks] = useState<SavedLink[]>([]);
    const [query, setQuery] = useState("");
    const [password, setPassword] = useState("");
    const [unlockError, setUnlockError] = useState("");
    const [pageError, setPageError] = useState("");
    const [isLoadingCollection, setIsLoadingCollection] = useState(true);
    const [isLoadingLinks, setIsLoadingLinks] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [isAddingLink, setIsAddingLink] = useState(false);
    const [isSavingLink, setIsSavingLink] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [linkError, setLinkError] = useState("");
    const [newLink, setNewLink] = useState<CreateLinkInput>({ url: "", title: "", note: "" });

    // @todo, add a duplicate button

    useEffect(() => {
        let isCurrent = true;
        api.getCollection(collectionId)
            .then((result) => {
                if (isCurrent) setCollection(result);
            })
            .catch((error: unknown) => {
                if (isCurrent)
                    setPageError(
                        error instanceof Error ? error.message : "Collection could not be loaded.",
                    );
            })
            .finally(() => {
                if (isCurrent) setIsLoadingCollection(false);
            });
        return () => {
            isCurrent = false;
        };
    }, [collectionId]);

    useEffect(() => {
        if (!session && collection?.visibility !== "public") {
            setLinks([]);
            return;
        }
        let isCurrent = true;
        setIsLoadingLinks(true);
        setPageError("");
        api.listLinks(collectionId, session?.accessToken)
            .then((result) => {
                if (isCurrent) setLinks(result);
            })
            .catch((error: unknown) => {
                if (!isCurrent) return;
                if (
                    error instanceof ApiError &&
                    error.status === 401 &&
                    collection?.visibility === "private"
                ) {
                    removeSession(collectionId);
                    setSession(null);
                    setUnlockError("Your session expired. Enter the collection password again.");
                } else
                    setPageError(
                        error instanceof Error ? error.message : "Links could not be loaded.",
                    );
            })
            .finally(() => {
                if (isCurrent) setIsLoadingLinks(false);
            });
        return () => {
            isCurrent = false;
        };
    }, [collectionId, session, collection?.visibility]);

    const groups = useMemo(() => filterAndGroupLinks(links, query), [links, query]);

    async function unlockCollection(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setUnlockError("");
        setIsUnlocking(true);
        try {
            const createdSession = await api.createSession(collectionId, password);
            writeSession(collectionId, createdSession);
            setSession(createdSession);
            setPassword("");
        } catch (error) {
            setUnlockError(
                error instanceof ApiError
                    ? error.message
                    : "Could not unlock the collection. Check that the API is running.",
            );
        } finally {
            setIsUnlocking(false);
        }
    }

    async function saveLink(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!session) return;
        setIsSavingLink(true);
        setLinkError("");
        try {
            const saved = await api.createLink(collectionId, session.accessToken, {
                url: newLink.url.trim(),
                title: newLink.title?.trim() || undefined,
                note: newLink.note?.trim() || undefined,
            });
            setLinks((current) => [saved, ...current]);
            setNewLink({ url: "", title: "", note: "" });
            setIsAddingLink(false);
        } catch (error) {
            setLinkError(error instanceof ApiError ? error.message : "Could not save the link.");
        } finally {
            setIsSavingLink(false);
        }
    }

    async function removeLink(linkId: string) {
        if (!session) return;
        try {
            await api.deleteLink(collectionId, linkId, session.accessToken);
            setLinks((current) => current.filter((link) => link.id !== linkId));
        } catch (error) {
            setPageError(error instanceof Error ? error.message : "Could not remove the link.");
        }
    }

    async function lockCollection() {
        if (session)
            await api.closeSession(collectionId, session.accessToken).catch(() => undefined);
        removeSession(collectionId);
        setSession(null);
        setLinks([]);
    }

    function downloadJson() {
        const blob = new Blob([JSON.stringify({ collection, links }, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${
            collection?.name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") || "collection"
        }.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    async function deleteCurrentCollection(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setDeleteError("");
        setIsDeleting(true);
        try {
            await api.deleteCollection(collectionId, deletePassword);
            removeSession(collectionId);
            setIsDeleting(false);

            navigateHome();
        } catch (error) {
            setDeleteError(
                error instanceof ApiError ? error.message : "Could not delete the collection.",
            );
        }
    }

    if (isLoadingCollection)
        return (
            <Box className="loading-state detail-loading">
                <CircularProgress size={28} />
                <Typography color="text.secondary">Opening collection…</Typography>
            </Box>
        );
    if (!collection)
        return (
            <Container className="not-found" maxWidth="md">
                <Button
                    component={RouterLink}
                    to="/"
                    variant="text"
                    sx={{ alignSelf: "flex-start" }}
                >
                    ← Back to your library
                </Button>
                <Box className="not-found-icon">?</Box>
                <Typography component="h1" variant="h5">
                    We couldn’t find that collection.
                </Typography>
                <Typography color="text.secondary">
                    {pageError || "It may have moved, or the link may be out of date."}
                </Typography>
                <Button component={RouterLink} to="/" variant="contained">
                    Back to collections
                </Button>
            </Container>
        );

    return (
        <Box component="main" className="library-page">
            <Container
                maxWidth={false}
                sx={{
                    maxWidth: 1000,
                    display: "flex",
                    flexDirection: "column",
                    px: { xs: 2.5, sm: 4, md: 6 },
                }}
            >
                <Box component="header" className="topbar">
                    <Box
                        component={RouterLink}
                        to="/"
                        className="brand"
                        sx={{ display: "flex", alignItems: "center", gap: 1.25 }}
                    >
                        <Avatar
                            variant="rounded"
                            sx={{ bgcolor: "#282733", width: 36, height: 36, borderRadius: 2.5 }}
                        >
                            <AutoStoriesOutlinedIcon fontSize="small" />
                        </Avatar>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                            Keepsake
                        </Typography>
                    </Box>
                    <Button component={RouterLink} to="/" color="inherit" size="small">
                        ← All collections
                    </Button>
                </Box>

                <Box component="section" className="detail-heading">
                    <Box className="detail-folder">
                        <svg viewBox="0 0 124 92" aria-hidden="true">
                            <path d="M7 24a8 8 0 0 1 8-8h34l12 12h48a8 8 0 0 1 8 8v42a8 8 0 0 1-8 8H15a8 8 0 0 1-8-8z" />
                            <path d="M7 37a8 8 0 0 1 8-8h40l12 11h50a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H15a8 8 0 0 1-8-8z" />
                        </svg>
                    </Box>
                    <Typography className="eyebrow">COLLECTION</Typography>
                    <Typography component="h1" className="hero-title">
                        {collection.name}
                    </Typography>
                    <Typography className="welcome-copy" sx={{ maxWidth: "100%" }}>{collection.description}</Typography>
                    <Chip
                        icon={
                            collection.visibility === "private" ? <LockOutlinedIcon /> : undefined
                        }
                        label={
                            collection.visibility === "private"
                                ? "Private · password required"
                                : "Public · anyone can view"
                        }
                        size="small"
                        sx={{ mt: 1 }}
                    />
                </Box>

                {collection.visibility === "private" && !session ? (
                    <Box component="section" className="unlock-panel">
                        <LockOutlinedIcon className="unlock-icon" />
                        <Typography variant="h2">This collection is password protected</Typography>
                        <Typography className="section-subtitle">
                            Enter its password to view and manage saved links.
                        </Typography>
                        {pageError && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {pageError}
                            </Alert>
                        )}
                        <Box
                            component="form"
                            onSubmit={(event) => void unlockCollection(event)}
                            className="unlock-form"
                        >
                            {unlockError && <Alert severity="error">{unlockError}</Alert>}
                            <TextField
                                fullWidth
                                required
                                type="password"
                                label="Collection password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                slotProps={{ htmlInput: { autoComplete: "current-password" } }}
                            />
                            <Button type="submit" variant="contained" disabled={isUnlocking}>
                                {isUnlocking ? "Unlocking…" : "Unlock collection"}
                            </Button>
                        </Box>
                        {collection.id === "design" && (
                            <Typography className="demo-password">
                                Local demo password: <code>design-demo</code>
                            </Typography>
                        )}
                    </Box>
                ) : (
                    <Box
                        component="section"
                        className="saved-section"
                        aria-labelledby="saved-links-title"
                    >
                        <Stack
                            className="section-heading"
                            direction="column"
                            sx={{
                                alignItems: "stretch",
                                gap: 1,
                            }}
                        >
                            <Box>
                                <Typography id="saved-links-title" variant="h2">
                                    Saved links
                                </Typography>
                                <Typography className="section-subtitle">
                                    Browse by website, then open the page you saved.
                                </Typography>
                            </Box>
                            <Stack
                                className="saved-toolbar"
                                direction="row"
                                spacing={1}
                                sx={{ alignItems: "center", flexWrap: "nowrap", maxWidth: "100%" }}
                            >
                                <Chip
                                    label={`${links.length} saved`}
                                    size="small"
                                    sx={{ flex: "0 0 auto" }}
                                />
                                <Button
                                    onClick={downloadJson}
                                    startIcon={<DownloadRoundedIcon />}
                                    variant="outlined"
                                    size="small"
                                    sx={{ flex: "0 0 auto", minWidth: "max-content", whiteSpace: "nowrap" }}
                                >
                                    Download JSON
                                </Button>
                                {session && (
                                    <Button
                                        onClick={() => {
                                            setLinkError("");
                                            setIsAddingLink(true);
                                        }}
                                        startIcon={<AddRoundedIcon />}
                                        variant="contained"
                                        size="small"
                                        sx={{ flex: "0 0 auto", minWidth: "max-content", whiteSpace: "nowrap" }}
                                    >
                                        Add link
                                    </Button>
                                )}
                                <IconButton
                                    aria-label="Delete collection"
                                    onClick={() => setIsDeleting(true)}
                                    title="Delete collection"
                                    sx={{ flex: "0 0 auto" }}
                                >
                                    <DeleteForeverOutlinedIcon />
                                </IconButton>
                                {session && (
                                    <IconButton
                                        aria-label="Lock collection"
                                        onClick={() => void lockCollection()}
                                        title="Lock collection"
                                        sx={{ flex: "0 0 auto" }}
                                    >
                                        <LogoutRoundedIcon />
                                    </IconButton>
                                )}
                            </Stack>
                        </Stack>
                        {pageError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {pageError}
                            </Alert>
                        )}
                        <TextField
                            className="search-field"
                            fullWidth
                            placeholder="Search links or domains"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            slotProps={{
                                htmlInput: { "aria-label": "Search links or domains" },
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchRoundedIcon />
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />
                        {isLoadingLinks ? (
                            <Box className="loading-state">
                                <CircularProgress size={26} />
                                <Typography color="text.secondary">Loading saved links…</Typography>
                            </Box>
                        ) : groups.length > 0 ? (
                            <Stack className="domain-groups" spacing={1.25}>
                                {groups.map((group) => (
                                    <Accordion key={group.domain} defaultExpanded disableGutters>
                                        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                                            <Stack
                                                direction="row"
                                                spacing={1.5}
                                                sx={{ minWidth: 0, flex: 1, alignItems: "center" }}
                                            >
                                                <Avatar className="domain-avatar">
                                                    {group.domain[0].toUpperCase()}
                                                </Avatar>
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography
                                                        component="h3"
                                                        className="domain-title"
                                                        sx={{ m: 0 }}
                                                    >
                                                        {group.domain}
                                                    </Typography>
                                                    <Typography className="domain-subtitle">
                                                        {group.links.length}{" "}
                                                        {group.links.length === 1
                                                            ? "saved link"
                                                            : "saved links"}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </AccordionSummary>
                                        <AccordionDetails className="domain-links">
                                            {group.links.map((link) => (
                                                <Stack
                                                    className="saved-link"
                                                    component="article"
                                                    direction="row"
                                                    spacing={1.75}
                                                    key={link.id}
                                                    sx={{ alignItems: "center" }}
                                                >
                                                    <ArrowOutwardRoundedIcon className="link-number" />
                                                    <Box className="saved-copy">
                                                        <Typography
                                                            component="a"
                                                            href={linkHref(link.url)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="saved-title"
                                                        >
                                                            {link.title}
                                                            <span aria-hidden="true"> ↗</span>
                                                        </Typography>
                                                        <Typography
                                                            component="p"
                                                            className="link-url"
                                                        >
                                                            {link.url}
                                                        </Typography>
                                                        {link.note && (
                                                            <Typography
                                                                component="p"
                                                                className="saved-note"
                                                            >
                                                                {link.note}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    <Typography className="saved-date">
                                                        {formatSavedAt(link.createdAt)}
                                                    </Typography>
                                                    {session && (
                                                        <IconButton
                                                            aria-label={`Remove ${link.title}`}
                                                            onClick={() => void removeLink(link.id)}
                                                            size="small"
                                                        >
                                                            <DeleteOutlineRoundedIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                                </Stack>
                                            ))}
                                        </AccordionDetails>
                                    </Accordion>
                                ))}
                            </Stack>
                        ) : (
                            <Box className="empty-state">
                                <Typography className="empty-symbol">⌕</Typography>
                                <Typography variant="h3">
                                    {links.length === 0
                                        ? "No links saved yet"
                                        : "No matching links"}
                                </Typography>
                                <Typography className="section-subtitle">
                                    {links.length === 0
                                        ? "Add a link to start building this collection."
                                        : "Try another title, URL, or domain."}
                                </Typography>
                                {query && (
                                    <Button onClick={() => setQuery("")}>Clear search</Button>
                                )}
                            </Box>
                        )}
                    </Box>
                )}

                <Stack
                    component="footer"
                    className="page-footer"
                    direction="row"
                    sx={{ justifyContent: "space-between" }}
                >
                    <Typography>Links gathered with care.</Typography>
                    <Typography>
                        Private by design <span aria-hidden="true">✳</span>
                    </Typography>
                </Stack>
            </Container>

            <Dialog
                open={isAddingLink}
                onClose={() => !isSavingLink && setIsAddingLink(false)}
                fullWidth
                maxWidth="xs"
            >
                <Box component="form" onSubmit={(event) => void saveLink(event)}>
                    <DialogTitle>Save a link</DialogTitle>
                    <DialogContent>
                        <Typography className="section-subtitle" sx={{ mb: 2 }}>
                            The website domain will be detected automatically.
                        </Typography>
                        {linkError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {linkError}
                            </Alert>
                        )}
                        <Stack spacing={2}>
                            <TextField
                                autoFocus
                                fullWidth
                                required
                                label="URL"
                                placeholder="github.com/username"
                                value={newLink.url}
                                onChange={(event) =>
                                    setNewLink((current) => ({
                                        ...current,
                                        url: event.target.value,
                                    }))
                                }
                            />
                            <TextField
                                fullWidth
                                label="Title (optional)"
                                value={newLink.title}
                                onChange={(event) =>
                                    setNewLink((current) => ({
                                        ...current,
                                        title: event.target.value,
                                    }))
                                }
                            />
                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                label="Note (optional)"
                                value={newLink.note}
                                onChange={(event) =>
                                    setNewLink((current) => ({
                                        ...current,
                                        note: event.target.value,
                                    }))
                                }
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button
                            color="inherit"
                            disabled={isSavingLink}
                            onClick={() => setIsAddingLink(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" disabled={isSavingLink}>
                            {isSavingLink ? "Saving…" : "Save link"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
            <Dialog
                open={isDeleting}
                onClose={() => !isDeleting && setIsDeleting(false)}
                fullWidth
                maxWidth="xs"
            >
                <Box component="form" onSubmit={(event) => void deleteCurrentCollection(event)}>
                    <DialogTitle>Delete “{collection.name}”?</DialogTitle>
                    <DialogContent>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            This permanently deletes the collection and every saved link inside it.
                        </Alert>
                        {deleteError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {deleteError}
                            </Alert>
                        )}
                        <TextField
                            autoFocus
                            fullWidth
                            required
                            type="password"
                            label="One-time deletion password"
                            value={deletePassword}
                            onChange={(event) => setDeletePassword(event.target.value)}
                            slotProps={{ htmlInput: { autoComplete: "off" } }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button color="inherit" onClick={() => setIsDeleting(false)}>
                            Cancel
                        </Button>
                        <Button
                            color="error"
                            type="submit"
                            variant="contained"
                            disabled={deletePassword.length < 16}
                        >
                            {!isDeleting ? "Deleting…" : "Delete permanently"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
}
