/**
 * EdgeOne 万能代理 — https://你的域名/目标域名/路径
 *
 * 请求头透传: Authorization, Accept, User-Agent 等
 * 响应: 原样返回目标内容 + CORS + 缓存优化
 */

const USER_AGENT =
  "Mozilla/5.0 (compatible; EdgeOneProxy/1.0)";

/**
 * 重写 HTML 中的相对路径，使其通过代理访问
 * 例如: src="/static/js/app.js" → src="/目标域名/static/js/app.js"
 */
function rewriteRelativeUrls(html, targetHostname) {
  // 1) 重写相对路径 /path → /目标域名/path
  //    也处理 href="/" 这种纯根路径
  html = html.replace(
    /((?:src|href|action|srcset|data-src|poster|data-href)\s*=\s*["']?)\/([^"'\s#>]*)/gi,
    (match, prefix, path) => {
      // 跳过协议相对路径 (//...) 和纯锚点 (#...)
      if (path.startsWith("/") || path.startsWith("#")) return match;
      // / 或 /path → /目标域名/path（空路径也处理）
      return `${prefix}/${targetHostname}${path ? '/' + path : ''}`;
    }
  );
  // 2) 重写指向同一目标域名的绝对路径
  //    https://github.com/xxx → /github.com/xxx
  //    //github.com/xxx      → /github.com/xxx
  const hostEscaped = targetHostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(
    new RegExp(
      '((?:src|href|action|srcset|data-src|poster|data-href)\\s*=\\s*["\']?)' +
      '(?:https?:)?//' + hostEscaped + '(?::\\d+)?(/[^"\'\s>]*)',
      'gi'
    ),
    (match, prefix, path) => `${prefix}/${targetHostname}${path || '/'}`
  );
  // 3) 重写 CSS url() 中的相对路径
  html = html.replace(
    /url\(["']?\/([^"'\)]+)["']?\)/gi,
    (match, path) => match.replace(/\/[^"'\)]+/, `/${targetHostname}/${path}`)
  );
  return html;
}

/**
 * 处理所有 HTTP 方法的请求
 */
export function onRequest(context) {
  const { request, uuid, clientIp, server } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 请求入口日志
  console.log(
    JSON.stringify({
      event: "request_start",
      requestId: uuid,
      clientIp,
      region: server?.region,
      method: request.method,
      path,
      userAgent: request.headers.get("user-agent") || "unknown",
    })
  );

// 根路径 → 帮助页
  if (path === "/" || path === "") {
    console.log(JSON.stringify({ event: "route_match", type: "help", requestId: uuid }));
    const region = server?.region || "ap-tokyo";
    const html = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Go Proxy</title><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 10.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z' fill='%2358a6ff'/%3E%3Cpath d='M9 5.5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6.5h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z' fill='%2358a6ff'/%3E%3C/svg%3E">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#0d1117;color:#e6edf3;min-height:100vh;display:flex;flex-direction:column}
.nav{display:flex;align-items:center;justify-content:space-between;padding:.8rem 2rem;border-bottom:1px solid #21262d}
.nav-logo{font-weight:700;font-size:1.05rem;color:#f0f6fc}
.nav-logo span{background:linear-gradient(135deg,#58a6ff,#3fb950);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.nav-links{display:flex;gap:1.5rem}
.nav-links a{color:#8b949e;transition:color .2s;display:flex}
.nav-links a:hover{color:#58a6ff}
.main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1.5rem}
.hero{text-align:center;margin-bottom:2.5rem}
.hero .icon{margin-bottom:.5rem}
.hero h1{font-size:2.5rem;font-weight:400;margin-bottom:.5rem}
.hero h1 span{background:linear-gradient(135deg,#58a6ff,#3fb950);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero p{color:#8b949e;font-size:1rem}
.url-box{background:linear-gradient(135deg,rgba(88,166,255,0.15) 0%,rgba(63,185,80,0.08) 50%,rgba(88,166,255,0.03) 100%);backdrop-filter:blur(20px) hue-rotate(10deg);border-radius:18px;padding:.9rem 1.2rem;width:100%;max-width:520px;display:flex;align-items:center;gap:.75rem;margin-bottom:2rem;position:relative;box-shadow:0 12px 40px rgba(0,0,0,.3),inset 0 2px 0 rgba(255,255,255,.08);transition:all .3s cubic-bezier(.4,0,.2,1);z-index:0}
.url-box::before{content:'';position:absolute;inset:0;border-radius:18px;padding:1.5px;background:linear-gradient(135deg,rgba(88,166,255,.5),rgba(63,185,80,.2));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;pointer-events:none;z-index:-1}
.url-box::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(45deg,transparent 30%,rgba(255,255,255,.05) 50%,transparent 70%);border-radius:inherit;pointer-events:none;z-index:-1}
.url-box:hover{box-shadow:0 16px 48px rgba(88,166,255,.15),inset 0 2px 0 rgba(255,255,255,.1)}
.url-box .prefix{color:#8b949e;font-size:.9rem;flex-shrink:0}
.url-box .prefix code{background:#21262d;padding:.15rem .5rem;border-radius:4px;font-size:.85rem;color:#58a6ff;font-family:'SF Mono',Consolas,monospace}
.url-box input{flex:1;background:transparent;border:none;outline:none;color:#e6edf3;font-size:.95rem;font-family:'SF Mono',Consolas,monospace}
.url-box input::placeholder{color:#484f58}
.url-box .go-btn{background:linear-gradient(135deg,#238636,#2ea043);border:none;color:#fff;padding:.4rem 1rem;border-radius:6px;font-size:.85rem;font-weight:500;cursor:pointer;transition:opacity .2s;flex-shrink:0}
.url-box .go-btn:hover{opacity:.85}
.sites{display:flex;flex-wrap:wrap;gap:.7rem;justify-content:center;max-width:600px}
.sites a{display:flex;align-items:center;gap:.5rem;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:.6rem 1rem;text-decoration:none;color:#e6edf3;font-size:.875rem;transition:all .2s}
.sites a:hover{border-color:#58a6ff;background:#1c2333;transform:translateY(-1px)}
.sites a .tag{font-size:.7rem;background:#21262d;padding:.1rem .45rem;border-radius:3px;color:#8b949e}
.footer{text-align:center;padding:1.5rem;color:#484f58;font-size:.8rem;border-top:1px solid #21262d}
.footer a{color:#58a6ff;text-decoration:none}
@media(max-width:480px){.hero h1{font-size:1.8rem}.nav{padding:.6rem 1rem}.url-box{padding:.7rem 1rem}}
</style>
</head><body>
<div class="nav"><div class="nav-logo"><span>Gp Proxy</span></div><div class="nav-links' +
    '"><a href="https://github.com" target="_blank" aria-label="GitHub"><svg width="20" height="20" viewBox="0 0 16 16" fill="#8b949e"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg></a><a href="https://pages.edgeone.ai" target="_blank" aria-label="EdgeOne"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></div></div>
<div class="main"><div class="hero"><div class="icon"><svg width="66" height="66" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div><h1><span>The world&rsquo;s so big&mdash;I wanna go check it out.</span></h1><p>通过边缘网络加速访问任意网站</p></div>
<div class="url-box"><span class="prefix"><code>/</code></span><input type="text" placeholder="输入目标域名，如 github.com" id="domainInput"><button class="go-btn" onclick="go()">&#10132; 前往</button></div>
<div class="sites"><a href="/github.com"><svg width="18" height="18" viewBox="0 0 16 16" fill="#e6edf3"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg> GitHub <span class="tag">&#x70ED;&#x95E8;</span></a><a href="/github.com/trending"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6edf3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> Trending <span class="tag">&#x6BCF;&#x65E5;</span></a><a href="/example.com"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6edf3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Example</a><a href="/npmjs.com"><svg width="18" height="18" viewBox="0 0 24 24" fill="#e6edf3"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.13l13.74.002v13.72H15.22V8.618h-2.147v10.23H5.13z"/></svg> npm</a><a href="/lowendtalk.com"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6edf3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> LowEndTalk</a></div></div>
<div class="footer">Powered by <a href="https://pages.edgeone.ai" target="_blank">EdgeOne Makers</a></div>
<script>function go(){var v=document.getElementById('domainInput').value.trim();if(v){var p=v.startsWith('http')?'/'+v.replace(/https?:\/\//,''):v;window.location.href='/'+p}}document.getElementById('domainInput').addEventListener('keydown',function(e){if(e.key==='Enter')go()});</script>
</body></html>`;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // /目标域名/路径 → https://目标域名/路径
  const restAfterSlash = path.slice(1);
  const firstSlash = restAfterSlash.indexOf("/");

  let hostname, rest;
  if (firstSlash === -1) {
    hostname = restAfterSlash;
    rest = "";
  } else {
    hostname = restAfterSlash.slice(0, firstSlash);
    rest = restAfterSlash.slice(firstSlash + 1);
  }

  // 修复被吞掉的协议头：/https:/domain/path → https://domain/path
  // 处理形如 /https:/domain/path 或 /https://domain/path
  let prefix = "https://";
  if (hostname === "http:" || hostname === "https:") {
    prefix = hostname + "//";
    const restAfterProtocol = rest.replace(/^\/+/, "");
    const slashIdx = restAfterProtocol.indexOf("/");
    if (slashIdx === -1) {
      hostname = restAfterProtocol;
      rest = "";
    } else {
      hostname = restAfterProtocol.slice(0, slashIdx);
      rest = restAfterProtocol.slice(slashIdx + 1);
    }
  }

  // 基本校验 & Referer 推导：若首段不含点号，从 Referer 头中提取之前代理的目标域名
  if (!hostname.includes(".")) {
    const referer = request.headers.get("referer") || "";
    let refererHost = "";
    if (referer) {
      try {
        const refUrl = new URL(referer);
        const refPath = refUrl.pathname.slice(1); // 去掉开头的 /
        const segEnd = refPath.indexOf("/");
        const firstSeg = segEnd === -1 ? refPath : refPath.slice(0, segEnd);
        if (firstSeg.includes(".")) refererHost = firstSeg;
      } catch { /* 忽略无效 Referer */ }
    }
    if (refererHost) {
      // 把原始的第一段拼回 rest（它本是路径的一部分，不是 hostname）
      rest = hostname + (rest ? "/" + rest : "");
      hostname = refererHost;
    } else {
      console.log(JSON.stringify({ event: "invalid_hostname", requestId: uuid, hostname }));
      return new Response("Invalid hostname, use: https://你的域名/目标域名/路径", { status: 400 });
    }
  }

  const target = prefix + hostname + (rest ? "/" + rest : "") + url.search;

  console.log(JSON.stringify({ event: "route_match", type: "direct", requestId: uuid, target }));
  return proxyRequest(target, request, uuid);
}

/**
 * 代理请求到目标 URL
 */
async function proxyRequest(target, request, uuid) {
  const startTime = Date.now();

  try {
    const targetURL = new URL(target);

    // 安全检查：拦截内网/本地地址，防止 SSRF
    const hostname = targetURL.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname === "[::]" ||
      /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)
    ) {
      console.log(
        JSON.stringify({ event: "proxy_blocked", requestId: uuid, target: hostname, reason: "internal_ip" })
      );
      return new Response("Forbidden: internal address", { status: 403 });
    }

    // 构建转发请求头
    const headers = new Headers();
    for (const name of [
      "accept", "accept-encoding", "accept-language",
      "authorization", "cache-control", "cookie",
      "if-none-match", "if-modified-since", "range",
      "user-agent",
    ]) {
      const val = request.headers.get(name);
      if (val) headers.set(name, val);
    }
    if (!headers.has("user-agent")) headers.set("user-agent", USER_AGENT);

    console.log(
      JSON.stringify({ event: "proxy_fetch", requestId: uuid, method: request.method, target })
    );

    const resp = await fetch(targetURL, {
      method: request.method,
      headers,
      redirect: "follow",
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    });

    const duration = Date.now() - startTime;
    const respHeaders = new Headers(resp.headers);

    // CORS
    respHeaders.set("Access-Control-Allow-Origin", "*");
    respHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    respHeaders.set("Access-Control-Max-Age", "86400");

    // 缓存
    const ct = respHeaders.get("content-type") || "";
    if (/text\/|json|javascript|xml/.test(ct)) {
      respHeaders.set("Cache-Control", "public, max-age=300, s-maxage=600");
    } else {
      respHeaders.set("Cache-Control", "public, max-age=3600, s-maxage=7200");
    }

    // 删除编解码相关头：fetch() 已自动解压 body，保留原头会导致浏览器重复解压失败
    respHeaders.delete("content-encoding");
    respHeaders.delete("content-length");
    respHeaders.delete("transfer-encoding");
    respHeaders.delete("content-security-policy");
    respHeaders.delete("x-frame-options");

    // 读取响应体：HTML 需要重写相对路径，其余按原始流返回
    let body;
    if (/text\/html/i.test(ct)) {
      body = rewriteRelativeUrls(await resp.text(), targetURL.hostname);
    } else {
      body = resp.body;
    }

    console.log(
      JSON.stringify({
        event: "proxy_response", requestId: uuid, target,
        status: resp.status, contentType: ct, duration: `${duration}ms`,
      })
    );

    return new Response(body, { status: resp.status, headers: respHeaders });
  } catch (err) {
    const duration = Date.now() - startTime;
    console.log(
      JSON.stringify({
        event: "proxy_error", requestId: uuid, target,
        error: err.message, duration: `${duration}ms`,
      })
    );
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }
}
