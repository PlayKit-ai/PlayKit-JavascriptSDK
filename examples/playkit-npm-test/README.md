# 贪吃蛇诗歌创作游戏

一个结合经典贪吃蛇游戏和 AI 诗歌创作的创意游戏，使用 p5.js 和 playkit-sdk 构建。

## 游戏特色

- 🐍 经典贪吃蛇玩法
- 🍎 场上同时存在 10 个食物，主动选择吃哪个！
- 🎨 橙色食物带有汉字，红色食物是普通食物
- ⏰ 30秒限时挑战
- 📝 AI 自动将收集的汉字创作成诗歌
- 🎮 流畅的游戏体验

## 游戏玩法

1. **开始游戏**: 按空格键开始
2. **控制蛇**: 使用方向键控制蛇的移动方向
3. **选择食物**: 场上有 10 个食物，你可以主动选择吃哪个
   - 🟠 **橙色食物**: 带有汉字，收集它们来创作诗歌
   - 🔴 **红色食物**: 普通食物，只增加蛇的长度
4. **策略选择**: 优先吃带汉字的食物，收集更多诗意词汇
5. **时间限制**: 游戏持续 30 秒
6. **AI 作诗**: 时间结束后，AI 会用收集的汉字创作一首诗

## 安装步骤

1. 安装依赖：
```bash
npm install
```

2. 配置凭证：
   - 打开 `game.js` 文件
   - 将 `your-game-id` 替换为你的实际 Game ID
   - 将 `dev-token-xxxxx` 替换为你的实际 Developer Token
   - 从 [https://playkit.ai](https://playkit.ai) 获取凭证

3. 运行游戏：
```bash
npm start
```

4. 在浏览器中打开：
```
http://localhost:8080
```

## 游戏控制

| 按键 | 功能 |
|------|------|
| 空格键 | 开始/重新开始游戏 |
| ↑ 上方向键 | 向上移动 |
| ↓ 下方向键 | 向下移动 |
| ← 左方向键 | 向左移动 |
| → 右方向键 | 向右移动 |

## 游戏规则

- 蛇会持续向前移动
- 场上同时存在 10 个食物，可以选择吃哪个
- 吃到食物后蛇会变长，并立即生成新食物
- 橙色食物带有汉字（50%概率），红色食物是普通食物
- 撞到墙壁或自己会游戏结束
- 游戏时长为 30 秒
- 时间结束后会自动生成诗歌
- 策略提示：优先吃带汉字的橙色食物！

## 技术实现

- **p5.js**: 游戏渲染引擎
- **PlayKit SDK**: AI 诗歌生成
- **ChatClient**: 使用 `gpt-4o-mini` 模型生成诗歌
- **默认模型**: GPT-4o-mini（高性价比，适合创意生成）
- **流式响应**: 实时显示 AI 创作过程

## 汉字词库

游戏包含 80 个精选的诗意汉字，涵盖：
- 四季：春、夏、秋、冬
- 自然：山、水、天、地、风、雨、雪、云
- 植物：花、树、竹、梅、兰、菊
- 颜色：红、绿、青、白、黄、紫
- 方位：东、西、南、北、上、下
- 文艺：诗、词、歌、赋、琴、棋、书、画
- 情感：梦、情、思、念、心、意、缘、爱

## 自定义

### 修改游戏时长

在 `game.js` 中修改：
```javascript
let gameDuration = 30000; // 毫秒，30000 = 30秒
```

### 修改场上食物数量

在 `game.js` 中修改：
```javascript
let maxFoods = 10; // 场上最多同时存在的食物数量，可改为 15、20 等
```

### 修改汉字出现概率

在 `spawnFood()` 函数中修改：
```javascript
char: random() < 0.5 ? random(chineseChars) : '' // 0.5 = 50%概率
```

### 添加更多汉字

在 `chineseChars` 数组中添加你喜欢的汉字：
```javascript
const chineseChars = [
  '春', '夏', '秋', '冬', // ... 添加更多
];
```

### 调整诗歌风格

修改 `endGame()` 函数中的 AI prompt：
```javascript
const prompt = `请使用以下汉字创作一首古诗...`; // 自定义提示词
```

### 更换 AI 模型

在 `initializeSDK()` 函数中修改模型：
```javascript
chatClient = sdk.createChatClient('gpt-4o-mini'); // 默认模型

// 其他可选模型：
// chatClient = sdk.createChatClient('gpt-4o');      // 更强大但更贵
// chatClient = sdk.createChatClient('gpt-4');       // GPT-4 经典版
// chatClient = sdk.createChatClient('gpt-3.5-turbo'); // 最便宜
```

## 故障排除

- **"Please edit game.js..."**: 需要配置 Game ID 和 Developer Token
- **SDK 初始化失败**: 检查凭证和网络连接
- **npm start 不工作**: 全局安装 http-server: `npm install -g http-server`
- **汉字显示为方块**: 确保浏览器支持中文字体

## 游戏截图说明

### 开始界面
显示游戏标题、规则说明和初始化状态

### 游戏界面
- 左侧：贪吃蛇游戏区域（28x28 格子）
- 右侧：游戏信息
  - 倒计时（最后5秒会变红色）
  - 蛇的长度
  - 收集的汉字列表
  - 控制说明

### 诗歌展示界面
游戏结束后展示 AI 创作的诗歌

## 学习资源

- [PlayKit SDK 文档](https://docs.playkit.ai)
- [p5.js 教程](https://p5js.org/tutorials)
- [贪吃蛇游戏算法](https://en.wikipedia.org/wiki/Snake_(video_game_genre))

## 创意扩展

你可以尝试：
- 添加难度等级（蛇速度变化）
- 添加特殊食物（额外时间、双倍汉字）
- 保存优秀诗作到本地存储
- 添加背景音乐和音效
- 多人竞技模式
- 诗歌分享功能

祝你玩得开心！🎮🐍📝
