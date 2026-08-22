const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  ...CORS_HEADERS,
}

// default_discount_percent de propósito NÃO está nessa lista -- o jogo às
// vezes manda null pra esse campo, e isso é aceito (ver normalização mais
// abaixo, antes do put no KV).
const REQUIRED_EVENT_FIELDS = [
  'name',
  'slug',
  'rewards',
  'tasks',
  'multiplier_exchange_rlt',
  'end_date',
]

function validateEvent(event) {
  const missing = []

  for (const field of REQUIRED_EVENT_FIELDS) {
    if (!(field in event) || event[field] === null || event[field] === undefined) {
      missing.push(field)
    }
  }

  if ('rewards' in event && !(Array.isArray(event.rewards) && event.rewards.length > 0)) {
    missing.push('rewards')
  }

  if ('tasks' in event && !Array.isArray(event.tasks)) {
    missing.push('tasks')
  }

  return [...new Set(missing)]
}

async function handleGetCurrentEvent(env) {
  const stored = await env.EVENTS_KV.get('current')

  if (stored === null) {
    return new Response(JSON.stringify({ error: 'no_event_configured' }), {
      status: 404,
      headers: JSON_HEADERS,
    })
  }

  return new Response(stored, { status: 200, headers: JSON_HEADERS })
}

async function handlePostCurrentEvent(request, env) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body.password !== 'string') {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  if (body.password !== env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  const event = body.event
  if (!event || typeof event !== 'object') {
    return new Response(
      JSON.stringify({ error: 'invalid_event_data', missing: REQUIRED_EVENT_FIELDS }),
      { status: 400, headers: JSON_HEADERS },
    )
  }

  const missing = validateEvent(event)
  if (missing.length > 0) {
    return new Response(JSON.stringify({ error: 'invalid_event_data', missing }), {
      status: 400,
      headers: JSON_HEADERS,
    })
  }

  // default_discount_percent não é obrigatório e às vezes vem null do jogo --
  // normaliza pra 0 aqui pra ninguém rio abaixo (frontend) precisar tratar null.
  if (event.default_discount_percent === null || event.default_discount_percent === undefined) {
    event.default_discount_percent = 0
  }

  await env.EVENTS_KV.put('current', JSON.stringify(event))

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: JSON_HEADERS,
  })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/+/, '')

    if (path === 'api/progression-data/current') {
      if (request.method === 'GET') {
        return handleGetCurrentEvent(env)
      }
      if (request.method === 'POST') {
        return handlePostCurrentEvent(request, env)
      }
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: JSON_HEADERS,
      })
    }

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
