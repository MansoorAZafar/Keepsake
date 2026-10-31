import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../errors/HttpError.js";
import { BookmarkService } from "../services/BookmarkService.js";
import type { NoteDelta } from "../types/domain.js";

const nameSchema = z.string().trim().min(1).max(80);
const descriptionSchema = z.string().trim().max(280).optional();
const passwordSchema = z.string().min(8).max(256);
const deletePasswordSchema = z.string().min(16).max(256);
const MAX_NOTE_IMAGE_URL_LENGTH = 4_000;
const MAX_NOTE_IMAGE_BYTES = 5 * 1024 * 1024;

function routeParam(value: string | string[] | undefined): string {
    const param = Array.isArray(value) ? value[0] : value;
    if (!param) throw new HttpError(400, "Missing route parameter");
    return param;
}

function bearerToken(req: Request): string {
    const authorization = req.header("authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new HttpError(401, "A collection session is required");
    return match[1];
}

function optionalBearerToken(req: Request): string | undefined {
    const authorization = req.header("authorization");
    return authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
}

const urlSchema = z
    .string()
    .trim()
    .min(1)
    .transform((raw, context) => {
        const value = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
        try {
            const url = new URL(value);
            if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
                throw new Error();
            return url.toString();
        } catch {
            context.addIssue({
                code: "custom",
                message: "Enter a valid HTTP or HTTPS URL without embedded credentials",
            });
            return z.NEVER;
        }
    });

const noteDeltaSchema = z
    .object({
        ops: z
            .array(
                z
                    .object({
                        insert: z.union([
                            z.string(),
                            z
                                .object({
                                    image: z
                                        .string()
                                        .min(1)
                                        .refine(
                                            (value) => !/^data:image\//i.test(value),
                                            "Embedded image data must be uploaded to storage first",
                                        )
                                        .refine(
                                            (value) => value.length <= MAX_NOTE_IMAGE_URL_LENGTH,
                                            "Image references cannot exceed 4,000 characters",
                                        ),
                                })
                                .strict(),
                        ]),
                        attributes: z
                            .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
                            .optional(),
                    })
                    .strict(),
            )
            .min(1)
            .max(4_000),
    })
    .strict();

export class BookmarkController {
    constructor(private readonly service: BookmarkService) {}

    listCollections = (_req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => res.json({ data: await this.service.listCollections() }));
    getCollection = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () =>
            res.json({
                data: await this.service.getCollection(routeParam(req.params.collectionId)),
            }),
        );
    createCollection = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z
                .discriminatedUnion("visibility", [
                    z
                        .object({
                            name: nameSchema,
                            description: descriptionSchema,
                            visibility: z.literal("public"),
                            password: z.literal("").optional(),
                        })
                        .transform(({ password: _emptyPassword, ...input }) => input),
                    z.object({
                        name: nameSchema,
                        description: descriptionSchema,
                        visibility: z.literal("private"),
                        password: passwordSchema,
                    }),
                ])
                .parse(req.body);
            res.status(201).json({ data: await this.service.createCollection(body) });
        });
    createSession = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z.object({ password: z.string().min(1).max(256) }).parse(req.body);
            res.status(201).json({
                data: await this.service.createSession(
                    routeParam(req.params.collectionId),
                    body.password,
                ),
            });
        });
    closeSession = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            await this.service.closeSession(routeParam(req.params.collectionId), bearerToken(req));
            res.status(204).end();
        });
    updateCollection = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z
                .object({ name: nameSchema.optional(), description: descriptionSchema })
                .strict()
                .refine(
                    (value) => Object.keys(value).length > 0,
                    "Provide at least one field to update",
                )
                .parse(req.body);
            res.json({
                data: await this.service.updateCollection(
                    routeParam(req.params.collectionId),
                    body,
                    bearerToken(req),
                ),
            });
        });
    deleteCollection = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z.object({ deletePassword: deletePasswordSchema }).parse(req.body);
            await this.service.deleteCollection(
                routeParam(req.params.collectionId),
                body.deletePassword,
            );
            res.status(204).end();
        });
    listLinks = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () =>
            res.json({
                data: await this.service.listLinks(
                    routeParam(req.params.collectionId),
                    optionalBearerToken(req),
                ),
            }),
        );
    createLink = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z
                .object({
                    url: urlSchema,
                    title: z.string().trim().max(160).optional(),
                    note: z.string().trim().max(500).optional(),
                })
                .parse(req.body);
            res.status(201).json({
                data: await this.service.createLink(
                    routeParam(req.params.collectionId),
                    body,
                    bearerToken(req),
                ),
            });
        });
    deleteLink = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            await this.service.deleteLink(
                routeParam(req.params.collectionId),
                routeParam(req.params.linkId),
                bearerToken(req),
            );
            res.status(204).end();
        });

    listNotes = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () =>
            res.json({
                data: await this.service.listNotes(
                    routeParam(req.params.collectionId),
                    optionalBearerToken(req),
                ),
            }),
        );
    createNote = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z
                .object({ title: z.string().trim().min(1).max(120), content: noteDeltaSchema })
                .strict()
                .parse(req.body);
            res.status(201).json({
                data: await this.service.createNote(
                    routeParam(req.params.collectionId),
                    { ...body, content: body.content as NoteDelta },
                    bearerToken(req),
                ),
            });
        });
    updateNote = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z
                .object({
                    title: z.string().trim().min(1).max(120).optional(),
                    content: noteDeltaSchema.optional(),
                })
                .strict()
                .refine(
                    (input) => Object.keys(input).length > 0,
                    "Provide at least one field to update",
                )
                .parse(req.body);
            res.json({
                data: await this.service.updateNote(
                    routeParam(req.params.collectionId),
                    routeParam(req.params.noteId),
                    { ...body, ...(body.content ? { content: body.content as NoteDelta } : {}) },
                    bearerToken(req),
                ),
            });
        });
    deleteNote = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            await this.service.deleteNote(
                routeParam(req.params.collectionId),
                routeParam(req.params.noteId),
                bearerToken(req),
            );
            res.status(204).end();
        });
    listNoteComments = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () =>
            res.json({
                data: await this.service.listNoteComments(
                    routeParam(req.params.collectionId),
                    routeParam(req.params.noteId),
                    optionalBearerToken(req),
                ),
            }),
        );
    createNoteComment = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z
                .object({ body: z.string().trim().min(1).max(3_000) })
                .strict()
                .parse(req.body);
            res.status(201).json({
                data: await this.service.createNoteComment(
                    routeParam(req.params.collectionId),
                    routeParam(req.params.noteId),
                    body.body,
                    bearerToken(req),
                ),
            });
        });
    updateNoteComment = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z
                .object({ body: z.string().trim().min(1).max(3_000) })
                .strict()
                .parse(req.body);
            res.json({
                data: await this.service.updateNoteComment(
                    routeParam(req.params.collectionId),
                    routeParam(req.params.noteId),
                    routeParam(req.params.commentId),
                    body.body,
                    bearerToken(req),
                ),
            });
        });
    deleteNoteComment = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            await this.service.deleteNoteComment(
                routeParam(req.params.collectionId),
                routeParam(req.params.noteId),
                routeParam(req.params.commentId),
                bearerToken(req),
            );
            res.status(204).end();
        });
    createNoteImageUpload = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z
                .object({
                    contentType: z.string().min(1).max(100),
                    size: z.number().int().positive().max(MAX_NOTE_IMAGE_BYTES),
                })
                .strict()
                .parse(req.body);
            res.status(201).json({
                data: await this.service.createNoteImageUpload(
                    routeParam(req.params.collectionId),
                    body.contentType,
                    body.size,
                    bearerToken(req),
                ),
            });
        });
    deleteUnusedNoteImage = (req: Request, res: Response, next: NextFunction) =>
        this.run(next, async () => {
            const body = z
                .object({ imageKey: z.string().min(1).max(500) })
                .strict()
                .parse(req.body);
            await this.service.discardUnusedNoteImage(
                routeParam(req.params.collectionId),
                body.imageKey,
                bearerToken(req),
            );
            res.status(204).end();
        });

    private async run(next: NextFunction, action: () => Promise<unknown>) {
        try {
            await action();
        } catch (error) {
            next(error);
        }
    }
}
