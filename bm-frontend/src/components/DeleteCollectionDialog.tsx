import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { api, ApiError } from "../lib/api";
import { removeSession } from "../lib/sessions";

interface DeleteCollectionDialogProps {
    collectionId: string;
    collectionName: string;
    open: boolean;
    onClose: () => void;
    onDeleted: () => void;
}

export function DeleteCollectionDialog({
    collectionId,
    collectionName,
    open,
    onClose,
    onDeleted,
}: DeleteCollectionDialogProps) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    function closeDialog() {
        setPassword("");
        setError("");
        onClose();
    }

    async function submitDelete(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (password.trim().length < 16) return;

        setError("");
        setIsSubmitting(true);
        try {
            await api.deleteCollection(collectionId, password);
            removeSession(collectionId);
            onDeleted();
        } catch (cause) {
            setError(
                cause instanceof ApiError
                    ? cause.message
                    : "Could not delete this collection. Check that the API is running and try again.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="xs">
            <form onSubmit={(event) => void submitDelete(event)}>
                <DialogTitle>Delete “{collectionName}”?</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        This permanently deletes the collection and every saved link inside it.
                    </Alert>
                    {error && (
                        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}
                    <TextField
                        autoFocus
                        fullWidth
                        required
                        type="password"
                        name="deletePassword"
                        label="One-time deletion password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        helperText="Enter the 16-character password you saved when creating this collection."
                        slotProps={{
                            htmlInput: {
                                minLength: 16,
                                maxLength: 256,
                                autoComplete: "off",
                                spellCheck: false,
                            },
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button color="inherit" onClick={closeDialog}>
                        Cancel
                    </Button>
                    <Button
                        color="error"
                        type="submit"
                        variant="contained"
                        disabled={password.trim().length < 16 || isSubmitting}
                        startIcon={
                            isSubmitting ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : undefined
                        }
                    >
                        {isSubmitting ? "Deleting…" : "Delete permanently"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
