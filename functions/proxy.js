/**
 * 直接代理指定网站的函数
 * 访问根路径或/proxy路径时，直接显示被代理网站的内容
 */
export async function onRequest(context) {
    const { request } = context;

    try {
        const requestUrl = new URL(request.url);
        const targetUrlParam = requestUrl.searchParams.get('url');

        // ########################################################
        // 重要: 这是要代理的目标网站
        const defaultTargetUrl = 'https://h5.lot-ml.com/ProductEn/Index/4388a5835e853d71';
        // ########################################################
        const targetUrl = targetUrlParam || defaultTargetUrl;

        // 无论访问根路径还是/proxy路径，都直接代理目标网站
        // 移除了重定向逻辑，直接返回代理内容

        // **CRITICAL FIX: Use a professional proxy service.**
        const proxyServiceUrl = 'https://cors-anywhere.herokuapp.com/';
        const actualUrlStr = proxyServiceUrl + targetUrl;

        // We can now use a much simpler request, as the proxy service will handle headers.
        const modifiedRequest = new Request(actualUrlStr, {
            headers: {
                'Origin': requestUrl.origin, // The proxy service requires an Origin header.
                'X-Requested-With': 'XMLHttpRequest'
            },
            method: request.method,
            body: (request.method === 'POST' || request.method === 'PUT') ? request.body : null,
            redirect: 'follow' // We can let the proxy service handle redirects.
        });

        const response = await fetch(modifiedRequest);

        // We still need to filter Set-Cookie to avoid browser security issues.
        const finalHeaders = new Headers(response.headers);
        finalHeaders.delete('Set-Cookie');

        // Since the third-party proxy handles all content, we don't need our own HTML rewriter.
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: finalHeaders
        });

    } catch (error) {
        return new Response(`Proxy Error: ${error.message}`, { status: 500 });
    }
}
