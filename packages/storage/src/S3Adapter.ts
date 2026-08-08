import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import type { StorageAdapter } from "./index";

export class S3Adapter implements StorageAdapter {
    private client = new S3Client({
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID!,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
    });

    constructor(private bucket: string) {}

    async put(
        key: string,
        body: string | Uint8Array | Blob,
        opts?: { contentType?: string },
    ) {
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: opts?.contentType,
            }),
        );

        return { url: await this.getUrl(key) };
    }

    async get(key: string) {
        const res = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }),
        );

        return res.Body ? await res.Body.transformToByteArray() : null;
    }

    async delete(key: string) {
        await this.client.send(
            new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
        );
    }

    async getUrl(key: string) {
        return `${process.env.S3_PUBLIC_URL}/${this.bucket}/${key}`;
    }
}
