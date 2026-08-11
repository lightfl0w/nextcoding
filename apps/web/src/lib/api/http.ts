const JSON_HEADERS = { "content-type": "application/json" };

export class HttpError extends Error {
    readonly status: number;

    constructor(status: number, action = "请求失败") {
        super(`${action}: ${status}`);
        this.name = "HttpError";
        this.status = status;
    }
}

export type MutationMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export function sendJson(
    path: string,
    method: MutationMethod,
    body?: unknown,
): Promise<Response> {
    if (body === undefined) return fetch(path, { method });
    return fetch(path, {
        method,
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
    });
}

export async function getJson<T>(path: string): Promise<T> {
    const response = await fetch(path);
    return unwrapJson<T>(response);
}

export async function getTextOrEmpty(path: string): Promise<string> {
    const response = await fetch(path);
    return response.ok ? response.text() : "";
}

export function postForm(path: string, form: FormData): Promise<Response> {
    return fetch(path, { method: "POST", body: form });
}

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
    if (!response.ok) throw new HttpError(response.status, action);
    return response.json() as Promise<T>;
}
