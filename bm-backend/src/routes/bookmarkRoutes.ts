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
    return router;
}
