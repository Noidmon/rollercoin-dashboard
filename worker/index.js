const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/+/, '')

    if (path.startsWith('img/')) {
      const targetUrl = `https://static.rollercoin.com/static/${path}`

      const proxiedResponse = await fetch(targetUrl, {
        method: request.method,
      })

      const responseHeaders = new Headers({
        'Content-Type': proxiedResponse.headers.get('Content-Type') ?? '',
        ...CORS_HEADERS,
      })

      return new Response(proxiedResponse.body, {
        status: proxiedResponse.status,
        statusText: proxiedResponse.statusText,
        headers: responseHeaders,
      })
    }

    const targetUrl = `https://rollercoin.com/api/${path}`

    const proxiedResponse = await fetch(targetUrl, {
      method: request.method,
    })

    const responseHeaders = new Headers(proxiedResponse.headers)
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(key, value)
    }

    return new Response(proxiedResponse.body, {
      status: proxiedResponse.status,
      statusText: proxiedResponse.statusText,
      headers: responseHeaders,
    })
  },
}
