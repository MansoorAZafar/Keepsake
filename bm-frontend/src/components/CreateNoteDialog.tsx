import { useRef, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { CreateNoteInput, NoteDelta, UploadedNoteImage } from "../types/api";
import { RichTextEditor } from "./RichTextEditor";

const DEFAULT_CONTENT: NoteDelta = { ops: [{ insert: "\n" }] };

interface CreateNoteDialogProps {
    onClose: () => void;
    onSave: (input: CreateNoteInput) => Promise<void>;
    onUploadImage: (
        image: File,
        signal: AbortSignal,
        onImageKeyIssued: (imageKey: string) => void,
    ) => Promise<UploadedNoteImage>;
    onDeleteUploadedImage: (imageKey: string) => Promise<void>;
    initialTitle?: string;
    initialContent?: NoteDelta;
    dialogTitle?: string;
    saveLabel?: string;
}

export function CreateNoteDialog({
    onClose,
    onSave,
    onUploadImage,
    onDeleteUploadedImage,
    initialTitle = "",
    initialContent = DEFAULT_CONTENT,
    dialogTitle = "New note",
    saveLabel = "Save note",
}: CreateNoteDialogProps) {
    const [title, setTitle] = useState(initialTitle);
    const [content, setContent] = useState<NoteDelta>(initialContent);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isCleaningUploads, setIsCleaningUploads] = useState(false);
    const pendingImageKeys = useRef(new Map<string, string | undefined>());
    const activeUploads = useRef(new Map<AbortController, Promise<UploadedNoteImage>>());

    function uploadImage(image: File): Promise<UploadedNoteImage> {
        const controller = new AbortController();
        let uploadTask: Promise<UploadedNoteImage>;
        uploadTask = Promise.resolve()
            .then(() =>
                onUploadImage(image, controller.signal, (imageKey) =>
                    pendingImageKeys.current.set(imageKey, undefined),
                ),
            )
            .then((uploaded) => {
                pendingImageKeys.current.set(uploaded.imageKey, uploaded.imageUrl);
                return uploaded;
            })
            .finally(() => activeUploads.current.delete(controller));
        activeUploads.current.set(controller, uploadTask);
        return uploadTask;
    }

    async function removeUploadedImage(imageUrl: string) {
        const uploadedEntry = [...pendingImageKeys.current.entries()].find(
            ([, uploadedUrl]) => uploadedUrl === imageUrl,
        );
        if (!uploadedEntry) return;
        const [imageKey] = uploadedEntry;
        await onDeleteUploadedImage(imageKey);
        pendingImageKeys.current.delete(imageKey);
    }

    async function cancel() {
        if (isSaving || isCleaningUploads) return;
        setIsCleaningUploads(true);
        setError("");
        const active = [...activeUploads.current.entries()];
        active.forEach(([controller]) => controller.abort());
        await Promise.allSettled(active.map(([, task]) => task));
        try {
            await Promise.all(
                [...pendingImageKeys.current.keys()].map((imageKey) =>
                    onDeleteUploadedImage(imageKey),
                ),
            );
            pendingImageKeys.current.clear();
            onClose();
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? `Could not remove the uploaded image. ${cause.message}`
                    : "Could not remove the uploaded image. Try cancelling again.",
            );
        } finally {
            setIsCleaningUploads(false);
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setIsSaving(true);
        try {
            const uploadedContent = await Promise.all(
                content.ops.map(async (operation) => {
                    if (typeof operation.insert === "string") return operation;
                    const imageUrl = operation.insert.image;
                    if (!imageUrl.startsWith("data:image/")) return operation;

                    const response = await fetch(imageUrl);
                    if (!response.ok) throw new Error("Could not read the pasted image.");
                    const blob = await response.blob();
                    const extension = blob.type.split("/")[1] ?? "png";
                    const uploadedImage = await uploadImage(
                        new File([blob], `pasted-image.${extension}`, { type: blob.type }),
                    );
                    return { ...operation, insert: { image: uploadedImage.imageUrl } };
                }),
            );
            const usedImageUrls = new Set(
                uploadedContent.flatMap((operation) =>
                    typeof operation.insert === "string" ? [] : [operation.insert.image],
                ),
            );
            const unusedImageKeys = [...pendingImageKeys.current.entries()]
                .filter(([, imageUrl]) => !imageUrl || !usedImageUrls.has(imageUrl))
                .map(([imageKey]) => imageKey);
            await Promise.all(unusedImageKeys.map((imageKey) => onDeleteUploadedImage(imageKey)));
            unusedImageKeys.forEach((imageKey) => pendingImageKeys.current.delete(imageKey));
            await onSave({ title: title.trim(), content: { ...content, ops: uploadedContent } });
            pendingImageKeys.current.clear();
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save the note.");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog open onClose={() => void cancel()} fullWidth maxWidth="sm">
            <form onSubmit={(event) => void submit(event)}>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogContent>
                    <Typography className="section-subtitle" sx={{ mb: 2 }}>
                        Keep formatted notes and images with this collection.
                    </Typography>
                    {error && (
                        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}
                    <Stack spacing={2}>
                        <TextField
                            autoFocus
                            required
                            fullWidth
                            label="Note title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            slotProps={{ htmlInput: { maxLength: 120 } }}
                        />
                        <RichTextEditor
                            initialContent={initialContent}
                            onChange={setContent}
                            onUploadImage={uploadImage}
                            onRemoveImage={removeUploadedImage}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button
                        color="inherit"
                        disabled={isSaving || isCleaningUploads}
                        onClick={() => void cancel()}
                    >
                        {isCleaningUploads ? "Removing images…" : "Cancel"}
                    </Button>
                    <Button type="submit" variant="contained" disabled={isSaving}>
                        {isSaving ? "Saving…" : saveLabel}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
