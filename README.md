# Emerald Theme for CF Server Monitor

将 [komari-theme-emerald](https://github.com/Tokinx/komari-theme-emerald) 的界面移植到 [CF Server Monitor](https://github.com/huilang-me/CF-Server-Monitor)。项目使用 Vue 3、Vite、reka-ui、Tailwind CSS v4、Pinia 和 ECharts，构建结果为可独立部署的纯静态文件。

本移植版本已移除 Cobe Earth，首页地理视图使用 ECharts 世界地图。

## 功能

- 卡片和表格两种节点视图
- 多分组、搜索、地区旗帜和操作系统图标
- CPU、内存、磁盘、流量、网络和 Ping 历史图表
- CF Server Monitor WebSocket 实时更新与断线重连
- 单后端 Turnstile 验证
- 多后端聚合，详情页保留数据源信息
- 深色、浅色和跟随系统主题
- Hash 路由，可部署到 GitHub Pages、Cloudflare Pages、Vercel 或普通静态服务器

## 开发

```bash
bun install
cp .env.example .env
bun run dev
```

`.env` 示例：

```dotenv
API_BASE=https://monitor.example.com
TITLE=CF Server Monitor
BACKGROUND_IMAGE=
CSP_API=
CSP_STATIC=
BASE_PATH=./
```

`API_BASE` 支持用英文逗号配置多个 Worker。开发模式会把同源 `/api` 请求代理到单个 `API_BASE`，避免本地 CORS 限制。

## 构建

```bash
bun run lint
bun run build
bun run preview
```

产物位于 `dist/`。纯静态部署时，构建会将 `API_BASE` 写入 `index.html` 的 `meta[name="apiBase"]`。跨域部署还需在 CF Server Monitor Worker 中将站点域名加入 `CORS_ALLOWED_ORIGINS`。

GitHub Pages 项目站点可将 `BASE_PATH` 设置为仓库路径，例如 `/cf-server-monitor-theme-emerald/`；自定义域名和其他静态平台通常保留 `./` 即可。

## 运行时约定

- 路由：`/#/`、`/#/server/:id`
- 后端管理入口：`${API_BASE}/#/admin`
- 未配置 `apiBase` 时默认使用当前页面 origin
- 多后端模式下不支持任一源站开启 Turnstile
- 匿名用户仅查询 1 小时以内的历史数据，符合 CF Server Monitor API 权限限制

## 致谢

- [Tokinx/komari-theme-emerald](https://github.com/Tokinx/komari-theme-emerald)
- [huilang-me/CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)
- [huilang-me/CF-Server-Monitor-theme](https://github.com/huilang-me/CF-Server-Monitor-theme)

## License

[MIT](./LICENSE)
