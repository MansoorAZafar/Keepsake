import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

interface ConfirmActionDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export function ConfirmActionDialog({
    open,
    title,
    description,
    confirmLabel,
    onClose,
    onConfirm,
}: ConfirmActionDialogProps) {
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    function close() {
        if (isSaving) return;
        setError("");
        onClose();
    }

    async function confirm() {
        setError("");
        setIsSaving(true);
        try {
            await onConfirm();
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "The change could not be saved.");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Typography color="text.secondary">{description}</Typography>
                {error && (
                    <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button color="inherit" disabled={isSaving} onClick={close}>
                    Cancel
                </Button>
                <Button
                    color="error"
                    variant="contained"
                    disabled={isSaving}
                    onClick={() => void confirm()}
                >
                    {isSaving ? "Saving…" : confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
