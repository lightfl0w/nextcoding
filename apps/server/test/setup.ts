import { createHash } from "node:crypto";
import { beforeEach, vi } from "vitest";

vi.mock("@nextcoding/auth", () => ({
    auth: { api: { getSession: vi.fn() } },
}));

vi.mock("../src/works/repository.js", () => ({
    bumpWorkFileVersion: vi.fn(),
    deleteWorkFile: vi.fn(),
    deleteWorkFilesByIds: vi.fn(),
    findComment: vi.fn(),
    findPublishedWorkOwnerId: vi.fn(),
    findVersion: vi.fn(),
    findWorkAccess: vi.fn(),
    findWorkDetail: vi.fn(),
    findWorkFileByKey: vi.fn(),
    findWorkOwnerId: vi.fn(),
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
    renameWorkFile: vi.fn(),
    setWorkFileVersion: vi.fn(),
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

vi.mock("../src/storage/storageClient.js", () => ({
    getStorage: vi.fn(),
}));

import { auth } from "@nextcoding/auth";
import { getStorage } from "../src/storage/storageClient.js";
import * as socialRepo from "../src/works/socialRepository.js";
import * as workRepo from "../src/works/repository.js";
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
