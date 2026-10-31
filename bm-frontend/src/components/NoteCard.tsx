import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { RichTextContent } from "./RichTextEditor";
import type { CollectionNote, NoteComment } from "../types/api";

interface NoteCardProps {
    note: CollectionNote;
    canReply: boolean;
    onLoadComments: (noteId: string) => Promise<NoteComment[]>;
    onAddComment: (noteId: string, body: string) => Promise<NoteComment>;
    onUpdateNote: (note: CollectionNote) => void;
    onDeleteNote: (noteId: string) => Promise<void>;
    onUpdateComment: (noteId: string, commentId: string, body: string) => Promise<NoteComment>;
    onDeleteComment: (noteId: string, commentId: string) => Promise<void>;
}

export function NoteCard({
    note,
    canReply,
    onLoadComments,
    onAddComment,
    onUpdateNote,
    onDeleteNote,
    onUpdateComment,
    onDeleteComment,
}: NoteCardProps) {
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [comments, setComments] = useState<NoteComment[] | null>(null);
    const [commentError, setCommentError] = useState("");
    const [reply, setReply] = useState("");
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isPostingReply, setIsPostingReply] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentBody, setEditingCommentBody] = useState("");
    const [isSavingComment, setIsSavingComment] = useState(false);
    const [commentToDelete, setCommentToDelete] = useState<NoteComment | null>(null);
    const [isDeleteNoteOpen, setIsDeleteNoteOpen] = useState(false);

    async function toggleComments() {
        const shouldOpen = !isCommentsOpen;
        setIsCommentsOpen(shouldOpen);
        if (!shouldOpen || comments !== null) return;
        setCommentError("");
        setIsLoadingComments(true);
        try {
            setComments(await onLoadComments(note.id));
        } catch (cause) {
            setCommentError(
                cause instanceof Error ? cause.message : "Comments could not be loaded.",
            );
        } finally {
            setIsLoadingComments(false);
        }
    }

    async function submitReply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!reply.trim()) return;
        setCommentError("");
        setIsPostingReply(true);
        try {
            const created = await onAddComment(note.id, reply.trim());
            setComments((current) => [...(current ?? []), created]);
            setReply("");
        } catch (cause) {
            setCommentError(
                cause instanceof Error ? cause.message : "Your reply could not be saved.",
            );
        } finally {
            setIsPostingReply(false);
        }
    }

    async function saveComment(event: FormEvent<HTMLFormElement>, comment: NoteComment) {
        event.preventDefault();
        if (!editingCommentBody.trim()) return;
        setCommentError("");
        setIsSavingComment(true);
        try {
            const updated = await onUpdateComment(note.id, comment.id, editingCommentBody.trim());
            setComments(
                (current) =>
                    current?.map((item) => (item.id === comment.id ? updated : item)) ?? [],
            );
            setEditingCommentId(null);
            setEditingCommentBody("");
        } catch (cause) {
            setCommentError(
                cause instanceof Error ? cause.message : "Your reply could not be updated.",
            );
        } finally {
            setIsSavingComment(false);
        }
    }

    return (
        <Card component="article" variant="outlined" className="note-card">
            <CardContent className="note-content">
                <Typography component="h3" variant="h6" className="note-title">
                    {note.title}
                </Typography>
                <RichTextContent content={note.content} />
                <Typography className="note-date" color="text.secondary">
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                        new Date(note.updatedAt),
                    )}
                </Typography>
            </CardContent>
            <Divider />
            <CardActions className="note-card-actions">
                <Stack direction={"row"} spacing={0.5}>
                    <Button
                        size="small"
                        startIcon={<ForumOutlinedIcon />}
                        onClick={() => void toggleComments()}
                        aria-expanded={isCommentsOpen}
                        aria-controls={`comments-${note.id}`}
                    >
                        Reply
                    </Button>

                    {canReply && (
                        <Stack direction="row" spacing={0.5}>
                            <Button
                                size="small"
                                startIcon={<EditOutlinedIcon />}
                                onClick={() => onUpdateNote(note)}
                                aria-label={`Edit note ${note.title}`}
                            >
                                Edit
                            </Button>
                            <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteOutlineRoundedIcon />}
                                onClick={() => setIsDeleteNoteOpen(true)}
                                aria-label={`Delete note ${note.title}`}
                            >
                                Delete
                            </Button>
                        </Stack>
                    )}
                </Stack>

                <IconButton
                    size="small"
                    sx={{ ml: "auto !important", flexShrink: 0 }}
                    aria-label={isCommentsOpen ? "Hide comments" : "Show comments"}
                    aria-expanded={isCommentsOpen}
                    aria-controls={`comments-${note.id}`}
                    onClick={() => void toggleComments()}
                >
                    {isCommentsOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                </IconButton>
            </CardActions>
            {isCommentsOpen && (
                <Box id={`comments-${note.id}`} className="note-comments" aria-label="Comments">
                    {commentError && (
                        <Alert severity="error" sx={{ mb: 1 }}>
                            {commentError}
                        </Alert>
                    )}
                    {isLoadingComments ? (
                        <CircularProgress size={20} aria-label="Loading comments" />
                    ) : comments?.length ? (
                        <Stack spacing={1.25} sx={{ mb: 1.5 }}>
                            {comments.map((comment) => (
                                <Box className="note-comment" key={comment.id}>
                                    {editingCommentId === comment.id ? (
                                        <Box
                                            component="form"
                                            onSubmit={(event) => void saveComment(event, comment)}
                                        >
                                            <Stack direction="row" spacing={1}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Edit reply"
                                                    value={editingCommentBody}
                                                    onChange={(event) =>
                                                        setEditingCommentBody(event.target.value)
                                                    }
                                                    slotProps={{ htmlInput: { maxLength: 3000 } }}
                                                />
                                                <Button
                                                    type="submit"
                                                    disabled={
                                                        !editingCommentBody.trim() ||
                                                        isSavingComment
                                                    }
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    color="inherit"
                                                    onClick={() => setEditingCommentId(null)}
                                                    disabled={isSavingComment}
                                                    sx={{ whiteSpace: "nowrap" }}
                                                >
                                                    Cancel
                                                </Button>
                                            </Stack>
                                        </Box>
                                    ) : (
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            sx={{ alignItems: "flex-start" }}
                                        >
                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                <Typography>{comment.body}</Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    {new Intl.DateTimeFormat(undefined, {
                                                        dateStyle: "medium",
                                                        timeStyle: "short",
                                                    }).format(new Date(comment.createdAt))}
                                                </Typography>
                                            </Box>
                                            {canReply && (
                                                <Stack direction="row" spacing={0}>
                                                    <IconButton
                                                        size="small"
                                                        aria-label="Edit reply"
                                                        onClick={() => {
                                                            setEditingCommentId(comment.id);
                                                            setEditingCommentBody(comment.body);
                                                        }}
                                                    >
                                                        <EditOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        aria-label="Delete reply"
                                                        onClick={() => setCommentToDelete(comment)}
                                                    >
                                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                                    </IconButton>
                                                </Stack>
                                            )}
                                        </Stack>
                                    )}
                                </Box>
                            ))}
                        </Stack>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            No replies yet.
                        </Typography>
                    )}
                    {canReply ? (
                        <Box component="form" onSubmit={(event) => void submitReply(event)}>
                            <Stack direction="row" spacing={1}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Write a reply"
                                    value={reply}
                                    onChange={(event) => setReply(event.target.value)}
                                    slotProps={{ htmlInput: { maxLength: 3000 } }}
                                />
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={!reply.trim() || isPostingReply}
                                >
                                    {isPostingReply ? "Sending…" : "Post"}
                                </Button>
                            </Stack>
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            Unlock this collection to reply.
                        </Typography>
                    )}
                </Box>
            )}
            <ConfirmActionDialog
                open={isDeleteNoteOpen}
                title={`Delete “${note.title}”?`}
                description="This permanently removes the note and all of its comments."
                confirmLabel="Delete note"
                onClose={() => setIsDeleteNoteOpen(false)}
                onConfirm={() => onDeleteNote(note.id)}
            />
            <ConfirmActionDialog
                open={commentToDelete !== null}
                title="Delete this reply?"
                description="This permanently removes the reply from this note."
                confirmLabel="Delete reply"
                onClose={() => setCommentToDelete(null)}
                onConfirm={async () => {
                    if (!commentToDelete) return;
                    await onDeleteComment(note.id, commentToDelete.id);
                    setComments(
                        (current) =>
                            current?.filter((item) => item.id !== commentToDelete.id) ?? [],
                    );
                }}
            />
        </Card>
    );
}
