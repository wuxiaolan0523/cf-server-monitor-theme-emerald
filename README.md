# <p align="center">Emerald Theme for CF Server Monitor</p>

<p align="center">基于 Vue 3 + Vite + reka-ui + Tailwind CSS v4 构建的 CF Server Monitor主题</p>

<p align="center">支持一键部署到 Vercel、Cloudflare、EdgeOne、Github Pages，也可自部署到 VPS 或其他静态服务器。</p>

## 功能

- 卡片和表格两种节点视图
- 多分组、搜索、地区旗帜和操作系统图标
- CPU、内存、磁盘、流量、网络和 Ping 历史图表
- CF Server Monitor WebSocket 实时更新与断线重连
- 单后端 Turnstile 验证
- 多后端聚合，详情页保留数据源信息
- 深色、浅色和跟随系统主题
- Hash 路由，可部署到 `Vercel` `Cloudflare` `EdgeOne` `Github Pages` 或普通静态服务器

## 一键部署

|  | Vercel | Cloudflare | EdgeOne | Github Pages |
| ---- | ---- | ---- | ---- | ---- |
|  | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Tokinx/cf-server-monitor-theme-emerald) | [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Tokinx/cf-server-monitor-theme-emerald) | [![使用 EdgeOne Makers 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https://github.com/Tokinx/cf-server-monitor-theme-emerald) | / |
| API_BASE | https://monitor.example.com | https://monitor.example.com | https://monitor.example.com | https://monitor.example.com |
| PROXY_BACKEND | **true** / false | true / **false** | **false** | **false** |
| PROXY_WEBSOCKET | **false** | true / **false** | **false** | **false** |

- `API_BASE` 是 CF Server Monitor Worker 的地址，例如 `https://monitor.example.com`。
- `PROXY_BACKEND` 开启后 `/api`、`/flags`、`/os-icons` 将通过代理转发到 `API_BASE`，可起到一定的加速作用
- `PROXY_WEBSOCKET` 开启后 WebSocket 将通过代理转发到 `API_BASE`，可起到一定的加速作用（Vercel & Github Pages 不支持）

## 开发

```bash
bun install
cp .env.example .env
bun run dev
```

`.env` 示例：

```dotenv
API_BASE=https://monitor.example.com
PROXY_BACKEND=false
PROXY_WEBSOCKET=true
CSP_API=
CSP_STATIC=
BASE_PATH=./
```

`API_BASE` 支持用英文逗号配置多个 Worker。开发模式会把同源 `/api` 请求代理到单个 `API_BASE`，避免本地 CORS 限制。

当设置 `PROXY_BACKEND=true` 时，HTTP 请求使用同源 `/api`、`/flags/xxx` 和 `/os-icons/xxx`，这要求部署平台提供反向代理。`PROXY_WEBSOCKET=true` 时，WebSocket 也使用同源 `/api/ws`；Cloudflare Worker 和 Pages 会透传升级请求。`PROXY_WEBSOCKET=false` 时，WebSocket 直连构建时的 `API_BASE`，适用于不支持 WebSocket 代理的 Vercel 和 GitHub Pages。

## 构建

```bash
bun run lint
bun run build
bun run preview
```

产物位于 `dist/`。纯静态部署时，构建会将 `API_BASE` 写入 `index.html` 的 `meta[name="apiBase"]`。跨域直连部署还需在 CF Server Monitor Worker 中将站点域名加入 `CORS_ALLOWED_ORIGINS`。

GitHub Pages 项目站点可将 `BASE_PATH` 设置为仓库路径，例如 `/cf-server-monitor-theme-emerald/`；自定义域名和其他静态平台通常保留 `./` 即可。

### 主题开发文档：

- [CF-Server-Monitor项目地址](https://github.com/huilang-me/CF-Server-Monitor)
- [开发指南](https://github.com/huilang-me/CF-Server-Monitor/blob/main/develop.md)
- [前端API文档](https://github.com/huilang-me/CF-Server-Monitor/blob/main/theme-develop.md)
- [后端API文档](https://github.com/huilang-me/CF-Server-Monitor/blob/main/API.md)

## 运行时约定

- 路由：`/#/`、`/#/server/:id`
- 后端管理入口：`${API_BASE}/#/admin`
- 未配置 `apiBase` 时默认使用当前页面 origin
- `PROXY_BACKEND=true` 时请求使用当前站点的 `/api`、`/flags` 和 `/os-icons`
- 多后端模式下不支持任一源站开启 Turnstile
- 匿名用户仅查询 1 小时以内的历史数据，符合 CF Server Monitor API 权限限制

## 致谢

- [Tokinx/komari-theme-emerald](https://github.com/Tokinx/komari-theme-emerald)
- [huilang-me/CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)
- [huilang-me/CF-Server-Monitor-theme](https://github.com/huilang-me/CF-Server-Monitor-theme)

## License

[MIT](./LICENSE)
