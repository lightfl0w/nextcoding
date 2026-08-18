/**
 * 有界并发执行：把 items 交给 worker 处理，最多同时运行 `limit` 个。
 * 用于把逐项串行的存储往返改成批量并发，同时避免一次性打满全部连接。
 *
 * @param items - 待处理项。
 * @param limit - 并发上限。
 * @param worker - 单项处理函数。
 * @returns 与 items 顺序一致的结果数组。
 */
export async function mapLimit<T, R>(
    items: readonly T[],
    limit: number,
    worker: (item: T) => Promise<R>,
): Promise<R[]> {
    if (items.length === 0) {
        return [];
    }
    const results = new Array<R>(items.length);
    let next = 0;
    const runners = Array.from(
        { length: Math.min(limit, items.length) },
        async () => {
            while (next < items.length) {
                const index = next++;
                results[index] = await worker(items[index]);
            }
        },
    );
    await Promise.all(runners);
    return results;
}
