import type { WorkFile } from "~/lib/api/types";

export type FileTreeNode =
    | { kind: "folder"; path: string; name: string; children: FileTreeNode[] }
    | { kind: "file"; file: WorkFile; name: string };

type FolderNode = Extract<FileTreeNode, { kind: "folder" }>;

export type { FolderNode };

/**
 * 取路径最后一段。
 * @param name - 含路径的文件名。
 * @returns 例如 `"src/main.js"` 变成 `"main.js"`。
 */
export function pathBasename(name: string): string {
    const slash = name.lastIndexOf("/");
    return slash === -1 ? name : name.slice(slash + 1);
}

/**
 * 按文件名中的 `/` 分目录建树。
 * @param files - 文件列表。
 * @returns 目录在前、按名字排序的树。
 */
export function buildFileTree(files: WorkFile[]): FileTreeNode[] {
    const roots: FileTreeNode[] = [];
    const foldersByPath = new Map<string, FolderNode>();

    function folderFor(path: string): FolderNode {
        const existing = foldersByPath.get(path);
        if (existing) {
            return existing;
        }

        const slash = path.lastIndexOf("/");
        const folder: FolderNode = {
            kind: "folder",
            path,
            name: slash === -1 ? path : path.slice(slash + 1),
            children: [],
        };
        foldersByPath.set(path, folder);

        if (slash === -1) {
            roots.push(folder);
        } else {
            folderFor(path.slice(0, slash)).children.push(folder);
        }
        return folder;
    }

    for (const file of files) {
        const slash = file.name.lastIndexOf("/");
        if (slash === -1) {
            roots.push({ kind: "file", file, name: file.name });
        } else {
            folderFor(file.name.slice(0, slash)).children.push({
                kind: "file",
                file,
                name: file.name.slice(slash + 1),
            });
        }
    }

    sortNodes(roots);
    return roots;
}

function sortNodes(nodes: FileTreeNode[]): void {
    nodes.sort(compareNodes);
    for (const node of nodes) {
        if (node.kind === "folder") {
            sortNodes(node.children);
        }
    }
}

function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
    if (a.kind !== b.kind) {
        return a.kind === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
}
