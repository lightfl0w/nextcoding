import { describe, expect, it, vi } from "vitest";

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

import { validateAuthSearch } from "../src/lib/authSearch";
import { LARGE_FILE_BYTES, languageFromName } from "../src/lib/editor";
import {
    buildFileTree,
    type FileTreeNode,
    type FolderNode,
    pathBasename,
} from "../src/lib/fileTree";
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
import { makeFile, makeNotification, setupFetchStub } from "./helpers";

setupFetchStub();

function folderOf(node: FileTreeNode | null | undefined): FolderNode | null {
    return node?.kind === "folder" ? node : null;
}

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
            const src = folderOf(tree[0]);
            expect(src).toMatchObject({
                kind: "folder",
                path: "src",
                name: "src",
            });
            expect(src?.children).toMatchObject([
                { kind: "folder", name: "utils" },
                { kind: "file", name: "index.js" },
            ]);
            const utils = folderOf(src?.children[0] ?? null);
            expect(utils?.children).toMatchObject([
                { kind: "file", name: "helper.js" },
            ]);
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
