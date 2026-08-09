# 狮城秘语 · Lion City Whispers

<p align="center">
  <img src="public/assets/images/world-cinematic-v3.webp" alt="《狮城秘语》游戏场景" width="100%" />
</p>

<p align="center">
  一款以新加坡城市传说为灵感的双语浏览器叙事解谜游戏。<br />
  Explore the riverbank, restore lost artifacts, complete a rhythm ritual, and curate the final exhibition.
</p>

<p align="center">
  <a href="https://lunora-gather.github.io/LionCityWhispers/"><strong>立即进入网页版游戏 / Play Now</strong></a>
  ·
  <a href="https://github.com/Lunora-Gather/LionCityWhispers/actions/workflows/pages.yml">部署状态</a>
</p>

## 游戏内容

玩家将扮演博物馆馆长林，在河岸与灵界之间寻找失落文物，并把修复后的故事带回博物馆。

- 探索式主场景与 NPC 对话
- 石碑拼合、古文排序和限时机关锁
- 四轨节奏仪式，支持简易模式与自定义按键
- 可拖放、可点击、可键盘操作的博物馆策展终章
- 中文与 English 完整双语界面
- 情境提示、存档导入导出、图鉴和进度管理
- 桌面、移动端横屏与 PWA 离线支持
- Reduce Motion、音量控制、触控操作和清晰焦点状态

## 操作

| 场景 | 默认操作 |
| --- | --- |
| 移动 | `W` `A` `S` `D`、方向键或屏幕方向键 |
| 交互 | `Space` 或屏幕交互键 |
| 解谜 | 鼠标、触控或数字键 `1`–`4` |
| 节奏仪式 | `A` `S` `D` `F` 或屏幕节奏键 |
| 提示 | 顶部灯泡按钮 |

所有主要按键都可以在设置中重新绑定。

## 技术栈

- Next.js 16、React 19、TypeScript
- Phaser 4
- 原生 CSS 响应式 HUD
- Playwright 端到端测试
- Web App Manifest 与 Service Worker
- GitHub Actions 与 GitHub Pages

## 本地运行

需要 Node.js 24。

```bash
npm ci
npm run dev
```

访问 `http://127.0.0.1:3019`。

开发模式默认不启用 Service Worker。需要验证 PWA 缓存时，可访问：

```text
http://127.0.0.1:3019/?pwa=1
```

## 质量检查

```bash
npm run check
```

完整检查包含 TypeScript、生产构建、Playwright 回归测试、游戏资源审计和依赖安全审计。也可以单独运行：

```bash
npm run typecheck
npm run build
npm run test:ci
npm run audit:game
```

## 项目结构

```text
.
├── .github/workflows/       # CI 与 GitHub Pages 部署
├── public/
│   ├── assets/images/       # 场景、人物和文物图像
│   ├── assets/audio/        # 交互与仪式音效
│   └── sw.js                # 离线缓存
├── scripts/                 # 资源生成与发布审计
├── src/
│   ├── components/          # React 游戏外壳、HUD 与设置
│   ├── data/                # 双语文本、谜题与节奏谱面
│   ├── game/                # Phaser 场景、玩法、提示和状态
│   ├── pages/               # Next.js 页面入口
│   └── styles/              # 基础、体验与视觉重构样式
└── tests/                   # Playwright 端到端回归测试
```

## 部署

推送到 `main` 后，[Deploy GitHub Pages](.github/workflows/pages.yml) 会自动执行资源审计、静态导出并部署到 GitHub Pages。

如需在本地验证 Pages 静态导出：

```powershell
$env:GITHUB_PAGES="1"
$env:GITHUB_PAGES_REPO="LionCityWhispers"
npm run build:pages
```

生成结果位于 `out/`，该目录不会提交到仓库。

## 资源与隐私

游戏不包含广告、付费流程或第三方行为追踪。仓库中的美术、音频、关卡和文案资源用于本项目。
