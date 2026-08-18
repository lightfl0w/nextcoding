/**
 * 生成把工作区文件写入虚拟文件系统的 Python 代码。
 * @remarks 纯函数，无 DOM / 网络 / 运行时依赖，可被主线程与
 * pygame worker 同时引用（worker 打包时不会拖入 @pyscript/core）。
 */
export function buildVirtualFilesScript(files: Record<string, string>): string {
    const lines = ["import pathlib as _ps_pathlib"];
    for (const [name, content] of Object.entries(files)) {
        const path = name.startsWith("/") ? name : `/${name}`;
        lines.push(
            `_ps_pathlib.Path(${JSON.stringify(path)}).parent.mkdir(parents=True, exist_ok=True)`,
            `_ps_pathlib.Path(${JSON.stringify(path)}).write_text(${JSON.stringify(content)}, encoding="utf-8")`,
        );
    }
    lines.push("del _ps_pathlib");
    return lines.join("\n");
}
