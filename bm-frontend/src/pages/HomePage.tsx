import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, ApiError } from "../lib/api";
import { buildCollectionBackup } from "../lib/collectionBackup";
import { writeSession } from "../lib/sessions";
import type { CollectionSummary, CreateCollectionInput, CreatedCollection } from "../types/api";

type CollectionColor = "lilac" | "blue" | "peach" | "mint";
const collectionColors: CollectionColor[] = ["lilac", "blue", "peach", "mint"];

function collectionColor(id: string): CollectionColor {
    const stableHash = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return collectionColors[stableHash % collectionColors.length];
}

function formatUpdatedAt(updatedAt: string): string {
    const daysAgo = Math.floor((Date.now() - Date.parse(updatedAt)) / 86_400_000);
    if (!Number.isFinite(daysAgo) || daysAgo < 1) return "Updated today";
    if (daysAgo === 1) return "Updated yesterday";
    if (daysAgo < 7) return `Updated ${daysAgo} days ago`;
    return `Updated ${Math.floor(daysAgo / 7)} weeks ago`;
}

function FolderIllustration({ color }: { color: CollectionColor }) {
    return (
        <Box className={`folder-art folder-${color}`} aria-hidden="true">
            <svg viewBox="0 0 124 92">
                <path
                    className="folder-back"
                    d="M7 24a8 8 0 0 1 8-8h34l12 12h48a8 8 0 0 1 8 8v42a8 8 0 0 1-8 8H15a8 8 0 0 1-8-8z"
                />
                <path
                    className="folder-front"
                    d="M7 37a8 8 0 0 1 8-8h40l12 11h50a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H15a8 8 0 0 1-8-8z"
                />
                <path className="folder-line" d="M14 39h43l9 8h51" />
            </svg>
        </Box>
    );
}

export function HomePage() {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [collections, setCollections] = useState<CollectionSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [newCollection, setNewCollection] = useState<CreateCollectionInput>({
        name: "",
        description: "",
        visibility: "private",
        password: "",
    });
    const [createdSecret, setCreatedSecret] = useState<CreatedCollection | null>(null);

    useEffect(() => {
        let isCurrent = true;
        api.listCollections()
            .then((results) => {
                if (isCurrent) setCollections(results);
            })
            .catch((error: unknown) => {
                if (isCurrent)
                    setLoadError(
                        error instanceof Error ? error.message : "Could not load collections.",
                    );
            })
            .finally(() => {
                if (isCurrent) setIsLoading(false);
            });
        return () => {
            isCurrent = false;
        };
    }, [loadAttempt]);

    // The collection list is derived from the API result and the controlled search query.
    const visibleCollections = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return collections.filter((collection) =>
            `${collection.name} ${collection.description}`.toLowerCase().includes(normalizedQuery),
        );
    }, [collections, query]);

    async function createCollection(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSaving(true);
        setFormError("");
        try {
            const created = await api.createCollection({
                name: newCollection.name.trim(),
                description: newCollection.description.trim(),
                visibility: newCollection.visibility,
                ...(newCollection.visibility === "private"
                    ? { password: newCollection.password }
                    : {}),
            });
            writeSession(created.collection.id, {
                accessToken: created.accessToken,
                expiresAt: created.expiresAt,
            });
            setCollections((current) => [created.collection, ...current]);
            setIsCreating(false);
            setNewCollection({ name: "", description: "", visibility: "private", password: "" });
            setCreatedSecret(created);
        } catch (error) {
            setFormError(
                error instanceof ApiError
                    ? error.message
                    : "Could not create the collection. Check that the API is running.",
            );
        } finally {
            setIsSaving(false);
        }
    }

    function retryCollectionLoad() {
        setLoadError("");
        setIsLoading(true);
        setLoadAttempt((attempt) => attempt + 1);
    }

    function downloadCreationBackup() {
        if (!createdSecret) return;
        const backup = buildCollectionBackup(
            createdSecret.collection,
            createdSecret.deletePassword,
        );
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `${
            createdSecret.collection.name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") || "collection"
        }-backup.json`;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
    }

    return (
        <Box component="main" className="library-page">
            <Box component="a" className="skip-link" href="#main-content">
                Skip to content
            </Box>
            <Container
                id="main-content"
                tabIndex={-1}
                maxWidth={false}
                disableGutters
                sx={{
                    maxWidth: 1000,
                    minHeight: "100vh",
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
                    <Box sx={{ alignItems: "center" }}>
                        <Typography className="topbar-note">Your personal library</Typography>
                    </Box>
                </Box>

                <Stack
                    className="welcome-row"
                    direction={{ xs: "column", sm: "row" }}
                    spacing={3}
                    sx={{
                        alignItems: { xs: "flex-start", sm: "flex-end" },
                        justifyContent: "space-between",
                    }}
                >
                    <Box>
                        <Typography className="eyebrow">YOUR SPACE</Typography>
                        <Typography component="h1" className="hero-title">
                            Everything worth keeping.
                        </Typography>
                        <Typography className="welcome-copy">
                            A home for the links, ideas, and little things you want to find again.
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddRoundedIcon />}
                        onClick={() => {
                            setFormError("");
                            setIsCreating(true);
                        }}
                    >
                        New collection
                    </Button>
                </Stack>

                <Box
                    component="section"
                    className="library-section"
                    aria-labelledby="collection-title"
                >
                    <Stack
                        className="section-heading"
                        direction="row"
                        sx={{ alignItems: "center", justifyContent: "space-between" }}
                    >
                        <Box>
                            <Typography id="collection-title" variant="h2">
                                Your collections
                            </Typography>
                            <Typography className="section-subtitle">
                                Pick up right where you left off.
                            </Typography>
                        </Box>
                        <Typography className="collection-count">
                            {visibleCollections.length}{" "}
                            {visibleCollections.length === 1 ? "collection" : "collections"}
                        </Typography>
                    </Stack>
                    <TextField
                        className="search-field"
                        fullWidth
                        placeholder="Search your collections"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        slotProps={{
                            htmlInput: { "aria-label": "Search your collections" },
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon />
                                    </InputAdornment>
                                ),
                                endAdornment: query ? (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label="Clear search"
                                            onClick={() => setQuery("")}
                                            size="small"
                                        >
                                            <CloseRoundedIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ) : undefined,
                            },
                        }}
                    />

                    {loadError ? (
                        <Alert
                            severity="error"
                            action={
                                <Button color="inherit" size="small" onClick={retryCollectionLoad}>
                                    Retry
                                </Button>
                            }
                        >
                            {loadError}
                        </Alert>
                    ) : isLoading ? (
                        <Box className="loading-state">
                            <CircularProgress size={28} />
                            <Typography color="text.secondary">
                                Loading your collections…
                            </Typography>
                        </Box>
                    ) : visibleCollections.length > 0 ? (
                        <Box className="collection-grid">
                            {visibleCollections.map((collection) => (
                                <Card
                                    className="collection-card"
                                    key={collection.id}
                                    variant="outlined"
                                >
                                    <CardActionArea
                                        component={RouterLink}
                                        to={`/collections/${collection.id}`}
                                        className="collection-action"
                                    >
                                        <Box className="folder-stage">
                                            <Chip
                                                className="item-count"
                                                size="small"
                                                label={`${collection.linkCount} ${collection.linkCount === 1 ? "link" : "links"}`}
                                            />
                                            <FolderIllustration
                                                color={collectionColor(collection.id)}
                                            />
                                        </Box>
                                        <Stack
                                            className="card-copy"
                                            direction="row"
                                            spacing={1}
                                            sx={{
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                            }}
                                        >
                                            <Box>
                                                <Typography
                                                    component="h3"
                                                    className="card-title"
                                                    sx={{ m: 0 }}
                                                >
                                                    {collection.name}
                                                </Typography>
                                                <Typography className="card-description">
                                                    {collection.description ||
                                                        "A place for your favorite links"}
                                                </Typography>
                                            </Box>
                                            <ArrowOutwardRoundedIcon className="card-arrow" />
                                        </Stack>
                                        <Stack
                                            className="card-meta"
                                            direction="row"
                                            sx={{
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                            }}
                                        >
                                            <Typography>
                                                <Box component="span" className="status-dot" />
                                                {formatUpdatedAt(collection.updatedAt)}
                                            </Typography>
                                            <Typography>
                                                Open collection <span aria-hidden="true">→</span>
                                            </Typography>
                                        </Stack>
                                    </CardActionArea>
                                </Card>
                            ))}
                        </Box>
                    ) : (
                        <Box className="empty-state">
                            <Typography className="empty-symbol">⌕</Typography>
                            <Typography variant="h3">
                                {query ? "No collections found" : "Your library is ready"}
                            </Typography>
                            <Typography className="section-subtitle">
                                {query
                                    ? "Try another search, or make a new collection."
                                    : "Create a collection to start gathering your links."}
                            </Typography>
                            <Button
                                onClick={() => {
                                    setQuery("");
                                    setIsCreating(true);
                                }}
                            >
                                Create a collection
                            </Button>
                        </Box>
                    )}
                </Box>

                <Stack
                    component="footer"
                    className="page-footer"
                    direction="row"
                    sx={{ justifyContent: "space-between" }}
                >
                    <Typography>Made for all the things you don’t want to lose.</Typography>
                    <Typography>
                        Private by design <span aria-hidden="true">✳</span>
                    </Typography>
                </Stack>
            </Container>

            <Dialog
                open={isCreating}
                onClose={() => !isSaving && setIsCreating(false)}
                fullWidth
                maxWidth="xs"
            >
                <Box component="form" onSubmit={(event) => void createCollection(event)}>
                    <DialogTitle>New collection</DialogTitle>
                    <DialogContent>
                        <Typography className="section-subtitle" sx={{ mb: 2 }}>
                            Give your saved links a place to live.
                        </Typography>
                        {formError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {formError}
                            </Alert>
                        )}
                        <Stack spacing={2}>
                            <TextField
                                autoFocus
                                fullWidth
                                required
                                label="Collection name"
                                name="name"
                                value={newCollection.name}
                                onChange={(event) =>
                                    setNewCollection((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }))
                                }
                                slotProps={{ htmlInput: { maxLength: 80 } }}
                            />
                            <TextField
                                fullWidth
                                label="Description"
                                name="description"
                                value={newCollection.description}
                                onChange={(event) =>
                                    setNewCollection((current) => ({
                                        ...current,
                                        description: event.target.value,
                                    }))
                                }
                                slotProps={{ htmlInput: { maxLength: 280 } }}
                            />
                            <TextField
                                select
                                fullWidth
                                label="Visibility"
                                name="visibility"
                                value={newCollection.visibility}
                                onChange={(event) =>
                                    setNewCollection((current) => ({
                                        ...current,
                                        visibility: event.target.value as "public" | "private",
                                        password:
                                            event.target.value === "private"
                                                ? current.password
                                                : "",
                                    }))
                                }
                                helperText="Visibility is permanent after creation."
                            >
                                <MenuItem value="private">
                                    Private — password required to view
                                </MenuItem>
                                <MenuItem value="public">Public — anyone can view</MenuItem>
                            </TextField>
                            {newCollection.visibility === "private" && (
                                <TextField
                                    fullWidth
                                    required
                                    type="password"
                                    label="Collection password"
                                    name="password"
                                    value={newCollection.password ?? ""}
                                    onChange={(event) =>
                                        setNewCollection((current) => ({
                                            ...current,
                                            password: event.target.value,
                                        }))
                                    }
                                    helperText="At least 8 characters. Keep it safe; it cannot be recovered."
                                    slotProps={{
                                        htmlInput: {
                                            minLength: 8,
                                            maxLength: 256,
                                            autoComplete: "new-password",
                                        },
                                    }}
                                />
                            )}
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button
                            color="inherit"
                            disabled={isSaving}
                            onClick={() => setIsCreating(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" disabled={isSaving}>
                            {isSaving ? "Creating…" : "Create collection"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
            <Dialog open={Boolean(createdSecret)} onClose={() => undefined} fullWidth maxWidth="sm">
                <DialogTitle>Save your deletion password</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        This password is shown once. You need it to permanently delete “
                        {createdSecret?.collection.name}”. Store it somewhere safe before
                        continuing.
                    </Alert>
                    <TextField
                        fullWidth
                        label="Deletion password"
                        value={createdSecret?.deletePassword ?? ""}
                        slotProps={{
                            htmlInput: { readOnly: true, "aria-label": "Deletion password" },
                        }}
                    />
                    <Typography className="section-subtitle" sx={{ mt: 1.5 }}>
                        The JSON backup includes this deletion password, so store that file
                        securely. The backup does not include your session token.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: "wrap" }}>
                    <Button
                        onClick={downloadCreationBackup}
                        startIcon={<DownloadRoundedIcon />}
                        variant="outlined"
                    >
                        Download collection + deletion password
                    </Button>
                    <Button
                        onClick={() => {
                            if (createdSecret)
                                navigate(`/collections/${createdSecret.collection.id}`);
                            setCreatedSecret(null);
                        }}
                        variant="contained"
                    >
                        I saved it — open collection
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
