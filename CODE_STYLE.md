# NextCoding 代码规范

本文件是项目的**唯一代码规范**。所有新增、修改的代码必须符合本规范；与 biome、tsc 的执行结果冲突时，以本规范为准，并同步调整对应配置。

## 0. 总则

1. **可读性优先**。代码首先是给人读的，其次才是给机器运行的。
2. **一致性**。不得在局部打破项目既有风格；修改旧代码时顺手对齐本规范。
3. **提交前必须通过 biome 与 tsc**（见第 10 节）。

## 1. 格式

### 1.1 缩进与行宽

- 缩进为 **4 空格**，禁止使用 Tab。
- 每行不超过 **80 列**。
- 文件使用 UTF-8 编码、LF 换行，文件末尾保留一个换行符。
- 行尾不留空格。

### 1.2 引号

- 字符串一律使用**双引号** `"`。

```ts
const message = "文件保存成功";
const action = '取消'; // 错误：必须双引号
```

- 需要嵌入双引号或做变量插值时，使用模板字符串：

```ts
const url = `/api/works/${workId}/versions`;
const label = `v${version} ${languageLabel(language)}`;
```

### 1.3 分号

- 每条语句末尾**始终加分号**，不允许依赖 ASI。

```ts
const count = 0 // 错误：缺分号
const count = 0;
```

### 1.4 花括号

- `if` / `for` / `while` / `catch` / `finally` 的语句体**一律使用花括号**，即使只有一行。

```ts
if (!content) return;      // 错误：省略花括号
if (!content) {
    return;
}
```

- `else` 与上一个闭合花括号放在同一行。

```ts
if (ok) {
    toast.success("已保存");
} else {
    toast.danger("保存失败");
}
```

### 1.5 逗号与换行

- 多行的对象、数组、参数列表、导入列表中，每一项**尾随逗号**。

```ts
const options = {
    dedupingInterval: 2000,
    errorRetryCount: 3,
};
```

- 参数过多（超过约 4 个）或单行放不下时，换行书写，每行一个参数：

```ts
export function useWorkRunner(
    workId: string,
    runtime: RuntimeInfo | null,
): RunPanelState {
```

### 1.6 空白

- 二元运算符（`=`、`+`、`===`、`&&` 等）两侧各一个空格。
- 逗号、分号后跟一个空格；冒号在对象与类型标注中后跟一个空格。
- 控制关键字（`if`、`for`、`while`、`catch`、`return` 等）后跟一个空格。
- 函数名与左括号之间**不留空格**；`()` / `[]` 内部不留空格。
- 不连续出现两个以上空行。

## 2. 命名

### 2.1 文件命名

| 文件类型 | 约定 | 示例 |
|---|---|---|
| React 组件文件 | `PascalCase.tsx` | `WorkCard.tsx` |
| Hook 文件 | `useXxx.ts` | `useWorkRunner.ts` |
| 路由文件 | 路径小写 + 别名 | `routes/work/$id/index.tsx` |
| 其余模块 | `camelCase.ts` | `fileTree.ts` |

### 2.2 标识符

| 目标 | 约定 | 示例 | 反面 |
|---|---|---|---|
| 变量 / 函数 / 参数 | `camelCase` | `activeKey` | `ActiveKey` |
| 类型 / 接口 / 类 | `PascalCase` | `WorkDetail` | `workDetail` |
| React 组件 | `PascalCase` | `RunPanel` | `runPanel` |
| Hooks | `use` 前缀 + `camelCase` | `useFileTabs` | `FileTabs` |
| 模块级原始常量 | `CONSTANT_CASE` | `MAX_OUTPUT_LINES` | `maxOutputLines` |
| 布尔状态 | 可读时加 `is` / `has` / `can` | `isLoading`、`canEdit` | `loading` |
| 事件处理函数 | `handle` 前缀 | `handleSparkClick` | `sparkClick` |
| 子组件回调 props | `on` 前缀 | `onOpenFile` | `openFileHandler` |
| 类型导入 | `import type` | `import type { Work }` | `import { Work }` |

- 集合 / 配置类常量（对象、数组）保持 `camelCase` 或 `PascalCase`，不强制 `CONSTANT_CASE`：

```ts
const NO_WORKS: OwnedWork[] = [];
const SWR_CONFIG = { dedupingInterval: 2000 };
```

### 2.3 布尔值命名

- 状态类布尔用 `is` / `has` / `can` 前缀；一次性判断（如 `sparked`、`dirty`）可保持名词/形容词，但同一组件内保持一致。

## 3. 类型

### 3.1 禁止项

- **禁止 `any`**。无法确定类型时用 `unknown`，并在使用时收窄。

```ts
const value: any = getValue();   // 错误
const value: unknown = getValue();
if (typeof value === "string") {
    console.log(value.length);
}
```

- **禁止非空断言 `!`**。用控制流收窄或显式判空替代。

```ts
const name = user!.name;          // 错误
if (!user) return;
const name = user.name;
```

- 禁止 `@ts-ignore` 一类指令绕过类型检查；确有需要时用 `@ts-expect-error` 并保证下一行确实报错。

### 3.2 对象类型

- 对象形状优先使用 `type` 别名（与现有代码主流一致）；`interface` 仅用于需要声明合并的公开 API。
- 联合、交叉、工具类型（`Pick`、`Omit` 等）只能使用 `type`。

```ts
type ReplyTarget = { rootId: string; name: string };
type RuntimeInfo = { language: Language; entryPoint: string };
type NotificationGroup = {
    key: string;
    label: string;
    items: AppNotification[];
};
```

### 3.3 枚举

- 不使用 `enum`，用**字符串字面量联合类型**替代。

```ts
enum Sort { Latest, Hot }        // 错误
type WorkSort = "latest" | "hot" | "views";
```

### 3.4 类型导入

- 纯类型一律用 `import type` / `export type`，与值导入分句。

```ts
import { useWorkFiles } from "~/hooks/useWorkFiles";
import type { WorkFile } from "~/lib/api";

export type { WorkSort };        // 类型导出用 export type
```

### 3.5 可空性

- 可缺失的字段用可选属性 `?`；显式的"空值"语义用 `null`。
- 联合中的空值类型（`T | null`）比隐式 `undefined` 更明确。

```ts
type Snapshot = {
    content: string;   // 必有
    encoding?: string; // 可缺
};
```

### 3.6 返回类型

- 导出函数、公开 API 显式标注返回类型；内部函数可依赖推导。

```ts
export function detectRuntime(names: string[]): RuntimeInfo | null {
```

- 类型参数（泛型）用大写单字母 `T`、`V`，语义明确时可使用描述性名称。

## 4. 导入

### 4.1 排序

- 由 biome `organizeImports` 自动排序，禁止手排。
- 语义分组（组间空行）：外部包 → `@nextcoding/*` → `~/` 别名 → 相对路径。

```ts
import { toast } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "~/hooks/useAuth";
import type { Work } from "~/lib/api";

import { ConfirmButton } from "./ConfirmButton";
```

### 4.2 导出

- 仅使用**命名导出**，禁止 `export default`。
- 例外：配置文件（`*.config.ts`）——Vite、drizzle-kit 等工具按约定读取默认导出。
- 未使用的导入必须删除（biome 强制）。

## 5. 错误处理

### 5.1 异步操作

- 所有异步写入（POST / PUT / PATCH / DELETE）必须 `try / catch`，失败不得静默。

```ts
try {
    await publishWork(workId);
    await mutate(workPath(workId));
    toast.success("作品已发布");
} catch (error) {
    toast.danger((error as Error).message);
}
```

- 用户可感知的失败必须给出反馈，统一用 `toast.danger` / `toast.warning` / `toast.success`。

### 5.2 状态复位

- 涉及 loading 状态的操作，在 `finally` 中复位，避免按钮永久禁用。

```ts
setIsCreating(true);
try {
    const { id } = await createWork("未命名作品");
    await mutateMyWorks();
    navigate({ to: "/work/$id/edit", params: { id } });
} catch (err) {
    toast.danger((err as Error).message);
} finally {
    setIsCreating(false);
}
```

### 5.3 后台任务

- 防抖保存、轮询等允许"静默失败"的场景，内部必须兜底错误（try/catch），不得向调用方抛出未处理拒绝。

## 6. 数据获取（SWR）

1. 数据读取**一律使用 SWR**，禁止手写 `useEffect + fetch + useState`。
2. SWR 缓存 key 统一由 `lib/api` 导出的 key 工厂产生，禁止在调用处内联拼 key。

```ts
export function useFileContent(workId: string, key: string | null) {
    return useSWR(key === null ? null : fileContentPath(workId, key), () =>
        readFileContent(workId, key as string),
    );
}
```

3. 写入成功后通过 `mutate` 失效或更新受影响缓存；需要立即反映新值且可本地推导时，用 `mutate(key, updater, false)`。

```ts
mutate(
    workPath(workId),
    (current) => (current ? { ...current, sparks: current.sparks + 1 } : current),
    false,
);
```

4. 全局 SWR 行为（去重、重试、`keepPreviousData`）统一在 `main.tsx` 的 `SWRConfig` 配置，不在各 hook 内散落。
5. 用户维度的数据（我的作品、通知、未读数）key 中带上用户 id，避免切换账号串数据。

## 7. React 组件

### 7.1 组件定义

- 使用**函数组件** + 命名导出。
- 重型或频繁重渲染的组件用 `memo` 包裹。

```tsx
export const WorkCard = memo(function WorkCard({ work }: { work: Work }) {
```

- 单个组件函数体超过约 **150 行**时拆分：交互逻辑抽 hook，JSX 区块抽子组件。

### 7.2 Props

- props 类型命名为 `XxxProps`，用 `type` 定义。

```tsx
interface FileExplorerProps {   // 与既有代码保持一致也可
    files: WorkFile[];
    activeKey: string | null;
}
```

- 回调 props 以 `on` 开头；布尔开关以 `is` / `can` 开头。

### 7.3 Hooks

- 只在组件顶层调用 hooks，禁止条件调用。
- 交互逻辑（事件处理、登录守卫、提交校验）抽入 `use*` hooks，组件保持可读。

```tsx
const { sparked, count, handleSparkClick } = useWorkCardSpark(work);
```

- 派生值用 `useMemo` 在渲染期计算，**不在 `useEffect` 里同步状态**。

```tsx
const runtime = useMemo(
    () => detectRuntime(files.map((file) => file.name)),
    [files],
);
```

- `useEffect` 只用于副作用（订阅、联动外部系统），依赖数组必须准确。

### 7.4 状态

- 状态最小化：能从 props / 已有状态推导的值不要额外存储。
- 多次连续更新同一状态时使用**函数式 setState**。

```ts
setCount((current) => current + 1);
```

## 8. 性能

- 列表渲染必须提供稳定、唯一的 `key`。
- 大开销计算用 `useMemo`，稳定回调用 `useCallback`；简单推导不需要 memo。
- **禁止在组件内定义组件**（每次渲染都会重建类型与实例）。

```tsx
function Parent() {
    function Child() {}   // 错误：每次渲染重建
    return <Child />;
}
```

- 长列表考虑分页或虚拟滚动；网络请求结果一律走 SWR 缓存。

## 9. 项目结构

- 请求层集中 `lib/api/*`，所有 HTTP 经由 `lib/api/http.ts` 的封装函数，禁止组件内裸 `fetch`。
- 通用逻辑放 `lib/`，可复用状态逻辑放 `hooks/`，页面专属组装放 `routes/`。
- 一个模块一个职责；文件过大的模块按功能拆分（如 `components/workDetail/`、`components/messages/`）。

## 10. 提交前验证

```bash
bunx biome check apps packages
bunx biome check --write --unsafe apps packages

cd apps/web && bun node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
cd apps/server && bun node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

- biome：142 个文件，必须 0 报错。
- tsc：web 与 server 均必须退出码 0。
- 两条都通过才可提交。
