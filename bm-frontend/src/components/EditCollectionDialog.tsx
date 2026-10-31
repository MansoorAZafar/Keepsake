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
import type { UpdateCollectionInput } from "../types/api";

interface EditCollectionDialogProps {
    name: string;
    description: string;
    onClose: () => void;
    onSave: (input: UpdateCollectionInput) => Promise<void>;
}

export function EditCollectionDialog({
    name,
    description,
    onClose,
    onSave,
}: EditCollectionDialogProps) {
    const [form, setForm] = useState<UpdateCollectionInput>({ name, description });
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setIsSaving(true);
        try {
            await onSave({ name: form.name.trim(), description: form.description.trim() });
            onClose();
        } catch (cause) {
            setError(
                cause instanceof ApiError ? cause.message : "Could not update the collection.",
            );
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog
            open
            onClose={() => !isSaving && onClose()}
            fullWidth
            maxWidth="xs"
            aria-labelledby="edit-collection-title"
        >
            <form onSubmit={(event) => void submit(event)}>
                <DialogTitle id="edit-collection-title">Edit collection</DialogTitle>
                <DialogContent>
                    <Typography className="section-subtitle" sx={{ mb: 2 }}>
                        Update the name or description of this collection.
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
                            label="Collection name"
                            name="name"
                            value={form.name}
                            onChange={(event) =>
                                setForm((current) => ({ ...current, name: event.target.value }))
                            }
                            slotProps={{ htmlInput: { maxLength: 80 } }}
                        />
                        <TextField
                            fullWidth
                            label="Description"
                            name="description"
                            value={form.description}
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    description: event.target.value,
                                }))
                            }
                            slotProps={{ htmlInput: { maxLength: 280 } }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button color="inherit" disabled={isSaving} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save changes"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
