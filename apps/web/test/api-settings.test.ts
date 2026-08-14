import { describe, expect, it } from "vitest";
import { settingsPath } from "../src/lib/api/settings";

describe("api/settings", () => {
    describe("settingsPath", () => {
        it("返回设置路径", () => {
            expect(settingsPath()).toBe("/api/settings");
        });
    });
});
