import { Router } from "express";
import { BookmarkController } from "../controllers/BookmarkController.js";

export function createBookmarkRouter(controller: BookmarkController) {
    const router = Router();
    router.get("/collections", controller.listCollections);
    router.post("/collections", controller.createCollection);
    router.get("/collections/:collectionId", controller.getCollection);
    router.patch("/collections/:collectionId", controller.updateCollection);
    router.delete("/collections/:collectionId", controller.deleteCollection);
    router.post("/collections/:collectionId/sessions", controller.createSession);
    router.delete("/collections/:collectionId/sessions/current", controller.closeSession);
    router.get("/collections/:collectionId/links", controller.listLinks);
    router.post("/collections/:collectionId/links", controller.createLink);
    router.delete("/collections/:collectionId/links/:linkId", controller.deleteLink);
    router.get("/collections/:collectionId/notes", controller.listNotes);
    router.post("/collections/:collectionId/notes", controller.createNote);
    router.patch("/collections/:collectionId/notes/:noteId", controller.updateNote);
    router.delete("/collections/:collectionId/notes/:noteId", controller.deleteNote);
    router.get("/collections/:collectionId/notes/:noteId/comments", controller.listNoteComments);
    router.post("/collections/:collectionId/notes/:noteId/comments", controller.createNoteComment);
    router.patch(
        "/collections/:collectionId/notes/:noteId/comments/:commentId",
        controller.updateNoteComment,
    );
    router.delete(
        "/collections/:collectionId/notes/:noteId/comments/:commentId",
        controller.deleteNoteComment,
    );
    router.post("/collections/:collectionId/media/upload-url", controller.createNoteImageUpload);
    router.delete("/collections/:collectionId/media", controller.deleteUnusedNoteImage);
    return router;
}
