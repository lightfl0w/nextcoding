import { toast } from "@heroui/react";
import { useCallback } from "react";
import { giveSpark } from "~/lib/api";
import { HttpError } from "~/lib/api/http";

export const SPARK_ALREADY_SENT = "已经送过火花啦";
export const SPARK_SELF_MESSAGE = "不能给自己的作品送火花";
export const SPARK_SUCCESS_MESSAGE = "火花已送出";

/**
 * 送火花动作。
 * @param workId - 作品 ID。
 * @returns 是否成功；已送过（409）时返回 `false`。
 */
export function useGiveSpark() {
    return useCallback(async (workId: string): Promise<boolean> => {
        try {
            await giveSpark(workId);
            toast.success(SPARK_SUCCESS_MESSAGE);
            return true;
        } catch (error) {
            if (error instanceof HttpError && error.status === 409) {
                toast.warning(SPARK_ALREADY_SENT);
            } else {
                toast.danger((error as Error).message);
            }
            return false;
        }
    }, []);
}
