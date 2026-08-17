import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * 校验 Git 仓库地址可被服务端拉取/推送。
 * @param raw - 用户提交的仓库 URL。
 * @returns 错误信息；`null` 表示通过校验。
 * @remarks 仅允许公网 http/https 地址,拒绝本机/内网目标以防 SSRF。
 */
export async function validatePublicGitUrl(
    raw: string,
): Promise<string | null> {
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        return "仓库地址不合法";
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "仅支持 http/https 仓库地址";
    }
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!hostname) {
        return "仓库地址缺少主机名";
    }
    if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local")
    ) {
        return "不允许导入本机地址";
    }
    if (isIP(hostname) !== 0) {
        return isPrivateIpLiteral(hostname) ? "不允许导入内网地址" : null;
    }
    let addresses: Array<{ address: string; family: number }> = [];
    try {
        addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
        return "无法解析仓库地址";
    }
    if (
        addresses.length === 0 ||
        addresses.some(({ address }) => isPrivateIpLiteral(address))
    ) {
        return "不允许导入内网地址";
    }
    return null;
}

function isPrivateIpLiteral(ip: string): boolean {
    return isIP(ip) === 4 ? isPrivateIpv4(ip) : isPrivateIpv6(ip);
}

function isPrivateIpv4(ip: string): boolean {
    const octets = ip.split(".").map(Number);
    if (
        octets.length !== 4 ||
        octets.some(
            (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255,
        )
    ) {
        return true;
    }
    const [a, b] = octets;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 0 || b === 168)) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
    );
}

function isPrivateIpv6(ip: string): boolean {
    const lower = ip.toLowerCase();
    if (lower.startsWith("::ffff:")) {
        return isPrivateIpv4(lower.slice("::ffff:".length));
    }
    const groups = expandIpv6(lower);
    if (!groups) {
        return true;
    }
    const [a] = groups;
    if (a === 0) {
        return true;
    }
    if ((a & 0xfe00) === 0xfc00) {
        return true;
    }
    if ((a & 0xffc0) === 0xfe80) {
        return true;
    }
    if (a >> 8 === 0xff) {
        return true;
    }
    if (a === 0x2001 && (groups[1] ?? 0) === 0x0db8) {
        return true;
    }
    return false;
}

function expandIpv6(ip: string): number[] | null {
    const dbl = ip.indexOf("::");
    let head: string[] = [];
    let tail: string[] = [];
    if (dbl !== -1) {
        head = ip.slice(0, dbl) ? ip.slice(0, dbl).split(":") : [];
        tail = ip.slice(dbl + 2) ? ip.slice(dbl + 2).split(":") : [];
    } else {
        head = ip.split(":");
    }

    function parseGroups(segments: string[]): number[] | null {
        const groups: number[] = [];
        for (const segment of segments) {
            if (segment === "") {
                return null;
            }
            if (segment.includes(".")) {
                const octets = segment.split(".").map(Number);
                if (
                    octets.length !== 4 ||
                    octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)
                ) {
                    return null;
                }
                groups.push(
                    (octets[0] << 8) | octets[1],
                    (octets[2] << 8) | octets[3],
                );
                continue;
            }
            if (!/^[0-9a-f]{1,4}$/.test(segment)) {
                return null;
            }
            groups.push(Number.parseInt(segment, 16));
        }
        return groups;
    }

    const headGroups = parseGroups(head);
    if (!headGroups) {
        return null;
    }
    if (dbl === -1) {
        return headGroups.length === 8 ? headGroups : null;
    }
    const tailGroups = parseGroups(tail);
    if (!tailGroups) {
        return null;
    }
    if (headGroups.length + tailGroups.length >= 8) {
        return null;
    }
    return [
        ...headGroups,
        ...Array(8 - headGroups.length - tailGroups.length).fill(0),
        ...tailGroups,
    ];
}
