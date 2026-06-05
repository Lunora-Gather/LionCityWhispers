# 狮城秘语

《狮城秘语》是一个 Web 浏览器原型：玩家扮演博物馆策展人，在现代狮城与灵界之间探索、解谜、完成节奏仪式，并把文物带回博物馆布展。

## 运行

```powershell
npm install
npm run dev
```

打开 http://127.0.0.1:3000。

项目文件夹只保留源码、必要资产和配置，不保留也不上传 `node_modules`、构建产物或测试报告。首次运行或清理依赖后先执行 `npm install`。

## 网页访问

GitHub Pages 地址：

https://wangjiehu.github.io/LionCityWhispers/

仓库地址：

https://github.com/wangjiehu/LionCityWhispers

## 验证

```powershell
npm run check
```

`check` 会依次执行生产构建、Playwright 回归和本地资产/发布面审计。

## 资产

```powershell
npm run assets:audio
```

该命令会重新生成 `public/assets/audio` 下的短音效 WAV。图片实际运行使用 WebP。

## 当前可玩内容

- 探索地图与 NPC 对话
- 巴当巨石碎片拼合
- 古文字符文排序
- 海门机关顺序解锁
- 四轨节奏仪式
- 文物拖放布展与通关结算
- 中英文界面、图鉴、目标、场景文案切换
- 存档、设置、章节回访、低动效、音量和 PWA 缓存

## 体验与可访问性

- 支持键盘、鼠标和移动端触控。
- 世界移动、交互键和四轨节奏键都可以在设置中重绑定；同组重复键会自动交换，避免操作丢失。
- 打开设置、图鉴或重置确认时，游戏输入会被锁定；节奏和倒计时不会在面板打开时继续惩罚玩家。
- 设置包含声音、辅助、性能、控制和章节回访分组。
- 本地性能面板显示 FPS、长帧、本地响应和最差响应；这些是开发侧近似指标，不等同于线上真实 INP。

## PWA 与离线

- `public/manifest.webmanifest` 提供 standalone 安装信息和 192/512 图标。
- `public/sw.js` 预缓存核心图片、音频、图标和首页；离线时会回退到缓存首页。
- Service Worker 缓存名带版本号，更新后页面会显示新版本刷新提示。
- 开发环境默认不注册 Service Worker，避免缓存污染 Next.js 开发 chunk；本地需要验 PWA 时打开 `http://127.0.0.1:3000/?pwa=1`。
- GitHub Pages 部署使用 `.github/workflows/pages.yml`，会以 `/LionCityWhispers/` 子路径导出静态站点。

## 验收口径

`npm run check` 必须通过，包含：

- `next build` 生产构建与类型检查
- Playwright 全流程、移动端、PWA、键位、持久化和 UI 锁回归
- 本地资产预算、直接依赖固定版本、Service Worker 缓存清单审计
- `npm audit --audit-level=moderate` 安全审计

## 下一步

后续推进项见 `NEXT_STEPS.md`。
