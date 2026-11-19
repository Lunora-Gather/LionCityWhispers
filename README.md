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

- **3D 微缩探索世界 (Singapore River Living Diorama)**：Three.js 实时水动力学新加坡河（Gerstner 波浪、船行 Kelvin 尾迹与岸线泡沫）、三段式人偶步态漫步与水波涟漪、晨曦/黄昏/夜色昼夜光影切换、微缩全景俯瞰、鱼尾狮/加文纳桥/百年榕树/殖民时期博物馆等河岸地标，以及河岸茶客、船夫苦力与野生水獭/白鹭/锦鲤生态景观。
- **3D 全息文物鉴赏与解构修复室 (Three.js WebGL)**：真三维 PBR 物理光影建模、360° 轨道自由翻转、多波段考古荧光透视模式（UV 探测）、三维解构展开（Exploded View）与声波共振轻敲回响。
- **3D 机械重铸解谜工坊 (3D WebGL Interactive Workshop)**：
  - **古石重铸**：三维空间旋转断裂残片，对准 Altar 底座插槽卡合定位，触发金缮流光自愈裂痕。
  - **青铜密码筒**：真三维圆柱形四联铜环旋转拨动，在中央光学基准线上对齐「海门星图」航海秘语。
  - **浑天秘匣**：三层同心黄铜齿轮环微调旋转对准星宿，触发联动机械啮合，四角液压锁舌自动缩回解脱。
- **双模解谜体验**：无缝支持高精 3D 实体机械工坊交互与便捷 2D 快捷触控/键盘解密，满足全平台不同操作偏好。
- **高动态节奏大典**：Marvelous/Perfect/Good/Miss 多级判定、连击狂热共鸣状态（Combo Fever）、震屏与粒子光波打击反馈。
- **五星级皇家国家博物院策展系统**：展台全息投影底座、风水流向评价体系、游客闪光灯与历史名流评鉴。
- 探索式主场景与 NPC 对话，支持自定义按键与双语自由切换。
- 情境提示、存档导入导出、图鉴和进度管理。
- 桌面、移动端横屏与 PWA 离线支持。
- Reduce Motion、音量控制、触控操作和清晰焦点状态。

## 操作

| 场景 | 默认操作 |
| --- | --- |
| 移动 | `W` `A` `S` `D`、方向键或屏幕方向键 |
| 交互 | `Space` 或屏幕交互键 |
| 3D 微缩世界 | 顶部工具栏 3D 探索按钮 / 鼠标左键拖拽环视 / 滚轮缩放 / 点击地面寻路 / `WASD` 移动 |
| 三维全息鉴赏 | 顶部工具栏 3D 按钮 / 点击背包文物 / 鼠标拖拽 360° 旋转 |
| 3D 机械工坊 | 谜题场景内【3D机械工坊】按钮 / 顶部工具栏工坊按钮 |
| 经典解谜 | 鼠标点击、触控或数字键 `1`–`4` |
| 节奏仪式 | `A` `S` `D` `F` 或屏幕节奏键 |
| 提示 | 顶部灯泡按钮 |

所有主要按键都可以在设置中重新绑定。

## 技术栈

- Next.js 16、React 19、TypeScript
- Three.js（三维 PBR 全息建模与 WebGL 视界）
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

本地浏览器回归默认使用 WebKit，CI 使用 WebKit 和 Chromium 跑同一套用例。

```bash
npx playwright install webkit
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
