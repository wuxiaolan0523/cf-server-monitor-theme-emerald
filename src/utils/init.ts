import type { NodeStatus } from '@/utils/rpc'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import {
  adaptServer,
  buildAdminUrl,
  cfRequest,
  fetchAllServers,
  fetchSiteConfigs,
  getApiBases,
  getDisplayUuid,
  getRegisteredServerIds,
  getSharedApi,
  hasMultipleApiBases,
  isEnabledValue,
} from '@/utils/api'

interface TurnstileApi {
  render: (container: HTMLElement, options: {
    'sitekey': string
    'theme'?: 'auto' | 'light' | 'dark'
    'callback': (token: string) => void
    'error-callback'?: () => void
    'expired-callback'?: () => void
  }) => string
  remove: (widgetId: string) => void
}

interface WsMessage {
  type: string
  updates?: Array<{
    serverId: string
    samples?: Array<{ ts?: number, data?: Record<string, unknown> }>
  }>
}

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let turnstileScriptPromise: Promise<TurnstileApi> | null = null

function getTurnstile(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile
}

function loadTurnstile(): Promise<TurnstileApi> {
  const existing = getTurnstile()
  if (existing)
    return Promise.resolve(existing)
  if (turnstileScriptPromise)
    return turnstileScriptPromise

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT
    script.async = true
    script.defer = true
    script.onload = () => {
      const api = getTurnstile()
      if (api)
        resolve(api)
      else
        reject(new Error('Turnstile SDK 加载失败'))
    }
    script.onerror = () => reject(new Error('Turnstile SDK 加载失败'))
    document.head.appendChild(script)
  })
  return turnstileScriptPromise
}

async function requestTurnstileToken(siteKey: string): Promise<string> {
  const api = await loadTurnstile()
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-50 grid place-items-center bg-background/90 px-4 backdrop-blur-md'
    overlay.innerHTML = `
      <div class="w-full max-w-sm rounded-md border border-emerald-600/15 bg-background p-5 shadow-2xl">
        <div class="mb-1 text-base font-semibold">访问验证</div>
        <div class="mb-5 text-sm text-muted-foreground">完成 Cloudflare 验证后继续加载监控数据。</div>
        <div data-turnstile class="min-h-16"></div>
      </div>`
    document.body.appendChild(overlay)
    const container = overlay.querySelector<HTMLElement>('[data-turnstile]')
    if (!container) {
      overlay.remove()
      reject(new Error('Turnstile 容器创建失败'))
      return
    }

    let widgetId = ''
    const cleanup = () => {
      if (widgetId) {
        try {
          api.remove(widgetId)
        }
        catch {}
      }
      overlay.remove()
    }
    widgetId = api.render(container, {
      'sitekey': siteKey,
      'theme': 'auto',
      'callback': (token) => {
        cleanup()
        resolve(token)
      },
      'error-callback': () => {
        cleanup()
        reject(new Error('Turnstile 验证失败'))
      },
      'expired-callback': () => {
        cleanup()
        reject(new Error('Turnstile 验证已过期'))
      },
    })
  })
}

class InitManager {
  private appStore = useAppStore()
  private nodesStore = useNodesStore()
  private sockets: WebSocket[] = []
  private reconnectTimers = new Map<number, ReturnType<typeof setTimeout>>()
  private reconnectAttempts = new Map<number, number>()
  private refreshTimer: ReturnType<typeof setInterval> | null = null
  private destroyed = false

  async init(): Promise<void> {
    try {
      let configs = await fetchSiteConfigs()
      const turnstileConfigs = configs.filter(config => isEnabledValue(config.turnstile_enabled))
      if (hasMultipleApiBases() && turnstileConfigs.length)
        throw new Error('多后端聚合模式暂不支持启用 Turnstile 的源站')

      const first = configs[0]
      if (first && isEnabledValue(first.turnstile_enabled) && !first.verified) {
        if (!first.turnstile_site_key)
          throw new Error('源站已启用 Turnstile，但未返回 Site Key')
        const token = await requestTurnstileToken(first.turnstile_site_key)
        localStorage.setItem('turnstile_token', token)
        await cfRequest('/api/config', 0)
        configs = await fetchSiteConfigs()
      }

      const config = configs[0]
      if (config?.site_title && !hasMultipleApiBases())
        document.title = config.site_title

      if (config && !isEnabledValue(config.is_public) && !config.authorization) {
        window.location.href = buildAdminUrl(0)
        return
      }

      this.appStore.publicSettings = await getSharedApi().getPublicSettings()
      this.appStore.updateLoginState(configs.some(item => item.authorization))
      await this.refreshNodes(true)
      this.connectAllSockets()
      this.refreshTimer = setInterval(() => void this.refreshNodes(false), 60_000)
    }
    catch (error) {
      this.appStore.connectionError = true
      throw error
    }
    finally {
      this.appStore.loading = false
    }
  }

  private async refreshNodes(initial: boolean): Promise<void> {
    try {
      const { clients, statuses } = await fetchAllServers()
      if (initial) {
        this.nodesStore.initNodes(clients, statuses)
      }
      else {
        this.nodesStore.updateNodeClients(clients)
        this.nodesStore.updateNodeStatuses(statuses)
      }
      this.appStore.connectionError = false
    }
    catch (error) {
      this.appStore.connectionError = true
      if (initial)
        throw error
    }
  }

  private connectAllSockets(): void {
    getApiBases().forEach((baseUrl, apiIndex) => this.connectSocket(baseUrl, apiIndex))
  }

  private connectSocket(baseUrl: string, apiIndex: number): void {
    if (this.destroyed)
      return
    const url = new URL(`${baseUrl}/api/ws?subscribe=all`, window.location.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(url)
    this.sockets[apiIndex] = socket
    this.nodesStore.updateWsState('connecting', this.reconnectAttempts.get(apiIndex) ?? 0)

    socket.addEventListener('open', () => {
      this.reconnectAttempts.set(apiIndex, 0)
      socket.send(JSON.stringify({
        type: 'subscribe',
        scope: 'all',
        ids: getRegisteredServerIds(apiIndex),
      }))
      this.nodesStore.updateWsState('connected', 0)
    })

    socket.addEventListener('message', (event) => {
      let message: WsMessage
      try {
        message = JSON.parse(String(event.data)) as WsMessage
      }
      catch {
        return
      }
      if (message.type !== 'batchUpdate')
        return

      const statuses: Record<string, NodeStatus> = {}
      for (const update of message.updates ?? []) {
        const sample = update.samples?.at(-1)
        if (!sample?.data)
          continue
        const uuid = getDisplayUuid(apiIndex, update.serverId)
        const current = this.nodesStore.nodesByUuid.get(uuid)
        const status = adaptServer({
          id: update.serverId,
          ...sample.data,
          last_updated: sample.ts ?? Date.now(),
        }, apiIndex).status
        if (current) {
          if (sample.data.net_tx_monthly === undefined && sample.data.net_tx === undefined)
            status.net_total_up = current.net_total_up
          if (sample.data.net_rx_monthly === undefined && sample.data.net_rx === undefined)
            status.net_total_down = current.net_total_down
          if (sample.data.boot_time === undefined)
            status.uptime = current.uptime + 1
          if (sample.data.ram_total === undefined)
            status.ram_total = current.mem_total
          if (sample.data.swap_total === undefined)
            status.swap_total = current.swap_total
          if (sample.data.disk_total === undefined)
            status.disk_total = current.disk_total
        }
        statuses[uuid] = status
      }
      this.nodesStore.updateNodeStatuses(statuses)
    })

    socket.addEventListener('close', () => this.scheduleReconnect(baseUrl, apiIndex))
    socket.addEventListener('error', () => socket.close())
  }

  private scheduleReconnect(baseUrl: string, apiIndex: number): void {
    if (this.destroyed || this.reconnectTimers.has(apiIndex))
      return
    const attempts = (this.reconnectAttempts.get(apiIndex) ?? 0) + 1
    this.reconnectAttempts.set(apiIndex, attempts)
    this.nodesStore.updateWsState('reconnecting', attempts)
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5))
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(apiIndex)
      this.connectSocket(baseUrl, apiIndex)
    }, delay)
    this.reconnectTimers.set(apiIndex, timer)
  }

  destroy(): void {
    this.destroyed = true
    this.sockets.forEach(socket => socket?.close())
    this.sockets = []
    this.reconnectTimers.forEach(timer => clearTimeout(timer))
    this.reconnectTimers.clear()
    if (this.refreshTimer)
      clearInterval(this.refreshTimer)
    this.refreshTimer = null
    this.nodesStore.updateWsState('disconnected', 0)
  }
}

let initManager: InitManager | null = null

export async function initApp(): Promise<void> {
  initManager ??= new InitManager()
  await initManager.init()
}

export function destroyInitManager(): void {
  initManager?.destroy()
  initManager = null
}
