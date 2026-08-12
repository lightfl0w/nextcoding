const DEFAULT_MAX_FILE_SIZE_MB = 20;
const BYTES_PER_MB = 1024 * 1024;

const maxFileSizeMb =
    Number(process.env.NC_MAX_FILE_SIZE_MB) || DEFAULT_MAX_FILE_SIZE_MB;

const MAX_FILE_SIZE_BYTES = maxFileSizeMb * BYTES_PER_MB;

export const COMMENT_MAX_LENGTH = 500;

export const COMMENT_PAGE_SIZE = 200;

export const WORK_PAGE_SIZE_DEFAULT = 20;

export const WORK_PAGE_SIZE_MAX = 100;

export const VERSIONS_PAGE_SIZE = 200;

export const MY_WORKS_PAGE_SIZE = 200;

export function exceedsFileSizeLimit(byteLength: number): boolean {
    return byteLength > MAX_FILE_SIZE_BYTES;
}

/**
 * 把分页 limit 收敛到合法区间。
 * @param raw - 查询参数原文，非法时回退默认值。
 */
export function clampLimit(raw: string | undefined): number {
    const requested = Number(raw);
    if (!Number.isFinite(requested) || requested <= 0) {
        return WORK_PAGE_SIZE_DEFAULT;
    }
    return Math.min(requested, WORK_PAGE_SIZE_MAX);
}

export function fileSizeLimitMessage(fileName?: string): string {
    const subject = fileName ? `文件 ${fileName}` : "文件";
    return `${subject} 超过 ${maxFileSizeMb}MB 限制`;
}
