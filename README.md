# 狮城秘语 | Lion City Whispers

<p align="center">
  <img src="public/assets/images/world-cinematic-v3.webp" alt="Lion City Whispers Banner" width="100%" style="border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.4);" />
</p>

<p align="center">
  <strong>Version 1.0.0 Stable Release</strong><br />
  A playable browser-based narrative game blending puzzles, rhythm ritual, and museum curation to restore the lost legends of Lion City.
</p>

<p align="center">
  <a href="https://lunora-gather.github.io/LionCityWhispers/"><strong>🎮 立即试玩 / Play Now</strong></a> · 
  <a href="https://github.com/Lunora-Gather/LionCityWhispers"><strong>📁 仓库地址 / Repository</strong></a>
</p>

---

## 📖 游戏简介 | About The Game

**《狮城秘语》（Lion City Whispers）** 是一款基于 Web 端、运行于浏览器的沉浸式叙事解谜游戏。玩家将扮演一名博物馆馆长，穿梭于新加坡河畔与神秘的灵界之间，寻找并修复散落的四件古老文物碎片，最终在博物馆展厅中完成策展，唤醒沉睡的城市记忆。

**Lion City Whispers** is a browser-based narrative exploration game. Players take on the role of a curator, traveling between the historical Singapore riverbank and the spiritual realm to locate and restore four legendary artifacts, culminating in a museum exhibition that revives the city's ancient stories.

---

## ✨ 游戏特色 | Core Features

### 🗺️ 沉浸式场景探索 | Immersive Exploration
- 在精美的写意画风场景中移动，支持键盘、鼠标和触控屏操作。
- 精致的馆长对话系统，提供实时的当前目标指引（Current Objective）。

### 🧩 互动文物解谜 | Interactive Artifact Puzzles
- **巴当巨石 (Badang Stone)**：还原破碎的石碑，拼凑远古力量的印记。
- **古老符文 (Rune Plaque)**：按正确顺序排列神秘符号，解读失传的历史。
- **海门古钥 (Harbor Seal)**：解锁精密的机关锁扣，揭开贸易港口的封尘往事。

### 🥁 灵界仪式节奏 | Rhythm Ritual
- 4 轨道传统打击乐仪式，支持 **标准模式** 与 **简易模式**。
- 支持自定义按键映射，配以炫丽的粒子反馈和慢速判定缓冲。

### 🏛️ 博物馆策展 | Museum Curation Finale
- 在展厅中自由放置已修复的文物，吸引游客并获得策展评分。
- 完成全部主线可解锁四大独特成就，达成完美的 1.0.0 结局。

### 🌐 完整双语与持久化 | Bilingual & Persistence
- 中英双语全覆盖，包括线索册、关卡文本、操作提示和界面设置。
- 内置自动存档，支持音量调节、动作减弱（Reduce Motion）等无障碍选项。

---

## 🛠️ 技术栈 | Technology Stack

- **前端框架**：[Next.js 16 (Pages Router)](https://nextjs.org/) + [React 19](https://react.dev/)
- **游戏引擎**：[Phaser 4 (Beta/Latest)](https://phaser.io/)
- **样式系统**：Vanilla CSS (配备高级磨砂玻璃拟态 `Glassmorphism` 与流畅的流光动画)
- **自动化测试**：[Playwright](https://playwright.dev/) (21 项全量 E2E 布局与交互回归测试)
- **运行环境**：Service Worker 缓存 (支持离线游玩与 PWA 渐进式应用)

---

## 🚀 快速开始 | Quick Start

### 1. 本地开发调试 | Local Development

确保您的系统已安装 [Node.js](https://nodejs.org/) (建议 v18+)。

```bash
# 安装项目依赖
npm install

# 启动本地开发服务器
npm run dev
```

启动后，在浏览器中打开：
```text
http://127.0.0.1:3000
```

*注：本地开发模式下默认关闭了 Service Worker 缓存，以避免调试时代码未更新。若需测试离线/PWA 流程，请访问：*
```text
http://127.0.0.1:3000/?pwa=1
```

### 2. 质量守卫与审计 | Quality Gate

在提交和发布前，运行全量代码与资源质量审计：

```bash
npm run check
```

此命令将自动执行以下流水线：
1. **Next.js 构建**：编译 TypeScript 并生成优化后的静态页面。
2. **自动化测试**：运行 21 项 Playwright 回归测试，检查性能及多端适配。
3. **资源审计**：确保图片体积限制在 2.2MB 内，音频限制在 120KB 内。
4. **安全漏洞审计**：使用 npm audit 进行依赖项漏洞扫描。

---

## 📦 部署与版本控制 | Deployment & Releases

### 静态导出配置 (GitHub Pages)
本项目已预配置 GitHub Actions 自动化部署流水线（可在 [.github/workflows/pages.yml](file:///.github/workflows/pages.yml) 查看）。

若要在本地执行静态导出，可运行：
```powershell
$env:GITHUB_PAGES="1"
$env:GITHUB_PAGES_REPO="LionCityWhispers"
npm run build:pages
```

### 离线与更新策略
游戏集成了一款轻量级的 Service Worker。当游戏更新发布时，系统会自动在后台拉取新资源，并在顶部弹出 **"更新就绪"** 的通知横幅，点击后即可无缝升级。

---

## 🎨 资源版权声明 | Assets & Rights

- 本项目中所使用的美术资源、音效音频以及关卡配置，均为本项目专有。
- 本游戏完全免费，不包含任何第三方广告、付费流程或隐私追踪代码。
