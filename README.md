# 狮城秘语 | Lion City Whispers

<p align="center">
  <img src="public/assets/images/world-cinematic-v3.webp" alt="Lion City Whispers Banner" width="100%" style="border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.4);" />
</p>

<p align="center">
  <strong>Version 1.0.0 Stable Release</strong><br />
  一款可直接在浏览器中游玩的双语叙事解谜游戏：探索狮城传说，修复文物，完成灵界仪式，并策划最终博物馆展览。<br />
  A bilingual browser narrative game about restoring Lion City legends through puzzles, rhythm ritual, and museum curation.
</p>

<p align="center">
  <a href="https://lunora-gather.github.io/LionCityWhispers/"><strong>🎮 立即进入网页版游戏 / Play Now</strong></a> ·
  <a href="https://github.com/Lunora-Gather/LionCityWhispers"><strong>📁 仓库地址 / Repository</strong></a> ·
  <a href=".github/workflows/pages.yml"><strong>🚀 部署流程 / Pages Workflow</strong></a>
</p>

---

## 📖 游戏简介 | About

**《狮城秘语》（Lion City Whispers）** 是一款 Web 端沉浸式叙事解谜游戏。玩家扮演一名博物馆馆长，在新加坡河畔、神秘灵界与博物馆展厅之间穿梭，寻找并修复散落的古老文物碎片，最终完成策展并唤醒城市记忆。

**Lion City Whispers** is a browser-based narrative exploration game. You play as a museum curator, travel between the Singapore riverbank, the spiritual realm, and the museum gallery, restore legendary artifacts, and complete an exhibition that revives the city's forgotten stories.

---

## ✨ 核心特色 | Core Features

- **沉浸式场景探索**：写意电影感场景、实时当前目标提示、馆长对话引导。
- **互动文物解谜**：包含巴当巨石、古老符文、海门古钥等文物修复关卡。
- **灵界仪式节奏玩法**：4 轨道节奏判定，支持标准模式与简易模式。
- **博物馆策展终章**：自由放置修复文物，吸引游客并获得策展评分。
- **完整双语体验**：中文/英文界面、线索、目标、设置与文物图鉴。
- **PWA 与离线支持**：Service Worker 缓存关键资源，支持安装到桌面/移动端。
- **无障碍与体验设置**：音量、静音、动作减弱、自定义按键、触控操作。
- **响应式布局优化**：桌面端 HUD 分区更清晰，移动端支持安全区域、横竖屏和触控按钮。

---

## 🎮 操作方式 | Controls

| 操作 | 默认按键 / 方式 |
| --- | --- |
| 移动 | `W` `A` `S` `D` / 屏幕方向键 |
| 交互 | `Space` / 屏幕圆形交互键 |
| 节奏轨道 | `A` `S` `D` `F` / 屏幕节奏按钮 |
| 打开图鉴 | 顶部书本按钮 |
| 暂停 / 音频 / 设置 | 顶部工具栏按钮 |
| 重置进度 | 顶部重置按钮，二次确认后生效 |

> 按键可在游戏内设置面板中重新绑定。

---

## 🛠️ 技术栈 | Technology Stack

- **Framework**: Next.js 16 + React 19 + Pages Router
- **Game Engine**: Phaser 4
- **Language**: TypeScript, React TSX
- **Styling**: Vanilla CSS, glassmorphism HUD, responsive layout polish
- **Testing**: Playwright E2E tests
- **PWA**: Web App Manifest + Service Worker runtime cache
- **Deployment**: GitHub Actions + GitHub Pages static export

---

## 📁 项目结构 | Project Structure

```text
.
├── .github/workflows/pages.yml   # GitHub Pages 自动部署流程
├── public/                       # 图标、manifest、Service Worker、图片与音频资源
├── scripts/                      # 音频生成与游戏资源审计脚本
├── src/
│   ├── components/               # React 外壳与 HUD 面板
│   ├── data/                     # 文案、双语文本、图鉴数据
│   ├── game/                     # Phaser 场景、玩法与引导逻辑
│   ├── pages/                    # Next.js 页面入口
│   ├── styles/                   # 全局样式与布局优化样式
│   └── utils/                    # 路径、资源与通用工具
├── tests/                        # Playwright 回归测试
├── next.config.mjs               # 本地与 GitHub Pages 构建配置
└── package.json                  # 项目脚本与依赖版本
```

---

## 🚀 快速开始 | Quick Start

### 1. 环境要求 | Requirements

建议使用 **Node.js 24**，与 GitHub Actions 部署环境保持一致。

### 2. 本地开发 | Local Development

```bash
npm install
npm run dev
```

启动后打开：

```text
http://127.0.0.1:3000
```

本地开发默认关闭 Service Worker 缓存，避免调试时旧资源残留。如需测试 PWA/离线缓存：

```text
http://127.0.0.1:3000/?pwa=1
```

### 3. 质量检查 | Quality Gate

```bash
npm run check
```

该命令会依次执行：

1. `npm run build`：Next.js 构建检查。
2. `npm run test`：Playwright 端到端测试。
3. `npm run audit:game`：资源、README、manifest、Service Worker 与依赖版本审计。
4. `npm run audit:security`：中等及以上级别安全审计。

---

## 📦 构建与部署 | Build & Deployment

### 本地静态导出 | Local GitHub Pages Build

Windows PowerShell:

```powershell
$env:GITHUB_PAGES="1"
$env:GITHUB_PAGES_REPO="LionCityWhispers"
npm run build:pages
```

macOS / Linux:

```bash
GITHUB_PAGES=1 GITHUB_PAGES_REPO=LionCityWhispers npm run build:pages
```

### 自动部署 | Automatic Deployment

推送到 `main` 后，`.github/workflows/pages.yml` 会自动：

1. 使用 Node 24 安装依赖；
2. 执行 `npm run build:pages`；
3. 写入 `out/.nojekyll`；
4. 上传静态产物并部署到 GitHub Pages。

---

## 🧪 资源与质量约束 | Quality Budgets

项目内置 `scripts/audit-game.mjs`，用于保证资源和发布质量：

- 必需图片、音频、图标、manifest、robots 与 sitemap 资源必须存在；
- 图片总体积不得超过 `2.2MB`；
- 音频总体积不得超过 `120KB`；
- `robots.txt` 必须允许 GitHub Pages base path，并指向公开 sitemap；
- 直接依赖必须固定版本，不能使用 `latest`、`^` 或 `~`；
- README 顶部必须保留网页版游戏入口，且不能出现本地 `file://` 链接；
- Service Worker 缓存名必须带数字版本，并缓存关键资源；
- 源码中禁止遗留 `TODO`、`FIXME`、`@ts-ignore` 等发布前标记。

---

## ♿ 适配与无障碍 | Accessibility & Device Support

- 支持键盘、鼠标与触控操作；
- 支持中文 / English 切换；
- 支持静音、主音量、音效音量、环境音量调整；
- 支持 Reduce Motion，降低动画干扰；
- 支持移动端横屏优先的 PWA 体验；
- HUD、背包、路线进度与设置面板已针对桌面、平板、手机布局优化。

---

## 🧭 当前优化方向 | Current Optimization Focus

- 保持游戏核心玩法稳定，不随意改动 Phaser 场景逻辑；
- 优先优化布局、触控体验、可读性、加载体验与 PWA 细节；
- 每次改动尽量保持可审查、可回滚，并通过 `npm run check` 验证。

---

## 🎨 资源版权声明 | Assets & Rights

- 本项目中使用的美术资源、音效音频以及关卡配置均为本项目专有。
- 本游戏完全免费，不包含第三方广告、付费流程或隐私追踪代码。
