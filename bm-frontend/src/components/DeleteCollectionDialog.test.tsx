import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../app/theme";
import { api, ApiError } from "../lib/api";
import { DeleteCollectionDialog } from "./DeleteCollectionDialog";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
});

function renderDialog() {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    render(
        <ThemeProvider theme={theme}>
            <DeleteCollectionDialog
                collectionId="design"
                collectionName="Design inspiration"
                open
                onClose={onClose}
                onDeleted={onDeleted}
            />
        </ThemeProvider>,
    );
    return { onClose, onDeleted };
}

describe("DeleteCollectionDialog", () => {
    it("keeps Cancel available and enables delete at 16 characters", async () => {
        const user = userEvent.setup();
        renderDialog();

        expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Delete permanently" })).toBeDisabled();
        await user.type(screen.getByLabelText(/One-time deletion password/), "1234567890123456");
        expect(screen.getByRole("button", { name: "Delete permanently" })).toBeEnabled();
    });

    it("keeps the dialog open and shows the API error when deletion fails", async () => {
        vi.spyOn(api, "deleteCollection").mockRejectedValue(
            new ApiError("Incorrect deletion password", 401),
        );
        const user = userEvent.setup();
        const { onDeleted } = renderDialog();

        await user.type(screen.getByLabelText(/One-time deletion password/), "1234567890123456");
        await user.click(screen.getByRole("button", { name: "Delete permanently" }));

        expect(await screen.findByText("Incorrect deletion password")).toBeInTheDocument();
        expect(
            screen.getByRole("dialog", { name: "Delete “Design inspiration”?" }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
        expect(onDeleted).not.toHaveBeenCalled();
    });
});
