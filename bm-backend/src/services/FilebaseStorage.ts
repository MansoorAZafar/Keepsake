import { randomUUID } from "node:crypto";
import {
    DeleteObjectsCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_ENDPOINT = "https://s3.filebase.io";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_UPLOAD_TTL_SECONDS = 5 * 60;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export interface NoteImageStorage {
    createUploadUrl(
        collectionId: string,
        contentType: string,
        size: number,
    ): Promise<{
        uploadUrl: string;
        imageUrl: string;
        imageKey: string;
    }>;
    createReadUrl(key: string): Promise<string>;
    isObjectUrl(value: string): string | undefined;
    deleteImages(keys: string[]): Promise<void>;
    deleteCollectionImages?(collectionId: string): Promise<void>;
}

export class FilebaseStorage implements NoteImageStorage {
    private constructor(
        private readonly client: S3Client,
        private readonly bucket: string,
    ) {}

    static fromEnvironment(): FilebaseStorage | undefined {
        const accessKeyId = process.env.FILEBASE_ACCESS_KEY_ID;
        const secretAccessKey = process.env.FILEBASE_SECRET_ACCESS_KEY;
        const bucket = process.env.FILEBASE_BUCKET;
        if (!accessKeyId && !secretAccessKey && !bucket) return undefined;
        if (!accessKeyId || !secretAccessKey || !bucket)
            throw new Error(
                "FILEBASE_ACCESS_KEY_ID, FILEBASE_SECRET_ACCESS_KEY, and FILEBASE_BUCKET must all be configured",
            );
        return new FilebaseStorage(
            new S3Client({
                endpoint: process.env.FILEBASE_ENDPOINT ?? DEFAULT_ENDPOINT,
                region: process.env.FILEBASE_REGION ?? "auto",
                forcePathStyle: true,
                credentials: { accessKeyId, secretAccessKey },
            }),
            bucket,
        );
    }

    validateImage(contentType: string, size: number): void {
        if (!ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase()))
            throw new Error("Use a JPEG, PNG, GIF, or WebP image.");
        if (size < 1 || size > MAX_IMAGE_BYTES)
            throw new Error("Images must be smaller than 5 MB.");
    }

    async createUploadUrl(collectionId: string, contentType: string, size: number) {
        this.validateImage(contentType, size);
        const extension =
            (
                {
                    "image/jpeg": "jpg",
                    "image/png": "png",
                    "image/gif": "gif",
                    "image/webp": "webp",
                } as Record<string, string>
            )[contentType.toLowerCase()] ?? "bin";
        const key = `collections/${collectionId}/images/${randomUUID()}.${extension}`;
        const [uploadUrl, imageUrl] = await Promise.all([
            getSignedUrl(
                this.client,
                new PutObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                    ContentType: contentType,
                    ContentLength: size,
                }),
                {
                    expiresIn: SIGNED_UPLOAD_TTL_SECONDS,
                    signableHeaders: new Set(["content-type", "content-length"]),
                },
            ),
            this.createReadUrl(key),
        ]);
        return { uploadUrl, imageUrl, imageKey: key };
    }

    async createReadUrl(key: string): Promise<string> {
        return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
            expiresIn: SIGNED_URL_TTL_SECONDS,
        });
    }

    async deleteImages(keys: string[]): Promise<void> {
        const uniqueKeys = [...new Set(keys)];
        for (let index = 0; index < uniqueKeys.length; index += 1000) {
            const deletion = await this.client.send(
                new DeleteObjectsCommand({
                    Bucket: this.bucket,
                    Delete: {
                        Objects: uniqueKeys.slice(index, index + 1000).map((Key) => ({ Key })),
                        Quiet: true,
                    },
                }),
            );
            if (deletion.Errors?.length)
                throw new Error(
                    `Filebase could not delete ${deletion.Errors.length} note image(s)`,
                );
        }
    }

    async deleteCollectionImages(collectionId: string): Promise<void> {
        let continuationToken: string | undefined;
        do {
            const page = await this.client.send(
                new ListObjectsV2Command({
                    Bucket: this.bucket,
                    Prefix: `collections/${collectionId}/images/`,
                    ContinuationToken: continuationToken,
                }),
            );
            const objects = (page.Contents ?? []).flatMap((object) =>
                object.Key ? [{ Key: object.Key }] : [],
            );
            if (objects.length > 0) {
                const deletion = await this.client.send(
                    new DeleteObjectsCommand({
                        Bucket: this.bucket,
                        Delete: { Objects: objects, Quiet: true },
                    }),
                );
                if (deletion.Errors?.length)
                    throw new Error(
                        `Filebase could not delete ${deletion.Errors.length} note image(s)`,
                    );
            }
            continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (continuationToken);
    }

    isObjectUrl(value: string): string | undefined {
        if (value.startsWith("filebase://")) return value.slice("filebase://".length);
        try {
            const url = new URL(value);
            const endpointHost = new URL(process.env.FILEBASE_ENDPOINT ?? DEFAULT_ENDPOINT)
                .hostname;
            if (url.hostname !== endpointHost) return undefined;
            const bucketPrefix = `/${this.bucket}/`;
            if (!url.pathname.startsWith(bucketPrefix)) return undefined;
            const key = decodeURIComponent(url.pathname.slice(bucketPrefix.length));
            return key.startsWith("collections/") ? key : undefined;
        } catch {
            return undefined;
        }
    }

    async close(): Promise<void> {
        this.client.destroy();
    }
}
