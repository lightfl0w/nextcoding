import { createHash } from "node:crypto";
import { beforeEach, vi } from "vitest";

process.env.DB_URL ??= "file::memory:?cache=shared";

vi.mock("@nextcoding/auth", () => ({
    auth: { api: { getSession: vi.fn() } },
}));

vi.mock("../src/works/repository.js", () => ({
    bumpWorkFileVersion: vi.fn(),
    deleteWorkFile: vi.fn(),
    deleteWorkFilesByIds: vi.fn(),
    deleteVersion: vi.fn(),
    findComment: vi.fn(),
    findPublishedWorkOwnerId: vi.fn(),
    findVersion: vi.fn(),
    findWorkAccess: vi.fn(),
    findWorkAuthor: vi.fn(),
    findWorkDetail: vi.fn(),
    findWorkFileByKey: vi.fn(),
    findWorkOwnerId: vi.fn(),
    findWorkUpdatedAt: vi.fn(),
    insertComment: vi.fn(),
    insertVersion: vi.fn(),
    insertWork: vi.fn(),
    insertWorkFile: vi.fn(),
    insertWorkFiles: vi.fn(),
    listComments: vi.fn(),
    listOwnedWorks: vi.fn(),
    listPublishedWorks: vi.fn(),
    listUserPublishedWorks: vi.fn(),
    listVersionSummaries: vi.fn(),
    listWorkFiles: vi.fn(),
    listWorkFilesByPrefix: vi.fn(),
    mapWorkFilesByKey: vi.fn(),
    nextVersionNumber: vi.fn(),
    publishWork: vi.fn(),
    renameVersionMessage: vi.fn(),
    renameWorkFile: vi.fn(),
    setWorkFileVersion: vi.fn(),
    touchWork: vi.fn(),
    updateWorkTitle: vi.fn(),
    workExists: vi.fn(),
}));

vi.mock("../src/works/socialRepository.js", () => ({
    NOTIFICATION_PAGE_SIZE: 100,
    bumpWorkSparks: vi.fn(),
    countUnreadNotifications: vi.fn(),
    findSourceByFork: vi.fn(),
    findSpark: vi.fn(),
    insertNotification: vi.fn(),
    insertRemix: vi.fn(),
    insertSpark: vi.fn(),
    listDirectRemixes: vi.fn(),
    listNotifications: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    markNotificationRead: vi.fn(),
}));

vi.mock("../src/works/sparkBalance.js", () => ({
    DAILY_SPARK_GRANT: 10,
    consumeSpark: vi.fn(async () => true),
    ensureSparkBalance: vi.fn(async () => 10),
}));

vi.mock("../src/works/notificationBus.js", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("../src/works/notificationBus.js")
        >();
    return actual;
});

vi.mock("../src/users/repository.js", () => ({
    countFollowers: vi.fn(),
    countFollowing: vi.fn(),
    countGivenSparks: vi.fn(),
    countReceivedSparks: vi.fn(),
    deleteFollow: vi.fn(),
    findFollow: vi.fn(),
    findUserById: vi.fn(),
    findUserProfile: vi.fn(),
    insertFollow: vi.fn(),
}));

vi.mock("../src/tags/repository.js", () => ({
    attachWorkTag: vi.fn(),
    bumpTagWorkCount: vi.fn(),
    detachWorkTags: vi.fn(),
    ensureTag: vi.fn(),
    findTagBySlug: vi.fn(),
    listPopularTags: vi.fn(),
    listTagWorks: vi.fn(),
    listTags: vi.fn(),
}));

vi.mock("../src/bookmarks/repository.js", () => ({
    deleteBookmark: vi.fn(),
    findBookmark: vi.fn(),
    findBookmarkVisibility: vi.fn(),
    insertBookmark: vi.fn(),
    listUserBookmarks: vi.fn(),
}));

vi.mock("../src/activities/repository.js", () => ({
    ACTIVITY_PAGE_SIZE: 50,
    findActivityVisibility: vi.fn(),
    insertActivity: vi.fn(),
    listFeedActivities: vi.fn(),
    listUserActivities: vi.fn(),
    userExists: vi.fn(),
}));

vi.mock("../src/messages/repository.js", () => ({
    MESSAGE_PAGE_SIZE: 50,
    countUnreadMessages: vi.fn(),
    findConversation: vi.fn(),
    findConversationBetween: vi.fn(),
    findMessage: vi.fn(),
    findOrCreateConversation: vi.fn(),
    findUserProfile: vi.fn(),
    insertMessage: vi.fn(),
    listConversations: vi.fn(),
    listMessages: vi.fn(),
    markConversationRead: vi.fn(),
    recallMessage: vi.fn(),
    userExists: vi.fn(),
}));

vi.mock("../src/messages/messageBus.js", () => ({
    publishMessageRecalled: vi.fn(),
    publishNewMessage: vi.fn(),
    publishToUser: vi.fn(),
    publishUnreadCount: vi.fn(),
    subscribeUser: vi.fn(),
}));

vi.mock("../src/achievements/repository.js", () => ({
    countUserFollowers: vi.fn(),
    countUserReceivedSparks: vi.fn(),
    countUserRemixes: vi.fn(),
    countUserSparks: vi.fn(),
    countUserWorks: vi.fn(),
    countUserTemplateMaxUses: vi.fn(),
    countUserTemplates: vi.fn(),
    countUserTemplateTotalUses: vi.fn(),
    findUserAchievement: vi.fn(),
    listAchievements: vi.fn(),
    listUserAchievements: vi.fn(),
    unlockAchievement: vi.fn(),
}));

vi.mock("../src/admin/repository.js", () => ({
    ADMIN_PAGE_SIZE_DEFAULT: 20,
    ADMIN_PAGE_SIZE_MAX: 50,
    banUser: vi.fn(),
    clampPage: vi.fn((raw?: string) => {
        const page = Number(raw);
        return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    }),
    clampPageSize: vi.fn((raw?: string) => {
        const size = Number(raw);
        if (!Number.isFinite(size) || size <= 0) {
            return 20;
        }
        return Math.min(Math.floor(size), 50);
    }),
    countAdminMessages: vi.fn(),
    deleteAdminConversation: vi.fn(),
    deleteAdminMessage: vi.fn(),
    deleteComment: vi.fn(),
    deleteTag: vi.fn(),
    deleteUser: vi.fn(),
    deleteWork: vi.fn(),
    findAchievementById: vi.fn(),
    findAdminCommentById: vi.fn(),
    findAdminConversationById: vi.fn(),
    findAdminMessageById: vi.fn(),
    findAdminReportById: vi.fn(),
    findAdminTagById: vi.fn(),
    findAdminUserById: vi.fn(),
    findAdminWorkById: vi.fn(),
    getDashboardStats: vi.fn(),
    grantAchievement: vi.fn(),
    handleReport: vi.fn(),
    listAdminAchievements: vi.fn(),
    listAdminConversations: vi.fn(),
    listAdminMessages: vi.fn(),
    listAdminReports: vi.fn(),
    listAdminTags: vi.fn(),
    listAdminUserAchievements: vi.fn(),
    listComments: vi.fn(),
    listUsers: vi.fn(),
    listWorks: vi.fn(),
    revokeAchievement: vi.fn(),
    setUserRole: vi.fn(),
    unbanUser: vi.fn(),
}));

vi.mock("../src/settings/repository.js", () => ({
    findOrCreateSettings: vi.fn(),
    updateSettings: vi.fn(),
}));

vi.mock("../src/templates/repository.js", () => ({
    bumpTemplateUseCount: vi.fn(),
    bumpWorkTemplateUseCount: vi.fn(),
    countTemplateUses: vi.fn(),
    createTemplate: vi.fn(),
    deleteTemplateByWork: vi.fn(),
    findTemplate: vi.fn(),
    findTemplateByWork: vi.fn(),
    findTemplateDetail: vi.fn(),
    findWorkTemplateFlag: vi.fn(),
    insertTemplateUse: vi.fn(),
    listTemplateLeaderboard: vi.fn(),
    listTemplates: vi.fn(),
    listTemplateUses: vi.fn(),
    rateTemplate: vi.fn(),
    setWorkIsTemplate: vi.fn(),
    sumTemplateDerivedStats: vi.fn(),
}));

vi.mock("../src/reports/repository.js", () => ({
    REPORT_REASON_MAX_LENGTH: 200,
    findReportByReporterAndWork: vi.fn(),
    findReportableWork: vi.fn(),
    insertReport: vi.fn(),
    reopenReport: vi.fn(),
}));

vi.mock("../src/storage/storageClient.js", () => ({
    getStorage: vi.fn(),
}));

import { auth } from "@nextcoding/auth";
import { getStorage } from "../src/storage/storageClient.js";
import * as workRepo from "../src/works/repository.js";
import * as socialRepo from "../src/works/socialRepository.js";
import { createMemoryStorage, makeSession } from "./helpers";

export const mockGetSession = vi.mocked(auth.api.getSession);
export const storage = createMemoryStorage();

export function sha256Hex(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
}

beforeEach(() => {
    vi.resetAllMocks();
    mockGetSession.mockResolvedValue(makeSession());
    vi.mocked(getStorage).mockReturnValue(storage);
    vi.mocked(workRepo.findWorkAccess).mockResolvedValue({
        userId: "owner",
        status: "published",
    });
    vi.mocked(socialRepo.listNotifications).mockResolvedValue([]);
    vi.mocked(socialRepo.countUnreadNotifications).mockResolvedValue(0);
    storage.store.clear();
    storage.putCalls.length = 0;
});
