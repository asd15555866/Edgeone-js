# Universal Proxy

基于 Tencent EdgeOne Makers Cloud Functions 构建的万能反向代理服务。通过边缘网络加速访问任意网站，支持请求头透传、Cookie 保持、HTML 链接重写等特性。

## 快速开始

```bash
# 安装 CLI
npm install -g edgeone

# 登录（会弹出浏览器）
edgeone login

# 本地开发
edgeone makers dev

# 部署（海外区域）
edgeone makers deploy -n your-project -a overseas
```

## 使用方式

部署后直接通过 `https://你的域名/目标域名/路径` 格式访问任意网站：

```
https://你的域名/github.com
https://你的域名/github.com/trending
https://你的域名/example.com
https://你的域名/npmjs.com
```

## 功能特性

| 特性 | 说明 |
|------|------|
| 🌐 **全球加速** | 基于 EdgeOne 全球边缘网络，智能缓存与加速 |
| 🛡️ **SSRF 防护** | 自动拦截 localhost/127.0.0.1/内网地址请求 |
| 🍪 **Cookie 透传** | 完整转发 Cookie 与认证头，支持登录态保持 |
| 🔗 **HTML 重写** | 自动重写页面中相对与绝对链接，站内导航保留在代理内 |
| 🔧 **协议修复** | 自动修复 `https:/domain` 被浏览器吞协议头问题 |
| 📝 **请求体转发** | 正确转发 POST/PUT 等方法请求体 |
| 🚫 **编解码修复** | 自动删除 content-encoding 头，防止浏览器重复解压失败 |
| 📊 **实时日志** | 结构化 JSON 日志，方便监控与调试 |
| ✅ **CORS 支持** | 自动添加跨域头，可直接在浏览器中调用 |

## 项目结构

```
├── edgeone.json                  # 项目配置
├── index.html                    # 静态首页（生产环境 CDN 托管）
├── README.md                     # 本文件
└── cloud-functions/
    └── [[default]].js            # Catch-all 云函数，处理所有代理请求
```

## 配置

`edgeone.json`:

```json
{
  "name": "your-project",
  "description": "Universal Proxy",
  "overseasRegions": ["ap-tokyo"],
  "cloudFunctions": {
    "overseasRegions": ["ap-tokyo"]
  }
}
```

> **注意**: `-a overseas` 参数确保部署到海外区域（不含中国大陆）。

## 本地开发

```bash
# 启动本地 dev server（默认 http://localhost:8088）
edgeone makers dev
```

支持热重载，修改代码后自动构建。

## 部署

```bash
# 部署到生产环境（海外区域）
edgeone makers deploy -n your-project -a overseas

# 部署到预览环境
edgeone makers deploy -n your-project -a overseas -e preview
```

## 技术栈

- **运行时**: EdgeOne Makers Cloud Functions (Node.js)
- **路由**: Catch-all (`[[default]].js`)
- **部署区域**: 东京 (ap-tokyo)

## 许可

MIT
