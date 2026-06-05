# 后续要做什么

这个文件夹已经是当前本地闭环后的游戏项目。后续优先做以下事项，不建议先继续无目标堆功能。

## 先确认本地可运行

```powershell
cd D:\Wonderful\Games\LionCityWhispers
npm run dev
```

打开 http://127.0.0.1:3000。

如果依赖缺失或 `node_modules` 被清理过，先运行：

```powershell
npm install
```

## 每次改动后的验收

```powershell
npm run check
```

这会依次执行生产构建、Playwright 回归、游戏资产审计和安全审计。它是当前项目最完整的本地验收入口。

## 公开网页

别人可以通过这个地址打开游戏：

https://wangjiehu.github.io/LionCityWhispers/

对应 GitHub 仓库：

https://github.com/wangjiehu/LionCityWhispers

如果网页暂时打不开，先到仓库的 Actions 页面确认 `Deploy GitHub Pages` 是否已经跑完；首次部署通常需要等待一小段时间。

## 真正值得继续推进的事

1. 做一轮真人试玩，记录玩家是否能在无额外解释下完成首件文物、符文、机关、节奏仪式和布展。
2. 部署到 HTTPS 预发布环境，验证 PWA 安装、更新提示、离线启动和缓存升级。
3. 用真机补测 iOS Safari、Android Chrome、低配 Windows 笔记本和触控设备。
4. 根据真人试玩结果再扩展内容，例如新谜题、展厅评价分支、二周目文物叙事或更细的节奏评分反馈。

## 暂时不建议做的事

- 不建议在没有试玩反馈前继续增加大量文案或谜题数量；那会放大理解成本。
- 不建议为了视觉复杂度继续叠装饰层；当前更需要确认玩家能读懂目标和操作。
- 不建议把开发态 Service Worker 默认开启；会重新引入缓存污染开发 chunk 的风险。
