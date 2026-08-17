import { lookup } from "node:dns/promises";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as exportWork from "../src/git/exportWork.js";
import { getImportJob } from "../src/git/importJobs.js";
import * as importWork from "../src/git/importWork.js";
import * as pushWork from "../src/git/pushWork.js";
import { gitRoutes } from "../src/git/routes.js";
import { validatePublicGitUrl } from "../src/git/safeUrl.js";
import * as workRepo from "../src/works/repository.js";
import { makeSession } from "./helpers";
import { mockGetSession } from "./setup";

vi.mock("node:dns/promises", () => ({
    lookup: vi.fn(),
}));

vi.mock("../src/git/importWork.js", async (importOriginal) => {
    const actual = await importOriginal<typeof importWork>();
    return { ...actual, importWorkFromGit: vi.fn() };
});

vi.mock("../src/git/exportWork.js", async (importOriginal) => {
    const actual = await importOriginal<typeof exportWork>();
    return {
        ...actual,
        buildGitRepository: vi.fn(),
        collectWorkCommits: vi.fn(),
        zipDirectory: vi.fn(),
    };
});

vi.mock("../src/git/pushWork.js", async (importOriginal) => {
    const actual = await importOriginal<typeof pushWork>();
    return { ...actual, pushWorkToGit: vi.fn() };
});

const mockedLookup = vi.mocked(lookup);

describe("validatePublicGitUrl", () => {
    it("拒绝非 http/https 协议", async () => {
        expect(await validatePublicGitUrl("file:///tmp/repo")).toMatch(/http/);
        expect(
            await validatePublicGitUrl("git@github.com:user/repo.git"),
        ).toMatch(/不合法|http/);
        expect(await validatePublicGitUrl("ftp://example.com/repo")).toMatch(
            /http/,
        );
    });

    it("拒绝不合法地址", async () => {
        expect(await validatePublicGitUrl("not a url")).toBeTruthy();
        expect(await validatePublicGitUrl("https://")).toMatch(/不合法|主机名/);
    });

    it("拒绝本机地址", async () => {
        expect(
            await validatePublicGitUrl("http://localhost:3000/repo"),
        ).toMatch(/本机/);
        expect(
            await validatePublicGitUrl("https://foo.localhost/repo"),
        ).toMatch(/本机/);
        expect(
            await validatePublicGitUrl("https://printer.local/repo"),
        ).toMatch(/本机/);
    });

    it("拒绝私有/保留 IP 字面量", async () => {
        for (const host of [
            "127.0.0.1",
            "0.0.0.0",
            "10.1.2.3",
            "172.16.0.1",
            "172.31.255.255",
            "192.168.1.1",
            "169.254.10.10",
            "100.64.0.1",
            "224.0.0.1",
            "[::1]",
            "[fc00::1]",
            "[fe80::1]",
            "[::ffff:192.168.1.1]",
        ]) {
            expect(await validatePublicGitUrl(`http://${host}/repo`)).toMatch(
                /内网/,
            );
        }
    });

    it("公网 IP 字面量通过", async () => {
        expect(await validatePublicGitUrl("http://8.8.8.8/repo")).toBeNull();
    });

    it("域名解析到内网地址时拒绝", async () => {
        mockedLookup.mockResolvedValue([{ address: "192.168.1.1", family: 4 }]);
        expect(await validatePublicGitUrl("https://example.com/repo")).toMatch(
            /内网/,
        );
    });

    it("域名解析失败时拒绝", async () => {
        mockedLookup.mockRejectedValue(new Error("ENOTFOUND"));
        expect(
            await validatePublicGitUrl("https://nonexistent.invalid/repo"),
        ).toMatch(/无法解析/);
    });

    it("公网域名通过", async () => {
        mockedLookup.mockResolvedValue([
            { address: "93.184.216.34", family: 4 },
        ]);
        expect(
            await validatePublicGitUrl("https://example.com/repo"),
        ).toBeNull();
    });
});

describe("gitRoutes", () => {
    function app() {
        return new Hono().route("/api/works", gitRoutes);
    }

    function asOwner() {
        mockGetSession.mockResolvedValue(makeSession({ id: "owner" }));
        vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
    }

    describe("POST /import/git", () => {
        it("未登录返回 401", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/works/import/git", {
                method: "POST",
                body: JSON.stringify({ repoUrl: "https://example.com/repo" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(401);
        });

        it("缺少仓库地址返回 400", async () => {
            mockGetSession.mockResolvedValue(makeSession());
            const res = await app().request("/api/works/import/git", {
                method: "POST",
                body: JSON.stringify({}),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "缺少仓库地址" });
        });

        it("启动导入任务返回 202 与 jobId，完成后任务携带结果", async () => {
            mockGetSession.mockResolvedValue(
                makeSession({ id: "user-1", name: "张三" }),
            );
            const result = {
                workId: "work-git-1",
                title: "demo",
                commitCount: 3,
                fileCount: 2,
                skipped: [{ path: "big.bin", reason: "超过单文件大小限制" }],
            };
            vi.mocked(importWork.importWorkFromGit).mockResolvedValue(result);
            const res = await app().request("/api/works/import/git", {
                method: "POST",
                body: JSON.stringify({
                    repoUrl: "https://example.com/repo.git",
                    ref: "main",
                    depth: 50,
                    title: "demo",
                }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(202);
            const { jobId } = (await res.json()) as { jobId: string };
            expect(jobId).toBeTruthy();
            expect(importWork.importWorkFromGit).toHaveBeenCalledWith(
                expect.objectContaining({
                    repoUrl: "https://example.com/repo.git",
                    userId: "user-1",
                    ref: "main",
                    depth: 50,
                    title: "demo",
                    onProgress: expect.any(Function),
                }),
            );
            await vi.waitFor(() => {
                expect(getImportJob(jobId)?.status).toBe("done");
            });
            expect(getImportJob(jobId)?.result).toEqual(result);
        });

        it("导入失败时任务记录错误消息", async () => {
            mockGetSession.mockResolvedValue(makeSession());
            vi.mocked(importWork.importWorkFromGit).mockRejectedValue(
                new importWork.GitImportError("不允许导入内网地址", 400),
            );
            const res = await app().request("/api/works/import/git", {
                method: "POST",
                body: JSON.stringify({ repoUrl: "http://10.0.0.1/repo" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(202);
            const { jobId } = (await res.json()) as { jobId: string };
            await vi.waitFor(() => {
                expect(getImportJob(jobId)?.status).toBe("error");
            });
            expect(getImportJob(jobId)?.error).toBe("不允许导入内网地址");
        });

        it("意外错误记入任务（携带具体原因）", async () => {
            mockGetSession.mockResolvedValue(makeSession());
            vi.mocked(importWork.importWorkFromGit).mockRejectedValue(
                new Error("boom"),
            );
            const res = await app().request("/api/works/import/git", {
                method: "POST",
                body: JSON.stringify({ repoUrl: "https://example.com/repo" }),
                headers: { "content-type": "application/json" },
            });
            expect(res.status).toBe(202);
            const { jobId } = (await res.json()) as { jobId: string };
            await vi.waitFor(() => {
                expect(getImportJob(jobId)?.status).toBe("error");
            });
            expect(getImportJob(jobId)?.error).toBe("导入失败：boom");
        });
    });

    describe("GET /import/git/jobs/:jobId/events (SSE)", () => {
        function startDoneJob() {
            mockGetSession.mockResolvedValue(
                makeSession({ id: "user-1", name: "张三" }),
            );
            vi.mocked(importWork.importWorkFromGit).mockResolvedValue({
                workId: "work-git-1",
                title: "demo",
                commitCount: 1,
                fileCount: 1,
                skipped: [],
            });
            return (async () => {
                const res = await app().request("/api/works/import/git", {
                    method: "POST",
                    body: JSON.stringify({
                        repoUrl: "https://example.com/repo.git",
                    }),
                    headers: { "content-type": "application/json" },
                });
                const { jobId } = (await res.json()) as { jobId: string };
                await vi.waitFor(() => {
                    expect(getImportJob(jobId)?.status).toBe("done");
                });
                return jobId;
            })();
        }

        it("任务完成后推送 done 事件与结果", async () => {
            const jobId = await startDoneJob();
            const res = await app().request(
                `/api/works/import/git/jobs/${jobId}/events`,
            );
            expect(res.status).toBe(200);
            const body = await res.text();
            expect(body).toContain("event: done");
            expect(body).toContain('"workId":"work-git-1"');
            expect(body).toContain('"percent":100');
        });

        it("未登录返回 401", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request(
                "/api/works/import/git/jobs/job-x/events",
            );
            expect(res.status).toBe(401);
        });

        it("非任务归属用户返回 error 事件", async () => {
            const jobId = await startDoneJob();
            mockGetSession.mockResolvedValue(
                makeSession({ id: "someone-else" }),
            );
            const res = await app().request(
                `/api/works/import/git/jobs/${jobId}/events`,
            );
            const body = await res.text();
            expect(body).toContain("event: error");
            expect(body).toContain("无权查看该任务");
        });

        it("任务不存在返回 error 事件", async () => {
            mockGetSession.mockResolvedValue(makeSession());
            const res = await app().request(
                "/api/works/import/git/jobs/does-not-exist/events",
            );
            const body = await res.text();
            expect(body).toContain("event: error");
            expect(body).toContain("任务不存在或已过期");
        });
    });

    describe("POST /import/git/jobs/:jobId/cancel", () => {
        async function startRunningJob(): Promise<string> {
            mockGetSession.mockResolvedValue(makeSession({ id: "user-1" }));
            vi.mocked(importWork.importWorkFromGit).mockImplementation(
                () => new Promise(() => {}),
            );
            const res = await app().request("/api/works/import/git", {
                method: "POST",
                body: JSON.stringify({
                    repoUrl: "https://example.com/repo.git",
                }),
                headers: { "content-type": "application/json" },
            });
            const { jobId } = (await res.json()) as { jobId: string };
            expect(getImportJob(jobId)?.status).toBe("running");
            return jobId;
        }

        it("未登录返回 401", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request(
                "/api/works/import/git/jobs/job-x/cancel",
                { method: "POST" },
            );
            expect(res.status).toBe(401);
        });

        it("取消运行中的任务并触发中止信号", async () => {
            const jobId = await startRunningJob();
            const res = await app().request(
                `/api/works/import/git/jobs/${jobId}/cancel`,
                { method: "POST" },
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                cancelled: true,
                jobId,
            });
            expect(getImportJob(jobId)?.status).toBe("cancelled");
            expect(getImportJob(jobId)?.controller.signal.aborted).toBe(true);
        });

        it("非归属用户返回 403", async () => {
            const jobId = await startRunningJob();
            mockGetSession.mockResolvedValue(
                makeSession({ id: "someone-else" }),
            );
            const res = await app().request(
                `/api/works/import/git/jobs/${jobId}/cancel`,
                { method: "POST" },
            );
            expect(res.status).toBe(403);
            expect(getImportJob(jobId)?.status).toBe("running");
        });

        it("任务不存在返回 404", async () => {
            mockGetSession.mockResolvedValue(makeSession());
            const res = await app().request(
                "/api/works/import/git/jobs/does-not-exist/cancel",
                { method: "POST" },
            );
            expect(res.status).toBe(404);
        });

        it("已完成任务不可再取消", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "user-1" }));
            vi.mocked(importWork.importWorkFromGit).mockResolvedValue({
                workId: "work-git-1",
                title: "demo",
                commitCount: 1,
                fileCount: 1,
                skipped: [],
            });
            const res = await app().request("/api/works/import/git", {
                method: "POST",
                body: JSON.stringify({
                    repoUrl: "https://example.com/repo.git",
                }),
                headers: { "content-type": "application/json" },
            });
            const { jobId } = (await res.json()) as { jobId: string };
            await vi.waitFor(() => {
                expect(getImportJob(jobId)?.status).toBe("done");
            });
            const cancelRes = await app().request(
                `/api/works/import/git/jobs/${jobId}/cancel`,
                { method: "POST" },
            );
            expect(cancelRes.status).toBe(200);
            expect(await cancelRes.json()).toEqual({
                ok: true,
                cancelled: false,
                jobId,
            });
            expect(getImportJob(jobId)?.status).toBe("done");
        });

        it("取消后 SSE 推送 cancelled 事件", async () => {
            const jobId = await startRunningJob();
            await app().request(`/api/works/import/git/jobs/${jobId}/cancel`, {
                method: "POST",
            });
            const res = await app().request(
                `/api/works/import/git/jobs/${jobId}/events`,
            );
            const body = await res.text();
            expect(body).toContain("event: cancelled");
            expect(body).toContain("导入已取消");
        });
    });

    describe("GET /:id/export/git", () => {
        it("未登录返回 401", async () => {
            mockGetSession.mockResolvedValue(null);
            const res = await app().request("/api/works/work-1/export/git");
            expect(res.status).toBe(401);
        });

        it("非作者返回 403", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request("/api/works/work-1/export/git");
            expect(res.status).toBe(403);
        });

        it("下载 zip 并设置下载头", async () => {
            asOwner();
            vi.mocked(exportWork.collectWorkCommits).mockResolvedValue([]);
            vi.mocked(exportWork.buildGitRepository).mockResolvedValue(
                "/tmp/fake-export",
            );
            vi.mocked(exportWork.zipDirectory).mockResolvedValue(
                new ArrayBuffer(0),
            );
            const res = await app().request("/api/works/work-1/export/git");
            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toBe("application/zip");
            expect(res.headers.get("content-disposition")).toMatch(
                /work-work-1\.git\.zip/,
            );
        });

        it("导出失败返回 500 并携带具体原因", async () => {
            asOwner();
            vi.mocked(exportWork.collectWorkCommits).mockRejectedValue(
                new Error("快照读取失败"),
            );
            const res = await app().request("/api/works/work-1/export/git");
            expect(res.status).toBe(500);
            expect(await res.json()).toEqual({
                error: "导出失败：快照读取失败",
            });
        });
    });

    describe("POST /:id/export/git/push", () => {
        it("非作者返回 403", async () => {
            mockGetSession.mockResolvedValue(makeSession({ id: "someone" }));
            vi.mocked(workRepo.findWorkOwnerId).mockResolvedValue("owner");
            const res = await app().request(
                "/api/works/work-1/export/git/push",
                {
                    method: "POST",
                    body: JSON.stringify({ url: "https://x", token: "t" }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(403);
        });

        it("缺少仓库地址或令牌返回 400", async () => {
            asOwner();
            for (const body of [{}, { url: "https://x" }, { token: "t" }]) {
                const res = await app().request(
                    "/api/works/work-1/export/git/push",
                    {
                        method: "POST",
                        body: JSON.stringify(body),
                        headers: { "content-type": "application/json" },
                    },
                );
                expect(res.status).toBe(400);
            }
        });

        it("推送成功返回结果", async () => {
            asOwner();
            vi.mocked(pushWork.pushWorkToGit).mockResolvedValue({
                ok: true,
                pushedRef: "main",
                commitCount: 4,
            });
            const res = await app().request(
                "/api/works/work-1/export/git/push",
                {
                    method: "POST",
                    body: JSON.stringify({
                        url: "https://example.com/repo.git",
                        token: "secret-token",
                        ref: "main",
                    }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                ok: true,
                pushedRef: "main",
                commitCount: 4,
            });
            expect(pushWork.pushWorkToGit).toHaveBeenCalledWith({
                workId: "work-1",
                url: "https://example.com/repo.git",
                token: "secret-token",
                ref: "main",
                force: false,
            });
        });

        it("推送失败透传错误状态", async () => {
            asOwner();
            vi.mocked(pushWork.pushWorkToGit).mockRejectedValue(
                new pushWork.GitPushError("推送失败：认证失败", 400),
            );
            const res = await app().request(
                "/api/works/work-1/export/git/push",
                {
                    method: "POST",
                    body: JSON.stringify({
                        url: "https://example.com/repo.git",
                        token: "bad",
                    }),
                    headers: { "content-type": "application/json" },
                },
            );
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "推送失败：认证失败" });
        });
    });
});
