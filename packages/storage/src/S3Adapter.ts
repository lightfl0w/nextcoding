import {
    DeleteObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import type { StorageAdapter } from "./index.js";

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`缺少环境变量 ${name}`);
    }
    return value;
}

export class S3Adapter implements StorageAdapter {
    private client = new S3Client({
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
        credentials: {
            accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
        },
    });

    constructor(private bucket: string = requireEnv("S3_BUCKET")) {}

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

    async list(prefix: string) {
        const keys: string[] = [];
        let continuationToken: string | undefined;
        do {
            const res = await this.client.send(
                new ListObjectsV2Command({
                    Bucket: this.bucket,
                    Prefix: prefix,
                    ContinuationToken: continuationToken,
                }),
            );
            for (const obj of res.Contents ?? []) {
                if (obj.Key) {
                    keys.push(obj.Key);
                }
            }
            continuationToken = res.NextContinuationToken;
        } while (continuationToken);
        return keys;
    }
}
