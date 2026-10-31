import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RichTextEditor } from "./RichTextEditor";

afterEach(cleanup);

describe("RichTextEditor", () => {
    it("leaves a single Quill toolbar after React Strict Mode remounts its effect", () => {
        const { container, unmount } = render(
            <StrictMode>
                <RichTextEditor initialContent={{ ops: [{ insert: "A note.\n" }] }} />
            </StrictMode>,
        );

        expect(container.querySelectorAll(".ql-toolbar")).toHaveLength(1);
        unmount();
        expect(document.querySelectorAll(".rich-text-field .ql-toolbar")).toHaveLength(0);
    });
});
