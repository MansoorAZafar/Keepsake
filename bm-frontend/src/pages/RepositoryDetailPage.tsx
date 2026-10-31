import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { api, ApiError } from "../lib/api";
import { filterAndGroupLinks } from "../lib/linkGrouping";
import { readSession, removeSession, writeSession } from "../lib/sessions";
import { DomainGroups } from "../components/DomainGroups";
import { DeleteCollectionDialog } from "../components/DeleteCollectionDialog";
import { AddLinkDialog } from "../components/AddLinkDialog";
import { ConfirmDeleteLinkDialog } from "../components/ConfirmDeleteLinkDialog";
import { EditCollectionDialog } from "../components/EditCollectionDialog";
import type {
    CollectionSession,
    CollectionSummary,
    CreateLinkInput,
    SavedLink,
    UpdateCollectionInput,
} from "../types/api";

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
    const [linkLoadAttempt, setLinkLoadAttempt] = useState(0);
    const [isLoadingCollection, setIsLoadingCollection] = useState(true);
    const [isLoadingLinks, setIsLoadingLinks] = useState(true);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [isAddingLink, setIsAddingLink] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [linkPendingDelete, setLinkPendingDelete] = useState<SavedLink | null>(null);

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
        if (!session && collection?.visibility !== "public") return;
        let isCurrent = true;
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
                    setLinks([]);
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
    }, [collectionId, session, collection?.visibility, linkLoadAttempt]);

    const groups = useMemo(() => filterAndGroupLinks(links, query), [links, query]);

    async function unlockCollection(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setUnlockError("");
        setPageError("");
        setIsUnlocking(true);
        try {
            const createdSession = await api.createSession(collectionId, password);
            writeSession(collectionId, createdSession);
            setIsLoadingLinks(true);
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

    async function saveLink(input: CreateLinkInput) {
        if (!session) throw new Error("Unlock the collection before adding a link.");
        const saved = await api.createLink(collectionId, session.accessToken, input);
        setLinks((current) => [saved, ...current]);
    }

    async function updateCollection(input: UpdateCollectionInput) {
        if (!session) throw new Error("Unlock the collection before editing it.");
        const updated = await api.updateCollection(collectionId, session.accessToken, input);
        setCollection(updated);
    }

    function requestLinkRemoval(linkId: string) {
        setLinkPendingDelete(links.find((link) => link.id === linkId) ?? null);
    }

    async function removeLink() {
        if (!session || !linkPendingDelete) return;
        await api.deleteLink(collectionId, linkPendingDelete.id, session.accessToken);
        setLinks((current) => current.filter((link) => link.id !== linkPendingDelete.id));
    }

    async function lockCollection() {
        if (session)
            await api.closeSession(collectionId, session.accessToken).catch(() => undefined);
        removeSession(collectionId);
        setSession(null);
        setLinks([]);
        setPageError("");
        setIsLoadingLinks(collection?.visibility === "public");
    }

    function retryLinkLoad() {
        setPageError("");
        setIsLoadingLinks(true);
        setLinkLoadAttempt((attempt) => attempt + 1);
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
            <Box component="a" className="skip-link" href="#main-content">
                Skip to content
            </Box>
            <Container
                id="main-content"
                tabIndex={-1}
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
                    <Typography className="welcome-copy" sx={{ maxWidth: "100%" }}>
                        {collection.description}
                    </Typography>
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
                    {session && (
                        <Box sx={{ mt: 2 }}>
                            <Button
                                onClick={() => setIsEditDialogOpen(true)}
                                startIcon={<EditOutlinedIcon />}
                                variant="outlined"
                                size="small"
                                aria-label="Edit collection"
                            >
                                Edit details
                            </Button>
                        </Box>
                    )}
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
                                name="collectionPassword"
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
                                    sx={{
                                        flex: "0 0 auto",
                                        minWidth: "max-content",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    Download JSON
                                </Button>
                                {session && (
                                    <Button
                                        onClick={() => setIsAddingLink(true)}
                                        startIcon={<AddRoundedIcon />}
                                        variant="contained"
                                        size="small"
                                        sx={{
                                            flex: "0 0 auto",
                                            minWidth: "max-content",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        Add link
                                    </Button>
                                )}
                                <IconButton
                                    aria-label="Delete collection"
                                    onClick={() => setIsDeleteDialogOpen(true)}
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
                            <Alert
                                severity="error"
                                sx={{ mb: 2 }}
                                action={
                                    <Button color="inherit" size="small" onClick={retryLinkLoad}>
                                        Retry
                                    </Button>
                                }
                            >
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
                            <DomainGroups
                                groups={groups}
                                onRemoveLink={session ? requestLinkRemoval : undefined}
                            />
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

            <AddLinkDialog
                open={isAddingLink}
                onClose={() => setIsAddingLink(false)}
                onSave={saveLink}
            />
            {isEditDialogOpen && session && (
                <EditCollectionDialog
                    name={collection.name}
                    description={collection.description}
                    onClose={() => setIsEditDialogOpen(false)}
                    onSave={updateCollection}
                />
            )}
            <ConfirmDeleteLinkDialog
                link={linkPendingDelete}
                onClose={() => setLinkPendingDelete(null)}
                onConfirm={removeLink}
            />
            <DeleteCollectionDialog
                collectionId={collectionId}
                collectionName={collection.name}
                open={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onDeleted={navigateHome}
            />
        </Box>
    );
}
