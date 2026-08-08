import { AlertDialog, Button, Chip, Input, Spinner } from "@heroui/react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { GitCompareArrows, RotateCcw, Upload, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type * as Monaco from "monaco-editor";

import { MonacoWrapper } from "~/components/editor/MonacoWrapper";
import { useMonacoModel } from "~/hooks/useWorkspace";
import { loadMonaco } from "~/lib/editor";

export const Route = createFileRoute("/work/$id/edit")({
    component: EditorPage,
});

interface FileMeta {
    id: string;
    key: string;
    name: string;
    size: number;
    contentType: string | null;
    version: number;
    createdAt: string;
}

interface VersionMeta {
    version: number;
    message: string | null;
    createdAt: string;
}

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`请求失败: ${res.status}`);
    return res.json();
}

function EditorPage() {
    const { id } = useParams({ from: "/work/$id/edit" });
    const { resolvedTheme } = useTheme();
    const theme: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light";

    const [monaco, setMonaco] = useState<typeof Monaco | null>(null);
    const [editor, setEditor] =
        useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [versions, setVersions] = useState<VersionMeta[]>([]);
    const [message, setMessage] = useState("");
    const [diff, setDiff] = useState<{
        version: number;
        original: string;
        modified: string;
    } | null>(null);

    const versionMapRef = useRef(new Map<string, number>());
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeKeyRef = useRef(activeKey);
    activeKeyRef.current = activeKey;

    const {
        data: filesData,
        isLoading,
        mutate: reloadFiles,
    } = useSWR<{ files: FileMeta[] }>(`/api/works/${id}/files`, fetcher);
    const files = filesData?.files ?? [];
    const filesForEditor = files.map((f) => ({ key: f.key, name: f.name }));

    useEffect(() => {
        let mounted = true;
        loadMonaco().then((m) => mounted && setMonaco(m));
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (files.length === 0) return;
        setActiveKey((prev) =>
            prev && files.some((f) => f.key === prev) ? prev : files[0].key,
        );
        for (const f of files) versionMapRef.current.set(f.key, f.version ?? 1);
    }, [files]);

    useEffect(() => {
        fetcher<VersionMeta[]>(`/api/works/${id}/versions`)
            .then(setVersions)
            .catch(() => {});
    }, [id]);

    const loadContent = useCallback(
        async (key: string) => {
            const res = await fetch(
                `/api/works/${id}/files/content?key=${encodeURIComponent(key)}`,
            );
            if (!res.ok) return "";
            return res.text();
        },
        [id],
    );

    const { getContent, getModel } = useMonacoModel(
        monaco,
        editor,
        filesForEditor,
        activeKey,
        loadContent,
    );

    const saveFile = useCallback(
        async (key: string) => {
            const content = getContent(key);
            if (content === null) return;
            const expectedVersion = versionMapRef.current.get(key) ?? 1;
            setSaving(true);
            try {
                const res = await fetch(`/api/works/${id}/files/content`, {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ key, content, expectedVersion }),
                });
                if (res.status === 409) {
                    const data = await res.json();
                    const fresh = await loadContent(key);
                    getModel(key)?.setValue(fresh);
                    versionMapRef.current.set(key, data.currentVersion ?? 1);
                    setDirtyKeys((prev) => {
                        const next = new Set(prev);
                        next.delete(key);
                        return next;
                    });
                    return;
                }
                if (!res.ok) throw new Error(`保存失败 ${res.status}`);
                const data = await res.json();
                versionMapRef.current.set(key, data.version);
                setDirtyKeys((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            } catch (err) {
                console.error(err);
            } finally {
                setSaving(false);
            }
        },
        [id, getContent, getModel, loadContent],
    );

    const handleContentChange = useCallback(() => {
        const key = activeKeyRef.current;
        if (!key) return;
        setDirtyKeys((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveFile(key), 1000);
    }, [saveFile]);

    const handleEditorReady = useCallback(
        (e: Monaco.editor.IStandaloneCodeEditor) => {
            setEditor(e);
            e.onDidChangeModelContent(handleContentChange);
        },
        [handleContentChange],
    );

    const handleEditorDispose = useCallback(() => {
        setEditor(null);
    }, []);

    useEffect(
        () => () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        },
        [],
    );

    const createFile = async () => {
        const name = window.prompt("文件名（如 main.js）");
        if (!name?.trim()) return;
        const res = await fetch(`/api/works/${id}/files`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: name.trim(), content: "" }),
        });
        if (res.status === 409) {
            alert("同名文件已存在");
            return;
        }
        if (!res.ok) return;
        const data = await res.json();
        await reloadFiles();
        setActiveKey(data.key);
        versionMapRef.current.set(data.key, data.version ?? 1);
    };

    const publishVersion = async () => {
        const res = await fetch(`/api/works/${id}/versions`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: message.trim() || null }),
        });
        if (!res.ok) return;
        const v = await res.json();
        setMessage("");
        setVersions((prev) => [
            { version: v.version, message: v.message, createdAt: v.createdAt },
            ...prev,
        ]);
    };

    const restoreVersion = async (version: number) => {
        const res = await fetch(
            `/api/works/${id}/versions/${version}/restore`,
            { method: "POST" },
        );
        if (!res.ok) return;
        window.location.reload();
    };

    const showDiff = async (version: number) => {
        if (!activeKey) return;
        const res = await fetch(`/api/works/${id}/versions/${version}`);
        if (!res.ok) return;
        const snap = await res.json();
        const file = (snap.files ?? []).find(
            (f: { key: string }) => f.key === activeKey,
        );
        if (!file) return;
        setDiff({
            version,
            original: file.content ?? "",
            modified: getContent(activeKey) ?? "",
        });
    };

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex flex-col bg-background">
            <header className="flex items-center gap-2 border-b border-default-200 px-4 py-2 shrink-0">
                <span className="text-sm font-medium">作品编辑</span>
                <Chip size="sm" variant="soft">
                    {files.length} 个文件
                </Chip>
                {saving && (
                    <span className="text-xs text-foreground/50">保存中…</span>
                )}
                <div className="flex-1" />
                {diff && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => setDiff(null)}
                        className="gap-1.5"
                    >
                        <X className="size-3.5" />
                        退出对比
                    </Button>
                )}
                <Input
                    className="w-56"
                    placeholder="版本说明（可选）"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && publishVersion()}
                />
                <Button size="sm" onPress={publishVersion} className="gap-1.5">
                    <Upload className="size-3.5" />
                    发布版本
                </Button>
            </header>

            <div className="flex-1 flex min-h-0">
                <aside className="w-52 border-r border-default-200 overflow-y-auto p-2 flex flex-col gap-1 shrink-0">
                    <div className="flex items-center justify-between px-1 pb-1">
                        <span className="text-xs font-medium text-foreground/60">
                            文件
                        </span>
                        <button
                            onClick={createFile}
                            title="新建文件"
                            className="p-1 rounded-md hover:bg-default-100 text-foreground/60"
                        >
                            <Upload className="size-3.5" />
                        </button>
                    </div>
                    {files.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setActiveKey(f.key)}
                            className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                activeKey === f.key
                                    ? "bg-primary-100 text-primary"
                                    : "hover:bg-default-100 text-foreground/80"
                            }`}
                        >
                            {f.name}
                        </button>
                    ))}
                </aside>

                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center gap-1 border-b border-default-200 px-2 h-9 overflow-x-auto shrink-0">
                        {files.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setActiveKey(f.key)}
                                className={`flex items-center gap-1.5 px-3 h-full text-xs whitespace-nowrap border-b-2 ${
                                    activeKey === f.key
                                        ? "border-primary text-foreground"
                                        : "border-transparent text-foreground/60 hover:text-foreground"
                                }`}
                            >
                                {f.name}
                                {dirtyKeys.has(f.key) && (
                                    <span className="size-1.5 rounded-full bg-warning" />
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 min-h-0">
                        {diff ? (
                            <DiffView
                                monaco={monaco}
                                theme={theme}
                                original={diff.original}
                                modified={diff.modified}
                                label={`v${diff.version}（对比当前草稿）`}
                                onClose={() => setDiff(null)}
                            />
                        ) : (
                            <MonacoWrapper
                                monaco={monaco}
                                theme={theme}
                                onReady={handleEditorReady}
                                onDispose={handleEditorDispose}
                            />
                        )}
                    </div>
                </div>

                <aside className="w-64 border-l border-default-200 overflow-y-auto p-3 flex flex-col gap-2 shrink-0">
                    <div className="text-xs font-medium text-foreground/60">
                        版本历史
                    </div>
                    {versions.map((v) => (
                        <div
                            key={v.version}
                            className="rounded-lg border border-default-200 p-2.5 flex flex-col gap-1.5"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">
                                    v{v.version}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        title="对比当前草稿"
                                        onClick={() => showDiff(v.version)}
                                        className="p-1 rounded-md hover:bg-default-100 text-foreground/60"
                                    >
                                        <GitCompareArrows className="size-3.5" />
                                    </button>
                                    <AlertDialog>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            isIconOnly
                                        >
                                            <RotateCcw className="size-3.5" />
                                        </Button>
                                        <AlertDialog.Backdrop>
                                            <AlertDialog.Container>
                                                <AlertDialog.Dialog className="sm:max-w-[400px]">
                                                    <AlertDialog.CloseTrigger />
                                                    <AlertDialog.Header>
                                                        <AlertDialog.Icon status="danger" />
                                                        <AlertDialog.Heading>
                                                            回滚到 v{v.version}？
                                                        </AlertDialog.Heading>
                                                    </AlertDialog.Header>
                                                    <AlertDialog.Body>
                                                        <p>
                                                            将用 v{v.version}{" "}
                                                            的内容覆盖当前草稿，
                                                            当前未发布的修改会丢失。历史版本不会被删除。
                                                        </p>
                                                    </AlertDialog.Body>
                                                    <AlertDialog.Footer>
                                                        <Button
                                                            slot="close"
                                                            variant="tertiary"
                                                        >
                                                            取消
                                                        </Button>
                                                        <Button
                                                            slot="close"
                                                            variant="danger"
                                                            onPress={() =>
                                                                restoreVersion(
                                                                    v.version,
                                                                )
                                                            }
                                                        >
                                                            确认回滚
                                                        </Button>
                                                    </AlertDialog.Footer>
                                                </AlertDialog.Dialog>
                                            </AlertDialog.Container>
                                        </AlertDialog.Backdrop>
                                    </AlertDialog>
                                </div>
                            </div>
                            <span className="text-xs text-foreground/60 truncate">
                                {v.message ?? "无说明"}
                            </span>
                        </div>
                    ))}
                    {versions.length === 0 && (
                        <p className="text-xs text-foreground/40">
                            还没有版本，点右上角「发布版本」
                        </p>
                    )}
                </aside>
            </div>
        </div>
    );
}

function DiffView({
    monaco,
    theme,
    original,
    modified,
    label,
    onClose,
}: {
    monaco: typeof Monaco | null;
    theme: "light" | "dark";
    original: string;
    modified: string;
    label: string;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!monaco || !ref.current) return;
        const orig = monaco.editor.createModel(
            original,
            "plaintext",
            monaco.Uri.parse("file:///snapshot"),
        );
        const mod = monaco.editor.createModel(
            modified,
            "plaintext",
            monaco.Uri.parse("file:///draft"),
        );
        const diffEditor = monaco.editor.createDiffEditor(ref.current, {
            automaticLayout: true,
            theme: theme === "dark" ? "vs-dark" : "vs",
            readOnly: true,
        });
        diffEditor.setModel({ original: orig, modified: mod });
        return () => {
            diffEditor.dispose();
            orig.dispose();
            mod.dispose();
        };
    }, [monaco, original, modified, theme]);

    return (
        <div className="relative h-full w-full">
            <div ref={ref} className="h-full w-full" />
            <div className="absolute top-2 left-2 z-50 flex items-center gap-1.5">
                <Chip size="sm" variant="soft">
                    {label}
                </Chip>
            </div>
            <button
                onClick={onClose}
                className="absolute top-2 right-2 z-50 p-1.5 rounded-md bg-background border border-default-200 hover:bg-default-100"
                title="关闭对比"
            >
                <X className="size-4" />
            </button>
        </div>
    );
}
