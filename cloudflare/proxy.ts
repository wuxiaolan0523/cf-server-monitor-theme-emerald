const PROXY_PATH_REGEX = /^\/(?:api|flags|os-icons)(?:\/|$)/
const TRAILING_SLASHES_REGEX = /\/+$/

export async function proxyBackendRequest(request: Request, apiBase: string | undefined): Promise<Response | null> {
  const requestUrl = new URL(request.url)
  if (!PROXY_PATH_REGEX.test(requestUrl.pathname))
    return null

  if (!apiBase?.trim())
    return Response.json({ error: 'API_BASE is not configured' }, { status: 500 })

  const target = new URL(apiBase.trim().replace(TRAILING_SLASHES_REGEX, '') + requestUrl.pathname + requestUrl.search)
  try {
    return await fetch(new Request(target, request))
  }
  catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Backend request failed' }, { status: 502 })
  }
}
