const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

function logRequest(event, fields) {
  console.log('[proxy]', JSON.stringify({
    event,
    ...fields,
  }));
}

function responseWithCors(response, requestId) {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }
  headers.set('X-Request-Id', requestId);
  headers.set('Cache-Control', 'no-store');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function errorResponse(message, status, requestId) {
  return new Response(message, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Request-Id': requestId,
      'Cache-Control': 'no-store',
    },
  });
}

export default async function onRequest(context) {
  const startedAt = Date.now();
  const request = context.request;
  const requestUrl = new URL(request.url);
  const requestId = crypto.randomUUID();
  const baseLog = {
    requestId,
    method: request.method,
    path: requestUrl.pathname,
  };

  logRequest('request_start', baseLog);

  if (request.method === 'OPTIONS') {
    logRequest('request_end', {
      ...baseLog,
      status: 204,
      durationMs: Date.now() - startedAt,
    });
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store',
      },
    });
  }

  const target = requestUrl.searchParams.get('url');
  if (!target) {
    logRequest('request_error', {
      ...baseLog,
      code: 'missing_target_url',
      status: 400,
      durationMs: Date.now() - startedAt,
    });
    return errorResponse('请提供 url 查询参数，例如 ?url=https%3A%2F%2Fexample.com', 400, requestId);
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    logRequest('request_error', {
      ...baseLog,
      code: 'invalid_target_url',
      status: 400,
      durationMs: Date.now() - startedAt,
    });
    return errorResponse('url 必须是有效的网址', 400, requestId);
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    logRequest('request_error', {
      ...baseLog,
      code: 'unsupported_target_protocol',
      targetProtocol: targetUrl.protocol,
      status: 400,
      durationMs: Date.now() - startedAt,
    });
    return errorResponse('只支持 HTTP 和 HTTPS 地址', 400, requestId);
  }

  logRequest('upstream_start', {
    ...baseLog,
    targetHost: targetUrl.host,
    targetPath: targetUrl.pathname,
  });

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('origin');
  headers.delete('referer');

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'follow',
    });
    const response = responseWithCors(upstreamResponse, requestId);

    logRequest('request_end', {
      ...baseLog,
      targetHost: targetUrl.host,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });

    return response;
  } catch (error) {
    logRequest('request_error', {
      ...baseLog,
      targetHost: targetUrl.host,
      code: 'upstream_fetch_failed',
      error: error instanceof Error ? error.message : String(error),
      status: 502,
      durationMs: Date.now() - startedAt,
    });
    return errorResponse('访问目标网站失败', 502, requestId);
  }
}
