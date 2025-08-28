import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node18', // 指定 Node.js 版本
    ssr: true,       // 启用服务端渲染，允许使用 Node.js API
  },
});
