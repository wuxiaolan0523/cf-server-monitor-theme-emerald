import { proxyBackendRequest } from '../cloudflare/proxy'

interface PagesContext {
  request: Request
  env: { API_BASE?: string }
  next: () => Promise<Response>
}

export async function onRequest(context: PagesContext): Promise<Response> {
  return await proxyBackendRequest(context.request, context.env.API_BASE) ?? context.next()
}
