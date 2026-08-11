import { getStorage } from "../storage/storageClient.js";
import {
    fromBase64,
    fromText,
    isBinaryPayload,
    toBase64,
    toText,
} from "./content.js";
import type { WorkFileRow } from "./repository.js";

export interface SnapshotFile {
    key: string;
    name: string;
    contentType: string | null;
    content: string;
    encoding?: "base64";
}

export interface Snapshot {
    version: number;
    message: string | null;
    createdAt: number;
    files: SnapshotFile[];
}

export function captureFiles(files: WorkFileRow[]): Promise<SnapshotFile[]> {
    const storage = getStorage();
    return Promise.all(
        files.map(async (file) => {
            const data = await storage.get(file.key);
            return toSnapshotFile(file, data);
        }),
    );
}

export function serializeSnapshot(snapshot: Snapshot): Uint8Array {
    return fromText(JSON.stringify(snapshot));
}

export function parseSnapshot(raw: Uint8Array): Snapshot {
    return JSON.parse(toText(raw)) as Snapshot;
}

export function snapshotFilesOf(snapshot: Snapshot): SnapshotFile[] {
    return Array.isArray(snapshot.files) ? snapshot.files : [];
}

export function decodeSnapshotFile(file: SnapshotFile): Uint8Array {
    const content = typeof file.content === "string" ? file.content : "";
    return file.encoding === "base64" ? fromBase64(content) : fromText(content);
}

function toSnapshotFile(
    file: WorkFileRow,
    data: Uint8Array | null,
): SnapshotFile {
    const base = {
        key: file.key,
        name: file.name,
        contentType: file.contentType,
    };

    if (!data) {
        return { ...base, content: "" };
    }
    if (isBinaryPayload(file.contentType, data)) {
        return { ...base, content: toBase64(data), encoding: "base64" };
    }
    return { ...base, content: toText(data) };
}
