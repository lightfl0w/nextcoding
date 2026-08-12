import type * as Monaco from "monaco-editor";
import { useEffect, useState } from "react";
import { loadMonaco } from "~/lib/editor";

/**
 * 懒加载 monaco 实例。
 * @returns monaco 命名空间；加载完成前为 `null`。
 * @remarks 组件卸载后忽略异步结果。
 */
export function useMonaco() {
    const [monaco, setMonaco] = useState<typeof Monaco | null>(null);

    useEffect(() => {
        let subscribed = true;
        loadMonaco()
            .then((instance) => {
                if (subscribed) {
                    setMonaco(instance);
                }
            })
            .catch(() => undefined);
        return () => {
            subscribed = false;
        };
    }, []);

    return monaco;
}
