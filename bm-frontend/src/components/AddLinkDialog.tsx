import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ApiError } from "../lib/api";
import type { CreateLinkInput } from "../types/api";

interface AddLinkDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (link: CreateLinkInput) => Promise<void>;
}

const EMPTY_LINK: CreateLinkInput = { url: "", title: "", note: "" };

export function AddLinkDialog({ open, onClose, onSave }: AddLinkDialogProps) {
    const [link, setLink] = useState<CreateLinkInput>(EMPTY_LINK);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    function closeDialog() {
        if (isSaving) return;
        setLink(EMPTY_LINK);
        setError("");
        onClose();
    }

    async function submitLink(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setIsSaving(true);
        try {
            await onSave({
                url: link.url.trim(),
                title: link.title?.trim() || undefined,
                note: link.note?.trim() || undefined,
            });
            setLink(EMPTY_LINK);
            onClose();
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : "Could not save the link.");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="xs">
            <form onSubmit={(event) => void submitLink(event)}>
                <DialogTitle>Save a link</DialogTitle>
                <DialogContent>
                    <Typography className="section-subtitle" sx={{ mb: 2 }}>
                        The website domain will be detected automatically.
                    </Typography>
                    {error && (
                        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}
                    <Stack spacing={2}>
                        <TextField
                            autoFocus
                            fullWidth
                            required
                            label="URL"
                            name="url"
                            placeholder="github.com/username"
                            autoComplete="url"
                            value={link.url}
                            onChange={(event) =>
                                setLink((current) => ({ ...current, url: event.target.value }))
                            }
                        />
                        <TextField
                            fullWidth
                            label="Title (optional)"
                            name="title"
                            value={link.title}
                            onChange={(event) =>
                                setLink((current) => ({ ...current, title: event.target.value }))
                            }
                        />
                        <TextField
                            fullWidth
                            multiline
                            minRows={2}
                            label="Note (optional)"
                            name="note"
                            value={link.note}
                            onChange={(event) =>
                                setLink((current) => ({ ...current, note: event.target.value }))
                            }
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button color="inherit" disabled={isSaving} onClick={closeDialog}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save link"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
