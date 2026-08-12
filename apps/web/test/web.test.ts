import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("monaco-editor/editor/editor.worker.js?worker", () => ({
    default: vi.fn(),
}));
vi.mock("monaco-editor/language/css/css.worker.js?worker", () => ({
    default: vi.fn(),
}));
vi.mock("monaco-editor/language/html/html.worker.js?worker", () => ({
    default: vi.fn(),
}));
vi.mock("monaco-editor/language/json/json.worker.js?worker", () => ({
    default: vi.fn(),
}));
vi.mock("monaco-editor/language/typescript/ts.worker.js?worker", () => ({
    default: vi.fn(),
}));

import {
    fetchComments,
    postComment,
    workCommentsPath,
} from "../src/lib/api/comments";
import {
    createWorkFile,
    deleteWorkFile,
    fetchWorkFiles,
    fileContentPath,
    readFileContent,
    saveFileContent,
    workFilesPath,
} from "../src/lib/api/files";
import { followPath, followUser, unfollowUser } from "../src/lib/api/follows";
import {
    getJson,
    getTextOrEmpty,
    HttpError,
    mutateJson,
    postForm,
    sendJson,
} from "../src/lib/api/http";
import {
    fetchNotifications,
    fetchUnreadCount,
    markNotificationsRead,
    notificationsKey,
    notificationsPath,
    unreadCountKey,
} from "../src/lib/api/notifications";
import {
    fetchWorkRemixes,
    fetchWorkSource,
    remixWork,
    workRemixesPath,
    workRemixPath,
    workSourcePath,
} from "../src/lib/api/remixes";
import {
    fetchWorkSpark,
    giveSpark,
    workSparkPath,
} from "../src/lib/api/sparks";
import type { AppNotification, WorkFile } from "../src/lib/api/types";
import {
    fetchMyStats,
    fetchUser,
    fetchUserWorks,
    myStatsPath,
    uploadAvatar,
    userPath,
    userWorksPath,
} from "../src/lib/api/users";
import {
    fetchSnapshot,
    fetchVersions,
    publishVersion,
    restoreVersion,
    workSnapshotPath,
    workVersionsPath,
} from "../src/lib/api/versions";
import {
    createWork,
    fetchMyWorks,
    fetchWork,
    fetchWorks,
    myWorksKey,
    myWorksPath,
    publishWork,
    updateWorkTitle,
    workPath,
    worksPath,
} from "../src/lib/api/works";
import { validateAuthSearch } from "../src/lib/authSearch";
import { LARGE_FILE_BYTES, languageFromName } from "../src/lib/editor";
import { buildFileTree, pathBasename } from "../src/lib/fileTree";
import { formatCount, formatDate } from "../src/lib/format";
import {
    countNotifications,
    formatTimeOfDay,
    groupNotifications,
    notificationText,
} from "../src/lib/notifications";
import {
    detectRuntime,
    formatOutputLines,
    languageLabel,
    toSources,
    unsupportedRuntimeMessage,
} from "../src/lib/run";
import {
    safeRedirect,
    validateEmail,
    validateName,
    validatePassword,
} from "../src/lib/validation";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function makeFile(name: string): WorkFile {
    return {
        id: name,
        key: `works/w/${name}`,
        name,
        size: 1,
        contentType: null,
        version: 1,
        createdAt: "2026-01-01T00:00:00Z",
    };
}

function makeNotification(
    overrides: Partial<AppNotification> = {},
): AppNotification {
    return {
        id: "n1",
        type: "spark",
        read: false,
        createdAt: new Date(2026, 7, 12, 9, 0, 0).toISOString(),
        actor: { id: "u2", name: "李四" },
        work: { id: "w1", title: "我的作品" },
        comment: null,
        ...overrides,
    };
}

beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
    vi.useRealTimers();
});

describe("fileTree", () => {
    describe("pathBasename", () => {
        it("取路径最后一段", () => {
            expect(pathBasename("src/main.js")).toBe("main.js");
            expect(pathBasename("main.js")).toBe("main.js");
        });
    });

    describe("buildFileTree", () => {
        it("空文件列表返回空树", () => {
            expect(buildFileTree([])).toEqual([]);
        });

        it("根目录文件直接成为根节点并按名字排序", () => {
            const tree = buildFileTree([makeFile("b.js"), makeFile("a.js")]);
            expect(tree).toEqual([
                { kind: "file", file: makeFile("a.js"), name: "a.js" },
                { kind: "file", file: makeFile("b.js"), name: "b.js" },
            ]);
        });

        it("按目录聚合嵌套文件", () => {
            const tree = buildFileTree([
                makeFile("src/utils/helper.js"),
                makeFile("src/index.js"),
                makeFile("README.md"),
            ]);
            expect(tree).toMatchObject([
                { kind: "folder", name: "src" },
                { kind: "file", name: "README.md" },
            ]);
            const src = tree[0];
            expect(src).toMatchObject({
                kind: "folder",
                path: "src",
                name: "src",
            });
            if (src.kind === "folder") {
                expect(src.children).toMatchObject([
                    { kind: "folder", name: "utils" },
                    { kind: "file", name: "index.js" },
                ]);
                const utils = src.children[1];
                if (utils.kind === "folder") {
                    expect(utils.children).toMatchObject([
                        { kind: "file", name: "helper.js" },
                    ]);
                }
            }
        });

        it("文件夹排在文件前面", () => {
            const tree = buildFileTree([
                makeFile("a.txt"),
                makeFile("z/b.txt"),
            ]);
            expect(tree[0]).toMatchObject({ kind: "folder", name: "z" });
            expect(tree[1]).toMatchObject({ kind: "file", name: "a.txt" });
        });
    });
});

describe("format", () => {
    describe("formatCount", () => {
        it("不足一万原样输出", () => {
            expect(formatCount(0)).toBe("0");
            expect(formatCount(9999)).toBe("9999");
        });

        it("过万缩写为 x.xw", () => {
            expect(formatCount(10000)).toBe("1.0w");
            expect(formatCount(12345)).toBe("1.2w");
            expect(formatCount(99999)).toBe("10.0w");
        });
    });

    describe("formatDate", () => {
        it("一分钟内显示刚刚", () => {
            vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0));
            expect(formatDate(new Date(2026, 0, 10, 11, 59, 30))).toBe("刚刚");
        });

        it("一小时内显示分钟前", () => {
            vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0));
            expect(formatDate(new Date(2026, 0, 10, 11, 30, 0))).toBe(
                "30 分钟前",
            );
        });

        it("一天内显示小时前", () => {
            vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0));
            expect(formatDate(new Date(2026, 0, 10, 6, 0, 0))).toBe("6 小时前");
        });

        it("一周内显示天前", () => {
            vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0));
            expect(formatDate(new Date(2026, 0, 8, 12, 0, 0))).toBe("2 天前");
        });

        it("超过一周显示日期", () => {
            vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0));
            expect(formatDate(new Date(2026, 0, 1, 0, 0, 0))).toBe(
                "2026-01-01",
            );
        });
    });
});

describe("validation", () => {
    describe("validateEmail", () => {
        it("空邮箱返回提示", () => {
            expect(validateEmail("")).toBe("请输入邮箱");
        });

        it("非法邮箱返回格式提示", () => {
            expect(validateEmail("abc")).toBe("邮箱格式不正确");
            expect(validateEmail("a@b")).toBe("邮箱格式不正确");
            expect(validateEmail("a b@c.com")).toBe("邮箱格式不正确");
        });

        it("合法邮箱返回 null", () => {
            expect(validateEmail("user@example.com")).toBeNull();
        });
    });

    describe("validatePassword", () => {
        it("空密码返回提示", () => {
            expect(validatePassword("")).toBe("请输入密码");
        });

        it("少于 8 位返回长度提示", () => {
            expect(validatePassword("1234567")).toBe("密码至少需要 8 位");
        });

        it("满足长度返回 null", () => {
            expect(validatePassword("12345678")).toBeNull();
        });
    });

    describe("validateName", () => {
        it("空昵称返回提示", () => {
            expect(validateName("")).toBe("请输入昵称");
        });

        it("少于 2 个字符返回长度提示", () => {
            expect(validateName("a")).toBe("昵称至少需要 2 个字符");
        });

        it("合法昵称返回 null", () => {
            expect(validateName("张三")).toBeNull();
        });
    });

    describe("safeRedirect", () => {
        it("站内路径原样返回", () => {
            expect(safeRedirect("/work/1")).toBe("/work/1");
        });

        it("缺失或空串回退根路径", () => {
            expect(safeRedirect(undefined)).toBe("/");
            expect(safeRedirect("")).toBe("/");
        });

        it("防 open redirect：外链与协议相对地址回退根路径", () => {
            expect(safeRedirect("https://evil.com")).toBe("/");
            expect(safeRedirect("//evil.com")).toBe("/");
            expect(safeRedirect("javascript:alert(1)")).toBe("/");
        });
    });
});

describe("notifications", () => {
    describe("notificationText", () => {
        it("spark 文案", () => {
            expect(notificationText(makeNotification())).toBe(
                "李四 给你的作品《我的作品》送了一个火花",
            );
        });

        it("comment 文案携带评论内容", () => {
            const item = makeNotification({
                type: "comment",
                comment: { id: "c1", content: "不错" },
            });
            expect(notificationText(item)).toBe(
                "李四 回复了你在《我的作品》的评论：不错",
            );
        });

        it("remix 文案", () => {
            expect(notificationText(makeNotification({ type: "remix" }))).toBe(
                "李四 二创了你的作品《我的作品》，快去看看吧",
            );
        });

        it("actor 与作品缺失时使用兜底文案", () => {
            const item = makeNotification({ actor: null, work: null });
            expect(notificationText(item)).toBe(
                "某位用户 给你的作品《你的作品》送了一个火花",
            );
        });
    });

    describe("formatTimeOfDay", () => {
        it("补零输出 HH:mm", () => {
            expect(formatTimeOfDay(new Date(2026, 7, 12, 9, 5))).toBe("09:05");
            expect(formatTimeOfDay(new Date(2026, 7, 12, 23, 59))).toBe(
                "23:59",
            );
        });
    });

    describe("countNotifications", () => {
        it("统计总数与各类未读数", () => {
            const counts = countNotifications([
                makeNotification({ id: "1", type: "spark", read: false }),
                makeNotification({ id: "2", type: "spark", read: true }),
                makeNotification({ id: "3", type: "remix", read: false }),
                makeNotification({ id: "4", type: "comment", read: false }),
                makeNotification({ id: "5", type: "comment", read: true }),
            ]);
            expect(counts).toEqual({
                total: 5,
                unread: 3,
                spark: 2,
                remix: 1,
                comment: 2,
                sparkUnread: 1,
                remixUnread: 1,
                commentUnread: 1,
            });
        });

        it("空列表全为 0", () => {
            expect(countNotifications([])).toEqual({
                total: 0,
                unread: 0,
                spark: 0,
                remix: 0,
                comment: 0,
                sparkUnread: 0,
                remixUnread: 0,
                commentUnread: 0,
            });
        });
    });

    describe("groupNotifications", () => {
        it("按 今天/昨天/本周/更早 分组，空组不输出", () => {
            vi.setSystemTime(new Date(2026, 7, 12, 15, 0, 0));
            const groups = groupNotifications([
                makeNotification({
                    id: "1",
                    createdAt: new Date(2026, 7, 12, 9, 0).toISOString(),
                }),
                makeNotification({
                    id: "2",
                    createdAt: new Date(2026, 7, 11, 9, 0).toISOString(),
                }),
                makeNotification({
                    id: "3",
                    createdAt: new Date(2026, 7, 8, 9, 0).toISOString(),
                }),
                makeNotification({
                    id: "4",
                    createdAt: new Date(2026, 7, 1, 9, 0).toISOString(),
                }),
            ]);
            expect(groups.map((g) => g.label)).toEqual([
                "今天",
                "昨天",
                "本周",
                "更早",
            ]);
            expect(groups[0].items.map((i) => i.id)).toEqual(["1"]);
            expect(groups[1].items.map((i) => i.id)).toEqual(["2"]);
            expect(groups[2].items.map((i) => i.id)).toEqual(["3"]);
            expect(groups[3].items.map((i) => i.id)).toEqual(["4"]);
        });

        it("没有对应分组时省略", () => {
            vi.setSystemTime(new Date(2026, 7, 12, 15, 0, 0));
            const groups = groupNotifications([
                makeNotification({
                    id: "1",
                    createdAt: new Date(2026, 7, 12, 9, 0).toISOString(),
                }),
            ]);
            expect(groups.map((g) => g.label)).toEqual(["今天"]);
        });
    });
});

describe("run", () => {
    it("toSources 文件名转为绝对路径源映射", () => {
        expect(
            toSources([
                { name: "index.html", content: "<html>" },
                { name: "main.js", content: "console.log(1)" },
            ]),
        ).toEqual({
            "/index.html": "<html>",
            "/main.js": "console.log(1)",
        });
    });

    describe("detectRuntime", () => {
        it("按入口文件顺序识别", () => {
            expect(detectRuntime(["index.html", "main.js"])).toEqual({
                language: "web",
                entryPoint: "/index.html",
            });
            expect(detectRuntime(["main.py"])).toEqual({
                language: "python",
                entryPoint: "/main.py",
            });
            expect(detectRuntime(["index.js"])).toEqual({
                language: "node",
                entryPoint: "/index.js",
            });
            expect(detectRuntime(["main.go"])).toEqual({
                language: "go",
                entryPoint: "/main.go",
            });
        });

        it("没有入口文件时按扩展名兜底", () => {
            expect(detectRuntime(["utils/helper.py"])).toEqual({
                language: "python",
                entryPoint: "/utils/helper.py",
            });
            expect(detectRuntime(["app.ts"])).toEqual({
                language: "node",
                entryPoint: "/app.ts",
            });
        });

        it("无法识别返回 null", () => {
            expect(detectRuntime(["README.md", "notes.txt"])).toBeNull();
            expect(detectRuntime([])).toBeNull();
        });
    });

    it("languageLabel 返回各运行时中文标签", () => {
        expect(languageLabel("node")).toBe("Node.js");
        expect(languageLabel("web")).toBe("HTML/CSS/JS");
        expect(languageLabel("go")).toBe("Go");
    });

    describe("formatOutputLines", () => {
        it("以 \\r\\n 拼接，stderr 包上 ANSI 红色", () => {
            expect(
                formatOutputLines([
                    { stream: "stdout", text: "ok" },
                    { stream: "stderr", text: "boom" },
                ]),
            ).toBe("ok\r\n\x1b[31mboom\x1b[0m\r\n");
        });

        it("空输出返回单个换行", () => {
            expect(formatOutputLines([])).toBe("\r\n");
        });
    });

    describe("unsupportedRuntimeMessage", () => {
        it("空列表返回空提示", () => {
            expect(unsupportedRuntimeMessage([])).toBe("还没有文件可运行");
            expect(unsupportedRuntimeMessage([], "自定义提示")).toBe(
                "自定义提示",
            );
        });

        it("单个文件省略「等文件」", () => {
            expect(unsupportedRuntimeMessage(["main.css"])).toBe(
                "「main.css」暂不支持在线运行，请使用 Node.js(.js/.ts)、Python(.py)、HTML(.html)、C#(.cs)、Java(.java)、PHP(.php)、Dart(.dart)、Go(.go)",
            );
        });

        it("多个文件带「等文件」", () => {
            const message = unsupportedRuntimeMessage(["a.css", "b.css"]);
            expect(message.startsWith("「a.css」等文件暂不支持在线运行")).toBe(
                true,
            );
        });
    });
});

describe("editor", () => {
    describe("languageFromName", () => {
        it("识别常见扩展名", () => {
            expect(languageFromName("main.js")).toBe("javascript");
            expect(languageFromName("main.ts")).toBe("typescript");
            expect(languageFromName("App.tsx")).toBe("typescript");
            expect(languageFromName("style.css")).toBe("css");
            expect(languageFromName("index.html")).toBe("html");
            expect(languageFromName("data.json")).toBe("json");
            expect(languageFromName("README.md")).toBe("markdown");
            expect(languageFromName("main.py")).toBe("python");
            expect(languageFromName("main.go")).toBe("go");
        });

        it("扩展名大小写不敏感", () => {
            expect(languageFromName("MAIN.JS")).toBe("javascript");
            expect(languageFromName("App.TSX")).toBe("typescript");
        });

        it("未识别与无扩展名回退 plaintext", () => {
            expect(languageFromName("LICENSE")).toBe("plaintext");
            expect(languageFromName("data.xyz")).toBe("plaintext");
        });
    });

    it("大文件阈值", () => {
        expect(LARGE_FILE_BYTES).toBe(512 * 1024);
    });
});

describe("authSearch", () => {
    it("合法 mode 原样保留", () => {
        for (const mode of ["login", "register", "forgot"]) {
            expect(validateAuthSearch({ mode }).mode).toBe(mode);
        }
    });

    it("非法或缺失 mode 回退 login", () => {
        expect(validateAuthSearch({ mode: "hack" }).mode).toBe("login");
        expect(validateAuthSearch({}).mode).toBe("login");
        expect(validateAuthSearch({ mode: 123 }).mode).toBe("login");
    });

    it("redirect 透传", () => {
        expect(validateAuthSearch({ redirect: "/work/1" }).redirect).toBe(
            "/work/1",
        );
        expect(validateAuthSearch({}).redirect).toBeUndefined();
    });
});

describe("api/http", () => {
    describe("HttpError", () => {
        it("携带状态码与动作信息", () => {
            const err = new HttpError(404, "加载失败");
            expect(err).toBeInstanceOf(Error);
            expect(err.status).toBe(404);
            expect(err.message).toBe("加载失败: 404");
            expect(err.name).toBe("HttpError");
        });

        it("默认动作文案为请求失败", () => {
            expect(new HttpError(500).message).toBe("请求失败: 500");
        });
    });

    describe("sendJson", () => {
        it("无 body 时不带请求体", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValue(new Response(null));
            await sendJson("/api/x", "POST");
            expect(mockFetch).toHaveBeenCalledWith("/api/x", {
                method: "POST",
            });
        });

        it("带 body 时序列化 JSON 并设置请求头", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValue(new Response(null));
            await sendJson("/api/x", "PUT", { a: 1 });
            expect(mockFetch).toHaveBeenCalledWith("/api/x", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ a: 1 }),
            });
        });
    });

    describe("getJson", () => {
        it("成功解析 JSON", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));
            await expect(getJson<{ ok: boolean }>("/api/x")).resolves.toEqual({
                ok: true,
            });
        });

        it("非 2xx 抛出 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ error: "x" }, 500),
            );
            await expect(getJson("/api/x")).rejects.toThrow("请求失败: 500");
        });
    });

    describe("getTextOrEmpty", () => {
        it("成功返回文本", async () => {
            vi.mocked(fetch).mockResolvedValue(new Response("hi"));
            await expect(getTextOrEmpty("/api/x")).resolves.toBe("hi");
        });

        it("失败返回空串", async () => {
            vi.mocked(fetch).mockResolvedValue(
                new Response("err", { status: 404 }),
            );
            await expect(getTextOrEmpty("/api/x")).resolves.toBe("");
        });
    });

    describe("mutateJson", () => {
        it("成功解析并透传数据", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: 1 }));
            await expect(
                mutateJson("/api/x", "PATCH", { t: 1 }, "保存"),
            ).resolves.toEqual({ id: 1 });
        });

        it("失败抛出带动作的 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 400));
            await expect(
                mutateJson("/api/x", "POST", undefined, "保存"),
            ).rejects.toMatchObject({ status: 400, message: "保存: 400" });
        });
    });

    describe("postForm", () => {
        it("POST FormData", async () => {
            const form = new FormData();
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValue(new Response(null));
            await postForm("/api/x", form);
            expect(mockFetch).toHaveBeenCalledWith("/api/x", {
                method: "POST",
                body: form,
            });
        });
    });
});

describe("api/works", () => {
    describe("路径构造", () => {
        it("worksPath 拼接 sort/limit 并转义 keyword", () => {
            expect(worksPath("latest", 10)).toBe(
                "/api/works?sort=latest&limit=10",
            );
            expect(worksPath("popular", 20, "js demo")).toBe(
                "/api/works?sort=popular&limit=20&q=js%20demo",
            );
        });

        it("workPath / myWorksPath / myWorksKey", () => {
            expect(workPath("w1")).toBe("/api/works/w1");
            expect(myWorksPath()).toBe("/api/works/mine");
            expect(myWorksKey("u1")).toEqual(["my-works", "u1"]);
        });
    });

    describe("fetchWorks / fetchWork / fetchMyWorks", () => {
        it("fetchWorks 请求传入的路径", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
            await fetchWorks("/api/works?sort=latest&limit=10");
            expect(fetch).toHaveBeenCalledWith(
                "/api/works?sort=latest&limit=10",
            );
        });

        it("fetchWork 返回详情", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: "w1" }));
            await expect(fetchWork("/api/works/w1")).resolves.toEqual({
                id: "w1",
            });
        });

        it("fetchMyWorks 请求我的作品接口", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
            await fetchMyWorks();
            expect(fetch).toHaveBeenCalledWith("/api/works/mine");
        });
    });

    describe("createWork", () => {
        it("创建成功返回新作品 id", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ id: "w-new" }, 201),
            );
            await expect(createWork("标题")).resolves.toEqual({ id: "w-new" });
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works");
            expect(init.method).toBe("POST");
        });

        it("未登录抛出请先登录", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 401));
            await expect(createWork("标题")).rejects.toThrow("请先登录");
        });

        it("其他失败抛出创建失败", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 400));
            await expect(createWork("标题")).rejects.toThrow("创建失败: 400");
        });
    });

    describe("updateWorkTitle", () => {
        it("PATCH 提交标题", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ id: "w1", title: "新标题" }),
            );
            await updateWorkTitle("w1", "新标题");
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works/w1");
            expect(init.method).toBe("PATCH");
            expect(JSON.parse(String(init.body))).toEqual({ title: "新标题" });
        });
    });

    describe("publishWork", () => {
        it("POST 到发布接口", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ ok: true, id: "w1", status: "published" }),
            );
            await expect(publishWork("w1")).resolves.toEqual({
                ok: true,
                id: "w1",
                status: "published",
            });
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works/w1/publish");
            expect(init.method).toBe("POST");
        });

        it("失败抛出发布失败", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 400));
            await expect(publishWork("w1")).rejects.toBeInstanceOf(HttpError);
        });
    });
});

describe("api/files", () => {
    describe("路径构造", () => {
        it("workFilesPath / fileContentPath 转义 key", () => {
            expect(workFilesPath("w1")).toBe("/api/works/w1/files");
            expect(fileContentPath("w1", "works/w1/a b.js")).toBe(
                "/api/works/w1/files/content?key=works%2Fw1%2Fa%20b.js",
            );
        });
    });

    describe("fetchWorkFiles / readFileContent", () => {
        it("fetchWorkFiles 返回文件列表", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ files: [] }));
            await expect(
                fetchWorkFiles("/api/works/w1/files"),
            ).resolves.toEqual({ files: [] });
        });

        it("readFileContent 成功返回文本", async () => {
            vi.mocked(fetch).mockResolvedValue(new Response("hello"));
            await expect(readFileContent("w1", "k")).resolves.toBe("hello");
        });

        it("readFileContent 失败返回空串", async () => {
            vi.mocked(fetch).mockResolvedValue(
                new Response("", { status: 404 }),
            );
            await expect(readFileContent("w1", "k")).resolves.toBe("");
        });
    });

    describe("createWorkFile", () => {
        it("创建成功返回 created", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ key: "works/w1/a.js", version: 1 }, 201),
            );
            await expect(createWorkFile("w1", "a.js")).resolves.toEqual({
                outcome: "created",
                key: "works/w1/a.js",
                version: 1,
            });
        });

        it("同名文件返回 duplicate", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 409));
            await expect(createWorkFile("w1", "a.js")).resolves.toEqual({
                outcome: "duplicate",
            });
        });

        it("其他失败返回 rejected", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 400));
            await expect(createWorkFile("w1", "a.js")).resolves.toEqual({
                outcome: "rejected",
            });
        });
    });

    describe("saveFileContent", () => {
        it("保存成功返回 saved", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ version: 3 }));
            await expect(saveFileContent("w1", "k", "hi", 2)).resolves.toEqual({
                outcome: "saved",
                version: 3,
            });
        });

        it("版本冲突返回 conflict 与当前版本", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ currentVersion: 5 }, 409),
            );
            await expect(saveFileContent("w1", "k", "hi", 2)).resolves.toEqual({
                outcome: "conflict",
                currentVersion: 5,
            });
        });

        it("冲突响应缺少版本号时兜底 1", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 409));
            await expect(saveFileContent("w1", "k", "hi", 2)).resolves.toEqual({
                outcome: "conflict",
                currentVersion: 1,
            });
        });

        it("其他失败抛出 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
            await expect(
                saveFileContent("w1", "k", "hi", 2),
            ).rejects.toBeInstanceOf(HttpError);
        });
    });

    describe("deleteWorkFile", () => {
        it("DELETE 携带 key 查询参数", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));
            await deleteWorkFile("w1", "works/w1/a.js");
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/works/w1/files?key=works%2Fw1%2Fa.js");
            expect(init.method).toBe("DELETE");
        });
    });
});

describe("api/users", () => {
    describe("fetchMyStats", () => {
        it("请求统计接口", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ givenSparks: 1, receivedSparks: 2 }),
            );
            await expect(fetchMyStats()).resolves.toEqual({
                givenSparks: 1,
                receivedSparks: 2,
            });
            expect(fetch).toHaveBeenCalledWith(myStatsPath());
        });
    });

    describe("fetchUser", () => {
        const profile = {
            id: "u2",
            name: "李四",
            image: null,
            bio: "你好",
            createdAt: "2026-01-01T00:00:00.000Z",
            followers: 3,
            following: 2,
            isFollowedByMe: false,
        };

        it("userPath 拼接公开资料路径", () => {
            expect(userPath("u2")).toBe("/api/users/u2");
        });

        it("获取公开资料", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse(profile));
            await expect(fetchUser("u2")).resolves.toEqual(profile);
            expect(fetch).toHaveBeenCalledWith("/api/users/u2");
        });

        it("用户不存在时抛 404 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ error: "用户不存在" }, 404),
            );
            await expect(fetchUser("ghost")).rejects.toMatchObject({
                status: 404,
                message: "请求失败: 404",
            });
        });
    });

    describe("fetchUserWorks", () => {
        it("userWorksPath 拼接作品列表路径", () => {
            expect(userWorksPath("u2", 50)).toBe(
                "/api/users/u2/works?limit=50",
            );
        });

        it("获取某用户的已发布作品", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse([{ id: "w1", title: "作品" }]),
            );
            await expect(fetchUserWorks("u2", 50)).resolves.toEqual([
                { id: "w1", title: "作品" },
            ]);
            expect(fetch).toHaveBeenCalledWith("/api/users/u2/works?limit=50");
        });
    });

    describe("uploadAvatar", () => {
        it("上传成功返回 key 与 url", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse(
                    { key: "avatars/u1/a.png", url: "/api/storage/a.png" },
                    201,
                ),
            );
            const file = new File(["x"], "a.png", { type: "image/png" });
            await expect(uploadAvatar(file)).resolves.toEqual({
                key: "avatars/u1/a.png",
                url: "/api/storage/a.png",
            });
            const [url, init] = vi.mocked(fetch).mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("/api/users/me/avatar");
            expect(init.method).toBe("POST");
            expect(init.body).toBeInstanceOf(FormData);
        });

        it("失败时优先使用服务端错误信息", async () => {
            vi.mocked(fetch).mockResolvedValue(
                jsonResponse({ error: "图片过大" }, 400),
            );
            const file = new File(["x"], "a.png", { type: "image/png" });
            await expect(uploadAvatar(file)).rejects.toMatchObject({
                status: 400,
                message: "图片过大: 400",
            });
        });

        it("失败且无错误信息时用默认文案", async () => {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
            const file = new File(["x"], "a.png", { type: "image/png" });
            await expect(uploadAvatar(file)).rejects.toMatchObject({
                status: 500,
                message: "上传失败: 500",
            });
        });

        it("响应不是 JSON 时同样抛出 HttpError", async () => {
            vi.mocked(fetch).mockResolvedValue(
                new Response("oops", { status: 500 }),
            );
            const file = new File(["x"], "a.png", { type: "image/png" });
            await expect(uploadAvatar(file)).rejects.toBeInstanceOf(HttpError);
        });
    });
});

describe("api/comments", () => {
    it("workCommentsPath 拼接作品评论路径", () => {
        expect(workCommentsPath("w1")).toBe("/api/works/w1/comments");
    });

    it("fetchComments 请求传入路径", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
        await fetchComments("/api/works/w1/comments");
        expect(fetch).toHaveBeenCalledWith("/api/works/w1/comments");
    });

    it("postComment POST 评论内容与父评论", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: "c1" }, 201));
        await postComment("w1", "不错", null);
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/works/w1/comments");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({
            content: "不错",
            parentId: null,
        });
    });
});

describe("api/notifications", () => {
    it("通知相关路径与 key", () => {
        expect(notificationsPath()).toBe("/api/notifications");
        expect(notificationsKey("u1")).toEqual(["notifications", "u1"]);
        expect(unreadCountKey("u1")).toEqual(["notification-unread", "u1"]);
    });

    it("fetchNotifications 请求通知列表", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
        await fetchNotifications();
        expect(fetch).toHaveBeenCalledWith("/api/notifications");
    });

    it("fetchUnreadCount 请求未读数", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ count: 3 }));
        await expect(fetchUnreadCount()).resolves.toEqual({ count: 3 });
        expect(fetch).toHaveBeenCalledWith("/api/notifications/unread-count");
    });

    it("markNotificationsRead POST 全部已读", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));
        await expect(markNotificationsRead()).resolves.toEqual({ ok: true });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/notifications/read-all");
        expect(init.method).toBe("POST");
    });
});

describe("api/remixes", () => {
    it("二创相关路径", () => {
        expect(workRemixPath("w1")).toBe("/api/works/w1/remix");
        expect(workSourcePath("w1")).toBe("/api/works/w1/source");
        expect(workRemixesPath("w1")).toBe("/api/works/w1/remixes");
    });

    it("remixWork POST 创建二创", async () => {
        vi.mocked(fetch).mockResolvedValue(
            jsonResponse({ id: "w2", title: "副本" }, 201),
        );
        await expect(remixWork("w1")).resolves.toEqual({
            id: "w2",
            title: "副本",
        });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/works/w1/remix");
        expect(init.method).toBe("POST");
    });

    it("fetchWorkSource 返回来源（可为 null）", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse(null));
        await expect(fetchWorkSource("w2")).resolves.toBeNull();
    });

    it("fetchWorkRemixes 返回列表", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
        await fetchWorkRemixes("w1");
        expect(fetch).toHaveBeenCalledWith("/api/works/w1/remixes");
    });
});

describe("api/sparks", () => {
    it("workSparkPath 拼接火花路径", () => {
        expect(workSparkPath("w1")).toBe("/api/works/w1/spark");
    });

    it("fetchWorkSpark 返回是否已送火花", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ sparked: true }));
        await expect(fetchWorkSpark("w1")).resolves.toEqual({ sparked: true });
        expect(fetch).toHaveBeenCalledWith("/api/works/w1/spark");
    });

    it("giveSpark POST 送火花", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ sparked: true }));
        await expect(giveSpark("w1")).resolves.toEqual({ sparked: true });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/works/w1/spark");
        expect(init.method).toBe("POST");
    });

    it("已送过时抛出 HttpError", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 409));
        await expect(giveSpark("w1")).rejects.toMatchObject({
            status: 409,
            message: "送火花失败: 409",
        });
    });
});

describe("api/versions", () => {
    it("版本与快照路径", () => {
        expect(workVersionsPath("w1")).toBe("/api/works/w1/versions");
        expect(workSnapshotPath("w1", 2)).toBe("/api/works/w1/versions/2");
    });

    it("fetchVersions 请求版本列表", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
        await fetchVersions("w1");
        expect(fetch).toHaveBeenCalledWith("/api/works/w1/versions");
    });

    it("fetchSnapshot 请求快照", async () => {
        const snapshot = {
            version: 2,
            message: null,
            createdAt: 0,
            files: [],
        };
        vi.mocked(fetch).mockResolvedValue(jsonResponse(snapshot));
        await expect(fetchSnapshot("w1", 2)).resolves.toEqual(snapshot);
    });

    it("publishVersion POST 版本说明", async () => {
        vi.mocked(fetch).mockResolvedValue(
            jsonResponse({ version: 3, message: "更新", createdAt: "t" }, 201),
        );
        await publishVersion("w1", "更新");
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/works/w1/versions");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({ message: "更新" });
    });

    it("restoreVersion POST 回滚指定版本", async () => {
        vi.mocked(fetch).mockResolvedValue(
            jsonResponse({ ok: true, restoredVersion: 2, files: 3 }),
        );
        await expect(restoreVersion("w1", 2)).resolves.toEqual({
            ok: true,
            restoredVersion: 2,
            files: 3,
        });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/works/w1/versions/2/restore");
        expect(init.method).toBe("POST");
    });
});

describe("api/follows", () => {
    it("followPath 拼接关注路径", () => {
        expect(followPath("u2")).toBe("/api/users/u2/follow");
    });

    it("followUser POST 关注", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ following: true }));
        await expect(followUser("u2")).resolves.toEqual({ following: true });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/users/u2/follow");
        expect(init.method).toBe("POST");
    });

    it("unfollowUser DELETE 取关", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ following: false }));
        await expect(unfollowUser("u2")).resolves.toEqual({ following: false });
        const [url, init] = vi.mocked(fetch).mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/users/u2/follow");
        expect(init.method).toBe("DELETE");
    });

    it("重复关注抛 409", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 409));
        await expect(followUser("u2")).rejects.toMatchObject({
            status: 409,
            message: "关注失败: 409",
        });
    });
});
