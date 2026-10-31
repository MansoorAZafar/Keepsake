import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NoteDelta, UploadedNoteImage } from "../types/api";
import { CreateNoteDialog } from "./CreateNoteDialog";

vi.mock("./RichTextEditor", () => ({
    RichTextEditor: ({
        onChange,
        onUploadImage,
    }: {
        onChange: (content: NoteDelta) => void;
        onUploadImage?: (image: File) => Promise<UploadedNoteImage>;
    }) => (
        <>
            <button
                type="button"
                onClick={() =>
                    onChange({
                        ops: [
                            { insert: { image: "data:image/png;base64,aW1hZ2U=" } },
                            { insert: "\n" },
                        ],
                    })
                }
            >
                Insert pasted image
            </button>
            <button
                type="button"
                onClick={() =>
                    void onUploadImage?.(new File(["image"], "image.png", { type: "image/png" }))
                }
            >
                Upload toolbar image
            </button>
        </>
    ),
}));

describe("CreateNoteDialog", () => {
    it("uploads pasted base64 images before saving the note Delta", async () => {
        const blob = new Blob(["image bytes"], { type: "image/png" });
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            blob: async () => blob,
        } as Response);
        const onUploadImage = vi
            .fn()
            .mockImplementation(
                async (
                    _file: File,
                    _signal: AbortSignal,
                    onImageKeyIssued: (key: string) => void,
                ) => {
                    const imageKey = "collections/test/images/image.png";
                    onImageKeyIssued(imageKey);
                    return { imageUrl: "https://signed.filebase.test/image.png", imageKey };
                },
            );
        const onSave = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        const onDeleteUploadedImage = vi.fn().mockResolvedValue(undefined);
        const user = userEvent.setup();
        render(
            <CreateNoteDialog
                onClose={onClose}
                onSave={onSave}
                onUploadImage={onUploadImage}
                onDeleteUploadedImage={onDeleteUploadedImage}
            />,
        );

        await user.type(screen.getByRole("textbox", { name: "Note title" }), "Image note");
        fireEvent.click(screen.getByRole("button", { name: "Insert pasted image" }));
        await user.click(screen.getByRole("button", { name: "Save note" }));

        await waitFor(() => expect(onUploadImage).toHaveBeenCalledOnce());
        expect(onUploadImage.mock.calls[0][0]).toBeInstanceOf(File);
        expect(onUploadImage.mock.calls[0][0].type).toBe("image/png");
        expect(onSave).toHaveBeenCalledWith({
            title: "Image note",
            content: {
                ops: [
                    { insert: { image: "https://signed.filebase.test/image.png" } },
                    { insert: "\n" },
                ],
            },
        });
        expect(onClose).toHaveBeenCalledOnce();
        expect(onDeleteUploadedImage).not.toHaveBeenCalled();
    });

    it("aborts active uploads and removes completed uploads when cancelled", async () => {
        const onUploadImage = vi
            .fn()
            .mockImplementation(
                async (
                    _file: File,
                    _signal: AbortSignal,
                    onImageKeyIssued: (key: string) => void,
                ) => {
                    const imageKey = "collections/test/images/cancelled.png";
                    onImageKeyIssued(imageKey);
                    return { imageUrl: "https://signed.filebase.test/cancelled.png", imageKey };
                },
            );
        const onDeleteUploadedImage = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <CreateNoteDialog
                onClose={onClose}
                onSave={vi.fn()}
                onUploadImage={onUploadImage}
                onDeleteUploadedImage={onDeleteUploadedImage}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Upload toolbar image" }));
        await waitFor(() => expect(onUploadImage).toHaveBeenCalledOnce());
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        await waitFor(() =>
            expect(onDeleteUploadedImage).toHaveBeenCalledWith(
                "collections/test/images/cancelled.png",
            ),
        );
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("removes the signed object when an upload is cancelled while in flight", async () => {
        const imageKey = "collections/test/images/in-flight.png";
        const onUploadImage = vi.fn(
            (_file: File, signal: AbortSignal, onImageKeyIssued: (key: string) => void) =>
                new Promise<UploadedNoteImage>((resolve) => {
                    onImageKeyIssued(imageKey);
                    signal.addEventListener(
                        "abort",
                        () => resolve({ imageKey, imageUrl: "https://signed.test/image.png" }),
                        { once: true },
                    );
                }),
        );
        const onDeleteUploadedImage = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <CreateNoteDialog
                onClose={onClose}
                onSave={vi.fn()}
                onUploadImage={onUploadImage}
                onDeleteUploadedImage={onDeleteUploadedImage}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Upload toolbar image" }));
        await waitFor(() => expect(onUploadImage).toHaveBeenCalledOnce());
        const signal = onUploadImage.mock.calls[0][1];
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        await waitFor(() => expect(signal.aborted).toBe(true));
        expect(onDeleteUploadedImage).toHaveBeenCalledWith(imageKey);
        expect(onClose).toHaveBeenCalledOnce();
    });
});
