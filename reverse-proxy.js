// EdgeOne Pages单纯反向代理脚本
// 此脚本用于在腾讯云EdgeOne Pages上部署，实现基本的反向代理功能

// 配置项
const config = {
  // 目标网站地址
  targetUrl: 'https://h5.lot-ml.com/ProductEn/Index/4388a5835e853d71'
};

// 处理请求的主函数
async function handleRequest(request) {
  // 处理OPTIONS预请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  try {
    console.log('反向代理请求开始:', request.url);

    // 获取请求URL信息
    const url = new URL(request.url);
    const path = url.pathname;
    const query = url.search;

    // 构建目标URL
    const targetUrl = config.targetUrl + (path === '/' ? '' : path) + query;
    console.log('目标URL:', targetUrl);

    // 创建新的请求头，保留原始请求的重要头信息
    const headers = new Headers(request.headers);

    // 设置Host头为目标网站的主机名，确保正确的请求处理
    const targetHost = new URL(config.targetUrl).host;
    headers.set('Host', targetHost);
    headers.set('Referer', config.targetUrl);
    headers.set('Origin', config.targetUrl);

    // 发送请求到目标网站
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow',
      cf: {
        // 配置EdgeOne的缓存行为
        cacheTtl: 300, // 缓存时间（秒）
        cacheEverything: true
      }
    });

    console.log('目标网站响应状态:', response.status);

    // 复制响应头并添加CORS支持
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 删除可能影响缓存的头信息
    responseHeaders.delete('pragma');
    responseHeaders.delete('cache-control');

    // 直接返回原始响应
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    // 处理错误，返回友好的错误信息
    console.error('反向代理错误:', error);
    return new Response(`代理服务暂时不可用，请稍后再试。错误信息: ${error.message}`, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      }
    });
  }
}

// EdgeOne Pages函数导出
export default {
  fetch: handleRequest
};

// 部署说明：
// 1. 将此脚本部署到腾讯云EdgeOne Pages
// 2. 在EdgeOne控制台配置自定义域名
// 3. 根据实际需求修改config对象中的targetUrl
// 4. 如需添加内容替换功能，可以参考原始index.js文件