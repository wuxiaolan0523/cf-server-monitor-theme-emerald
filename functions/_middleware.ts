import { proxyBackendRequest } from '../cloudflare/proxy'

interface PagesContext {
  request: Request
  env: { API_BASE?: string, PROXY_BACKEND?: string }
  next: () => Promise<Response>
}

function isProxyEnabled(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true'
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (isProxyEnabled(context.env.PROXY_BACKEND))
    return await proxyBackendRequest(context.request, context.env.API_BASE) ?? context.next()
  return context.next()
}
