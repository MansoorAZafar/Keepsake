import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
    {
        path: "/",
        lazy: async () => ({ Component: (await import("../pages/HomePage")).HomePage }),
    },
    {
        path: "/collections/:collectionId",
        lazy: async () => ({
            Component: (await import("../pages/RepositoryDetailPage")).RepositoryDetailPage,
        }),
    },
]);
