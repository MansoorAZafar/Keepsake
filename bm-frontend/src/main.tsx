import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "quill/dist/quill.snow.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "./app/theme";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <RouterProvider router={router} />
        </ThemeProvider>
    </StrictMode>,
);
