import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "./errors/HttpError.js";
import { InMemoryBookmarkRepository } from "./repositories/InMemoryBookmarkRepository.js";
import type { BookmarkRepository } from "./repositories/BookmarkRepository.js";
import { BookmarkService } from "./services/BookmarkService.js";
import { BookmarkController } from "./controllers/BookmarkController.js";
import { createBookmarkRouter } from "./routes/bookmarkRoutes.js";
import { FilebaseStorage } from "./services/FilebaseStorage.js";
import type { NoteImageStorage } from "./services/FilebaseStorage.js";

export function createApp(
    repository: BookmarkRepository = new InMemoryBookmarkRepository(),
    imageStorage: NoteImageStorage | undefined = FilebaseStorage.fromEnvironment(),
) {
    const app = express();
    const service = new BookmarkService(repository, undefined, imageStorage);
    const controller = new BookmarkController(service);

    const allowedOrigins = process.env.FRONTEND_ORIGIN?.split(",") ?? ["http://localhost:5173"];

    app.use(cors({ origin: allowedOrigins }));
    app.use(express.json({ limit: "512kb" }));
    app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
    app.use("/api", createBookmarkRouter(controller));
    app.use((_req, _res, next) => next(new HttpError(404, "Route not found")));

    const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
        if (error instanceof ZodError) {
            res.status(400).json({
                error: "Validation failed",
                details: error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            });
            return;
        }
        if (error instanceof HttpError) {
            res.status(error.statusCode).json({ error: error.message });
            return;
        }
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    };
    app.use(errorHandler);
    return app;
}
