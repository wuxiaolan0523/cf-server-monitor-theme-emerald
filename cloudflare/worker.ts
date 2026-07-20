import { proxyBackendRequest } from './proxy'

interface Env {
  API_BASE?: string
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return await proxyBackendRequest(request, env.API_BASE) ?? env.ASSETS.fetch(request)
  },
}
