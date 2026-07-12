const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

function withCors(response) {
  const headers = new Headers(response.headers);

  Object.entries(corsHeaders).forEach(([name, value]) => {
    headers.set(name, value);
  });
  headers.delete('X-Cache');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function onRequest({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get('url');

  if (!target) {
    return withCors(new Response('Missing required query parameter: url', { status: 400 }));
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return withCors(new Response('The url parameter must be a valid URL', { status: 400 }));
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return withCors(new Response('Only HTTP and HTTPS URLs are supported', { status: 400 }));
  }

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'follow',
  });

  return withCors(response);
}
