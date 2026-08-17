import { db, sparkBalance } from "@nextcoding/db";
import { eq } from "drizzle-orm";

export const DAILY_SPARK_GRANT = 10;

function todayDate(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

function daysBetween(from: string, to: string): number {
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    const toTime = new Date(`${to}T00:00:00`).getTime();
    return Math.round((toTime - fromTime) / 86_400_000);
}

/**
 * 发放每日火花并返回当前余额。
 * 首次使用创建记录（当天 +10）；跨天按天数补发，余额可累计。
 * @param userId - 用户 ID。
 * @returns 当前火花余额。
 */
export async function ensureSparkBalance(userId: string): Promise<number> {
    const today = todayDate();
    const row = await db
        .select({
            balance: sparkBalance.balance,
            lastGrantedAt: sparkBalance.lastGrantedAt,
        })
        .from(sparkBalance)
        .where(eq(sparkBalance.userId, userId))
        .limit(1)
        .get();

    if (!row) {
        await db.insert(sparkBalance).values({
            userId,
            balance: DAILY_SPARK_GRANT,
            lastGrantedAt: today,
        });
        return DAILY_SPARK_GRANT;
    }

    if (row.lastGrantedAt >= today) {
        return row.balance;
    }

    const balance =
        row.balance + daysBetween(row.lastGrantedAt, today) * DAILY_SPARK_GRANT;
    await db
        .update(sparkBalance)
        .set({ balance, lastGrantedAt: today })
        .where(eq(sparkBalance.userId, userId));
    return balance;
}

/**
 * 消费 1 个火花。
 * @param userId - 用户 ID。
 * @returns 余额充足并扣减成功时返回 `true`，否则 `false`。
 */
export async function consumeSpark(userId: string): Promise<boolean> {
    const balance = await ensureSparkBalance(userId);
    if (balance < 1) {
        return false;
    }
    await db
        .update(sparkBalance)
        .set({ balance: balance - 1 })
        .where(eq(sparkBalance.userId, userId));
    return true;
}
