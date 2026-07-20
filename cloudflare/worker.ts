import { proxyBackendRequest } from './proxy'

interface Env {
  API_BASE?: string
  PROXY_BACKEND?: string
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

function isProxyEnabled(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true'
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (isProxyEnabled(env.PROXY_BACKEND))
      return await proxyBackendRequest(request, env.API_BASE) ?? env.ASSETS.fetch(request)
    return env.ASSETS.fetch(request)
  },
}
