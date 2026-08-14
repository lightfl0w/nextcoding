/**
 * JSON 请求头。
 */
const JSON_HEADERS = { "content-type": "application/json" };

/**
 * 请求失败时抛出的错误，携带 HTTP 状态码。
 */
export class HttpError extends Error {
    readonly status: number;

    /**
     * @param status - HTTP 状态码。
     * @param message - 优先用后端返回的错误消息；无则回退到场景描述 + 状态码。
     */
    constructor(status: number, message?: string) {
        super(message ?? `请求失败: ${status}`);
        this.name = "HttpError";
        this.status = status;
    }
}

export type MutationMethod = "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * 发送 JSON 请求。
 * @param path - 请求地址。
 * @param method - 请求方法。
 * @param body - 请求体；省略时不带 body。
 * @returns 原始 Response，供调用方处理非 2xx 与 401。
 */
export function sendJson(
    path: string,
    method: MutationMethod,
    body?: unknown,
): Promise<Response> {
    if (body === undefined) {
        return fetch(path, { method });
    }
    return fetch(path, {
        method,
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
    });
}

/**
 * GET 并解包 JSON。
 * @param path - 请求地址。
 * @returns 解析后的数据；非 2xx 抛 {@link HttpError}。
 */
export async function getJson<T>(path: string): Promise<T> {
    const response = await fetch(path);
    return unwrapJson<T>(response);
}

/**
 * GET 文本内容。
 * @param path - 请求地址。
 * @returns 文本；失败返回空串（读文件内容用）。
 */
export async function getTextOrEmpty(path: string): Promise<string> {
    const response = await fetch(path);
    return response.ok ? response.text() : "";
}

/**
 * POST FormData。
 * @param path - 请求地址。
 * @param form - 表单数据。
 * @returns 原始 Response，供调用方处理 401。
 */
export function postForm(path: string, form: FormData): Promise<Response> {
    return fetch(path, { method: "POST", body: form });
}

/**
 * 写操作并解包 JSON。
 * @param path - 请求地址。
 * @param method - 请求方法。
 * @param body - 请求体；省略时不带 body。
 * @param action - 失败场景描述，会拼进错误信息。
 * @returns 解析后的数据；失败抛 {@link HttpError}。
 */
export async function mutateJson<T>(
    path: string,
    method: MutationMethod,
    body?: unknown,
    action?: string,
): Promise<T> {
    const response = await sendJson(path, method, body);
    return unwrapJson<T>(response, action);
}

async function unwrapJson<T>(response: Response, action?: string): Promise<T> {
    if (!response.ok) {
        let message = action;
        try {
            const body = await response.json();
            if (typeof body === "object" && body !== null && "error" in body) {
                message = body.error as string;
            }
        } catch {

        }
        throw new HttpError(response.status, message);
    }
    return response.json() as Promise<T>;
}
