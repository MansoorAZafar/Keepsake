import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
    palette: {
        mode: "light",
        primary: { main: "#7358c8", dark: "#6247b5", contrastText: "#ffffff" },
        background: { default: "#f7f7fa", paper: "#ffffff" },
        text: { primary: "#282733", secondary: "#858493" },
        divider: "#e9e7ee",
    },
    shape: { borderRadius: 10 },
    typography: {
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        button: { textTransform: "none", fontWeight: 600 },
        h1: { fontFamily: "Manrope, 'Segoe UI', sans-serif", fontWeight: 700 },
        h2: { fontFamily: "Manrope, 'Segoe UI', sans-serif", fontWeight: 700 },
        h3: { fontFamily: "Manrope, 'Segoe UI', sans-serif", fontWeight: 700 },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: { borderRadius: 10, paddingInline: 16, boxShadow: "none" },
                contained: { boxShadow: "0 4px 10px #7358c826" },
            },
        },
        MuiTextField: { defaultProps: { size: "small" } },
        MuiOutlinedInput: {
            styleOverrides: { root: { borderRadius: 10, backgroundColor: "#ffffff" } },
        },
        MuiCard: {
            styleOverrides: {
                root: { borderRadius: 13, borderColor: "#e9e7ee", boxShadow: "none" },
            },
        },
        MuiAccordion: {
            styleOverrides: {
                root: {
                    border: "1px solid #e9e7ee",
                    borderRadius: "12px !important",
                    boxShadow: "none",
                    overflow: "hidden",
                    "&::before": { display: "none" },
                    "& + &": { marginTop: 10 },
                },
            },
        },
    },
});
