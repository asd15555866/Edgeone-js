const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

function responseWithCors(response) {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function errorResponse(message, status = 400) {
  return new Response(message, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export default async function onRequest(context) {
  const request = context.request;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get('url');

  if (!target) {
    return errorResponse('请提供 url 查询参数，例如 ?url=https%3A%2F%2Fexample.com');
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return errorResponse('url 必须是有效的网址');
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return errorResponse('只支持 HTTP 和 HTTPS 地址');
  }

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

    return responseWithCors(upstreamResponse);
  } catch {
    return errorResponse('访问目标网站失败', 502);
  }
}
