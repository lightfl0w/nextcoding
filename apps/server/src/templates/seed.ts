export interface TemplateSeed {
    title: string;
    description: string;
    category: string;
    tags: string[];
    snapshotKey: string;
    snapshot: {
        version: number;
        files: Array<{
            name: string;
            content: string;
            contentType: string;
        }>;
    };
}

export const TEMPLATE_SEEDS: TemplateSeed[] = [
    {
        title: "空白项目",
        description: "从零开始，自由创作",
        category: "basic",
        tags: ["空白", "入门"],
        snapshotKey: "templates/basic-blank/snapshot.json",
        snapshot: {
            version: 1,
            files: [
                {
                    name: "README.md",
                    content: "# 我的项目\n\n在这里开始你的创作！\n",
                    contentType: "text/markdown",
                },
            ],
        },
    },
    {
        title: "HTML/CSS 网页",
        description: "基础 HTML + CSS 网页模板",
        category: "web",
        tags: ["HTML", "CSS", "网页"],
        snapshotKey: "templates/web-html-css/snapshot.json",
        snapshot: {
            version: 1,
            files: [
                {
                    name: "index.html",
                    content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>我的网页</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>你好，世界！</h1>
    <p>这是一个简单的 HTML/CSS 网页。</p>
</body>
</html>`,
                    contentType: "text/html",
                },
                {
                    name: "style.css",
                    content: `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #f5f5f5;
}

h1 {
    color: #333;
    margin-bottom: 1rem;
}

p {
    color: #666;
}`,
                    contentType: "text/css",
                },
            ],
        },
    },
    {
        title: "Python 算法",
        description: "Python 算法练习模板",
        category: "algorithm",
        tags: ["Python", "算法"],
        snapshotKey: "templates/algorithm-python/snapshot.json",
        snapshot: {
            version: 1,
            files: [
                {
                    name: "main.py",
                    content: `def two_sum(nums: list[int], target: int) -> list[int]:
    """找出数组中和为目标值的两个数的索引。"""
    seen: dict[int, int] = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []


if __name__ == "__main__":
    nums = [2, 7, 11, 15]
    target = 9
    result = two_sum(nums, target)
    print(f"输入: nums={nums}, target={target}")
    print(f"输出: {result}")
`,
                    contentType: "text/x-python",
                },
            ],
        },
    },
    {
        title: "JavaScript 小游戏",
        description: "用 JavaScript 制作简单小游戏",
        category: "game",
        tags: ["JavaScript", "游戏"],
        snapshotKey: "templates/game-js/snapshot.json",
        snapshot: {
            version: 1,
            files: [
                {
                    name: "index.html",
                    content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>猜数字游戏</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 2rem; background: #1a1a2e; color: #eee; }
        h1 { margin-bottom: 1rem; }
        input { padding: 0.5rem; font-size: 1.2rem; width: 80px; text-align: center; }
        button { padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; margin: 0.5rem; }
        #message { margin-top: 1rem; font-size: 1.2rem; min-height: 2rem; }
    </style>
</head>
<body>
    <h1>猜数字游戏</h1>
    <p>我想了一个 1~100 的数字，猜猜看？</p>
    <input type="number" id="guess" min="1" max="100">
    <button onclick="checkGuess()">猜！</button>
    <button onclick="resetGame()">重新开始</button>
    <p id="message"></p>
    <p>猜测次数: <span id="attempts">0</span></p>
    <script>
        let answer = Math.floor(Math.random() * 100) + 1;
        let attempts = 0;

        function checkGuess() {
            const input = document.getElementById('guess');
            const msg = document.getElementById('message');
            const guess = parseInt(input.value);

            if (isNaN(guess) || guess < 1 || guess > 100) {
                msg.textContent = '请输入 1~100 之间的数字';
                return;
            }

            attempts++;
            document.getElementById('attempts').textContent = attempts;

            if (guess === answer) {
                msg.textContent = '恭喜你猜对了！';
            } else if (guess < answer) {
                msg.textContent = '太小了，再大一点！';
            } else {
                msg.textContent = '太大了，再小一点！';
            }
        }

        function resetGame() {
            answer = Math.floor(Math.random() * 100) + 1;
            attempts = 0;
            document.getElementById('attempts').textContent = 0;
            document.getElementById('message').textContent = '';
            document.getElementById('guess').value = '';
        }
    </script>
</body>
</html>`,
                    contentType: "text/html",
                },
            ],
        },
    },
];
