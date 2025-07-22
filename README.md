# yt-dlp Worker MCP Server

基于 Supabase Edge Functions 的 MCP 服务器，提供视频下载、音频提取等功能。

## 快速启动

### 本地开发
```bash
# 启动服务器
deno task dev

# 服务器会在 http://localhost:8000 启动
```

### 部署到 Supabase
```bash
# 部署
deno task deploy:check

# 配置环境变量
supabase secrets set WORKER_DLP_API_KEY=your-api-key
supabase secrets set PROXY_URL=http://proxy:8080  # 可选
```

## MCP 客户端配置

### 方式 1: mcp-remote (推荐)
```json
{
  "servers": {
    "worker-dlp": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8000"],
      "type": "stdio",
      "env": {
        "WORKER_DLP_API_KEY": "<api key>",
        "PROXY_URL": "http://127.0.0.1:10808"
      }
    }
  }
}
```

### 方式 2: 直接 HTTP
```json
{
  "servers": {
    "worker-dlp": {
      "url": "http://localhost:8000",
      "type": "http",
      "headers": {
        "Authorization": "Bearer <api key>"
      }
    }
  }
}
```

## 🔧 可用工具

- `get_video_info` - 获取视频信息
- `download_video` - 下载视频
- `download_audio` - 提取音频
- `get_formats` - 查询可用格式
- `download_playlist` - 下载播放列表

## 📚 使用示例

### 获取视频信息
```bash
curl -X POST http://localhost:8000 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <api key>" 
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_video_info","arguments":{"url":"https://youtube.com/watch?v=example"}},"id":1}'
```

### 下载视频
```bash
curl -X POST http://localhost:8000 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <api key>" 
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"download_video","arguments":{"url":"https://youtube.com/watch?v=example","quality":"720p"}},"id":1}'
```

## 🏗️ 项目架构

```
worker-dlp/
├── index.ts                 # 主入口文件
├── config.ts                # 配置管理
├── deps.ts                  # 依赖管理
├── lib/                     # 核心库
│   ├── executor.ts          # yt-dlp 执行器
│   ├── storage.ts           # 存储管理
│   └── mcp-server.ts        # MCP 服务器
├── tools/                   # 工具实现
│   ├── registry.ts          # 工具注册
│   ├── video-info.ts        # 视频信息
│   ├── download-video.ts    # 视频下载
│   ├── download-audio.ts    # 音频提取
│   ├── get-formats.ts       # 格式查询
│   └── download-playlist.ts # 播放列表
└── types/                   # 类型定义
    └── mcp.ts
```

## 📋 开发任务

```bash
# 开发
deno task dev        # 本地开发
deno task start      # 本地启动

# Supabase
deno task supabase:dev       # Supabase 本地开发
deno task supabase:deploy    # 部署到 Supabase
deno task supabase:logs      # 查看日志

# 工具
deno task check              # 类型检查
deno task fmt                # 格式化
deno task lint               # 代码检查
```
