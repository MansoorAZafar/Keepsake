import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { ApiError } from "../lib/api";
import type { SavedLink } from "../types/api";

interface ConfirmDeleteLinkDialogProps {
    link: SavedLink | null;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export function ConfirmDeleteLinkDialog({
    link,
    onClose,
    onConfirm,
}: ConfirmDeleteLinkDialogProps) {
    const [error, setError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    function close() {
        if (isDeleting) return;
        setError("");
        onClose();
    }

    async function confirm() {
        setError("");
        setIsDeleting(true);
        try {
            await onConfirm();
            onClose();
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : "Could not remove the link.");
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <Dialog
            open={link !== null}
            onClose={close}
            fullWidth
            maxWidth="xs"
            aria-labelledby="delete-link-title"
        >
            <DialogTitle id="delete-link-title">Remove this saved link?</DialogTitle>
            <DialogContent>
                <Typography color="text.secondary">
                    {link
                        ? `“${link.title}” will be permanently removed from this collection.`
                        : "This link will be permanently removed from the collection."}
                </Typography>
                {error && (
                    <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button color="inherit" disabled={isDeleting} onClick={close}>
                    Cancel
                </Button>
                <Button
                    color="error"
                    variant="contained"
                    disabled={isDeleting}
                    onClick={() => void confirm()}
                >
                    {isDeleting ? "Removing…" : "Delete link"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
