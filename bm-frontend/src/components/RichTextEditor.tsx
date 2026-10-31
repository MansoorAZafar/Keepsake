import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Quill from "quill";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import type { NoteDelta, UploadedNoteImage } from "../types/api";

interface RichTextEditorProps {
    initialContent?: NoteDelta;
    onChange?: (content: NoteDelta) => void;
    onUploadImage?: (image: File) => Promise<UploadedNoteImage>;
    onRemoveImage?: (imageUrl: string) => Promise<void>;
}

export function RichTextEditor({
    initialContent,
    onChange,
    onUploadImage,
    onRemoveImage,
}: RichTextEditorProps) {
    const hostRef = useRef<HTMLDivElement>(null);
    const onChangeRef = useRef(onChange);
    const uploadRef = useRef(onUploadImage);
    const errorHostRef = useRef<HTMLDivElement>(null);
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
    const selectedImageRef = useRef<HTMLImageElement | null>(null);
    const quillRef = useRef<Quill | null>(null);
    const removeImageRef = useRef(onRemoveImage);

    useEffect(() => {
        onChangeRef.current = onChange;
        uploadRef.current = onUploadImage;
        removeImageRef.current = onRemoveImage;
    }, [onChange, onUploadImage, onRemoveImage]);

    useEffect(() => {
        const hostElement = hostRef.current;
        if (!hostElement) return;
        const quill = new Quill(hostElement, {
            theme: "snow",
            placeholder: "Write your note…",
            modules: {
                toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ["bold", "italic", "underline"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["link", "image"],
                    ["clean"],
                ],
            },
        });
        quillRef.current = quill;
        const generatedToolbar = hostElement.previousElementSibling;
        if (initialContent)
            quill.setContents(initialContent as Parameters<Quill["setContents"]>[0]);

        const handleChange = () => {
            onChangeRef.current?.(quill.getContents() as NoteDelta);
            if (selectedImageRef.current && !hostElement.contains(selectedImageRef.current)) {
                selectedImageRef.current.classList.remove("ql-image-selected");
                selectedImageRef.current = null;
                setSelectedImage(null);
            }
        };
        const handleEditorClick = (event: MouseEvent) => {
            const target = event.target;
            const image =
                target instanceof HTMLImageElement && hostElement.contains(target) ? target : null;
            selectedImageRef.current?.classList.remove("ql-image-selected");
            image?.classList.add("ql-image-selected");
            selectedImageRef.current = image;
            setSelectedImage(image);
        };
        const editor = quill.root;
        editor.addEventListener("click", handleEditorClick);
        quill.on("text-change", handleChange);

        const toolbar = quill.getModule("toolbar") as {
            addHandler: (name: string, handler: () => void) => void;
        };
        toolbar.addHandler("image", () => {
            const range = quill.getSelection(true);
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = "image/jpeg,image/png,image/gif,image/webp";
            fileInput.onchange = async () => {
                const file = fileInput.files?.[0];
                if (!file) return;
                try {
                    if (errorHostRef.current) errorHostRef.current.textContent = "";
                    const uploadImage = uploadRef.current;
                    if (!uploadImage) throw new Error("Image uploads are unavailable.");
                    const uploadedImage = await uploadImage(file);
                    const index = range?.index ?? quill.getLength();
                    quill.insertEmbed(index, "image", uploadedImage.imageUrl, "user");
                    quill.setSelection(index + 1, 0, "silent");
                } catch (cause) {
                    if (errorHostRef.current) {
                        errorHostRef.current.textContent =
                            cause instanceof Error ? cause.message : "Could not upload the image.";
                    }
                }
            };
            fileInput.click();
        });

        return () => {
            quill.off("text-change", handleChange);
            editor.removeEventListener("click", handleEditorClick);
            selectedImageRef.current?.classList.remove("ql-image-selected");
            quill.disable();
            quillRef.current = null;
            if (generatedToolbar?.classList.contains("ql-toolbar")) generatedToolbar.remove();
            hostElement.replaceChildren();
        };
    }, [initialContent]);

    async function removeSelectedImage() {
        const image = selectedImage;
        const hostElement = hostRef.current;
        if (!image || !hostElement) return;
        const quill = quillRef.current;
        const blot = Quill.find(image);
        if (!quill || !blot || blot instanceof Quill) return;
        try {
            await removeImageRef.current?.(image.src);
            const index = quill.getIndex(blot);
            quill.deleteText(index, 1, "user");
            image.classList.remove("ql-image-selected");
            selectedImageRef.current = null;
            setSelectedImage(null);
            quill.focus();
        } catch (cause) {
            if (errorHostRef.current) {
                errorHostRef.current.textContent =
                    cause instanceof Error ? cause.message : "Could not remove the uploaded image.";
            }
        }
    }

    function setSelectedImageWidth(width: string) {
        if (!selectedImage || !quillRef.current) return;
        const blot = Quill.find(selectedImage);
        if (!blot || blot instanceof Quill) return;
        quillRef.current.formatText(quillRef.current.getIndex(blot), 1, "width", width, "user");
    }

    return (
        <Box className="rich-text-field">
            {selectedImage && (
                <Stack
                    className="rich-text-image-actions"
                    direction="row"
                    spacing={1}
                    role="toolbar"
                    aria-label="Selected image actions"
                >
                    <Button
                        size="small"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setSelectedImageWidth("25%")}
                    >
                        Small
                    </Button>
                    <Button
                        size="small"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setSelectedImageWidth("50%")}
                    >
                        Medium
                    </Button>
                    <Button
                        size="small"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setSelectedImageWidth("100%")}
                    >
                        Full width
                    </Button>
                    <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteOutlineRoundedIcon />}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void removeSelectedImage()}
                    >
                        Remove image
                    </Button>
                </Stack>
            )}
            <div ref={hostRef} />
            <div ref={errorHostRef} className="rich-text-error" role="alert" />
        </Box>
    );
}

export function RichTextContent({ content }: { content: NoteDelta }) {
    const lines: Array<{
        content: ReactNode[];
        attributes?: NoteDelta["ops"][number]["attributes"];
    }> = [];
    let currentLine: ReactNode[] = [];

    function flushLine(attributes?: NoteDelta["ops"][number]["attributes"]) {
        lines.push({ content: currentLine, attributes });
        currentLine = [];
    }

    for (const [operationIndex, operation] of content.ops.entries()) {
        if (typeof operation.insert !== "string") {
            currentLine.push(
                <img
                    key={`image-${operationIndex}`}
                    src={operation.insert.image}
                    alt="Image attached to this note"
                    loading="lazy"
                    style={{
                        width:
                            typeof operation.attributes?.width === "string"
                                ? operation.attributes.width
                                : undefined,
                    }}
                />,
            );
            continue;
        }

        const segments = operation.insert.split("\n");
        segments.forEach((segment, segmentIndex) => {
            if (segment) {
                let text: ReactNode = segment;
                const attributes = operation.attributes;
                const link = attributes?.link;
                if (typeof link === "string" && /^(https?:|mailto:)/i.test(link))
                    text = (
                        <a href={link} target="_blank" rel="noreferrer">
                            {text}
                        </a>
                    );
                if (attributes?.code) text = <code>{text}</code>;
                if (attributes?.strike) text = <s>{text}</s>;
                if (attributes?.underline) text = <u>{text}</u>;
                if (attributes?.italic) text = <em>{text}</em>;
                if (attributes?.bold) text = <strong>{text}</strong>;
                currentLine.push(<span key={`${operationIndex}-${segmentIndex}`}>{text}</span>);
            }
            if (segmentIndex < segments.length - 1)
                flushLine(
                    operation.attributes &&
                        Object.keys(operation.attributes).some((key) =>
                            [
                                "header",
                                "list",
                                "blockquote",
                                "align",
                                "indent",
                                "code-block",
                            ].includes(key),
                        )
                        ? operation.attributes
                        : undefined,
                );
        });
    }
    if (currentLine.length > 0) flushLine();

    return (
        <Box className="rich-text-content">
            {lines.map((line, index) => {
                const attributes = line.attributes;
                const indent =
                    typeof attributes?.indent === "number" ? Math.min(attributes.indent, 8) : 0;
                const style = {
                    textAlign:
                        attributes?.align === "center" || attributes?.align === "right"
                            ? attributes.align
                            : undefined,
                    marginLeft: indent ? `${indent * 1.5}rem` : undefined,
                } as const;
                const lineContent = line.content.length > 0 ? line.content : <br />;
                const key = `line-${index}`;
                if (attributes?.header === 1)
                    return (
                        <h2 key={key} style={style}>
                            {lineContent}
                        </h2>
                    );
                if (attributes?.header === 2)
                    return (
                        <h3 key={key} style={style}>
                            {lineContent}
                        </h3>
                    );
                if (attributes?.header === 3)
                    return (
                        <h4 key={key} style={style}>
                            {lineContent}
                        </h4>
                    );
                if (attributes?.blockquote)
                    return (
                        <blockquote key={key} style={style}>
                            {lineContent}
                        </blockquote>
                    );
                if (attributes?.list)
                    return (
                        <div
                            key={key}
                            className="rich-text-list-item"
                            data-list={attributes.list}
                            style={style}
                        >
                            {lineContent}
                        </div>
                    );
                if (attributes?.["code-block"])
                    return (
                        <pre key={key} style={style}>
                            {lineContent}
                        </pre>
                    );
                return (
                    <p key={key} style={style}>
                        {lineContent}
                    </p>
                );
            })}
        </Box>
    );
}
