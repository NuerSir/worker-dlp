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

### 核心下载工具
- `download_video` - 下载单个视频到云端存储
- `download_playlist` - 下载播放列表/合集到云端存储

### 任务管理工具
- `get_task_status` - 查询任务状态（单个/批量查询）
- `stop_task` - 停止正在运行的任务
- `retry_task` - 重试失败的任务

### 即将支持的工具
- `get_video_info` - 获取视频元信息（开发中）
- `download_audio` - 提取音频文件（开发中）
- `get_formats` - 查询可用格式（开发中）

## 📚 使用示例

### MCP 工具调用

#### 下载视频
```bash
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api key>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "download_video",
      "arguments": {
        "url": "https://youtube.com/watch?v=example",
        "quality": "720p",
        "sync": false
      }
    },
    "id": 1
  }'
```

响应示例：
```json
{
  "jsonrpc": "2.0",
  "result": {
    "code": 0,
    "msg": "任务已创建",
    "data": {
      "taskId": "task_abc123",
      "status": "pending",
      "downloadUrl": "http://localhost:8000/storage/task_abc123"
    }
  },
  "id": 1
}
```

#### 查询任务状态
```bash
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api key>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_task_status",
      "arguments": {
        "taskId": "task_abc123"
      }
    },
    "id": 2
  }'
```

#### 下载播放列表
```bash
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api key>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "download_playlist",
      "arguments": {
        "url": "https://youtube.com/playlist?list=example",
        "max_downloads": 5
      }
    },
    "id": 3
  }'
```

### HTTP API 接口

#### 文件下载接口
```bash
# 下载任务产物文件
GET /storage/{taskId}

# 响应：
# - 成功时：文件流下载
# - 失败时：JSON错误信息
```

#### 任务状态查询（计划中）
```bash
# 查询任务详情
GET /task/{taskId}

# 响应示例：
{
  "code": 0,
  "msg": "查询成功",
  "data": {
    "task": {
      "id": "task_abc123",
      "type": "download_video",
      "status": "success",
      "result": { ... },
      "createdAt": "2025-01-01T00:00:00Z"
    }
  }
}
```

### REST API（兼容模式）
```bash
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api key>" \
  -d '{
    "url": "https://youtube.com/watch?v=example",
    "action": "download",
    "quality": "720p"
  }'
```

## 🏗️ 项目架构

```
worker-dlp/
├── index.ts                 # 主入口文件和HTTP路由
├── config.ts                # 配置管理
├── deps.ts                  # 依赖管理
├── lib/                     # 核心库
│   ├── executor.ts          # yt-dlp 执行器
│   ├── storage.ts           # 任务状态和文件存储
│   ├── mcp-server.ts        # MCP 协议服务器
│   ├── download-task.ts     # 任务管理和执行
│   ├── process-manager.ts   # 进程生命周期管理
│   ├── tool-registry.ts     # 工具注册和发现
│   └── utils.ts             # 通用工具函数
├── tools/                   # MCP 工具实现
│   ├── download-video.ts    # 单视频下载
│   ├── download-playlist.ts # 播放列表下载
│   ├── get-task-status.ts   # 任务状态查询
│   ├── retry-task.ts        # 任务重试
│   └── stop-task.ts         # 任务停止
├── types/                   # 类型定义
│   ├── mcp.ts              # MCP协议和任务类型
│   └── api.ts              # API响应类型
├── docs/                    # 项目文档
│   ├── requirements.md      # 需求分析
│   ├── design.md           # 系统设计
│   ├── tasks.md            # 开发任务
│   └── recovery-mechanism.md # 异常恢复机制
└── tmp/                     # 临时文件和任务状态
    ├── tasks.json          # 任务持久化存储
    └── files/              # 下载文件临时目录
```

## 📋 开发任务

### 本地开发
```bash
deno task dev        # 启动开发服务器 (http://localhost:8000)
deno task start      # 启动生产服务器
```

### Supabase 部署
```bash
deno task supabase:dev       # Supabase 本地开发环境
deno task supabase:deploy    # 部署到 Supabase Edge Functions
deno task supabase:logs      # 查看部署日志
```

### 代码质量
```bash
deno task check              # TypeScript 类型检查
deno task fmt                # 代码格式化
deno task lint               # 代码规范检查
```

## 📖 详细文档

- [API 文档](docs/api.md) - 📚 API接口参考和使用示例
- [需求分析](docs/requirements.md) - 📋 项目目标和用户需求
- [系统设计](docs/design.md) - 🏗️ 架构设计和模块说明  
- [开发任务](docs/tasks.md) - 📝 实现计划和进度跟踪
- [异常恢复机制](docs/recovery-mechanism.md) - 🔧 进程管理和任务恢复

## 🌟 特性

- **异步任务处理** - 支持长时间下载任务，通过任务ID查询进度
- **进程管理** - 完整的进程生命周期管理和异常恢复机制
- **云端存储** - 自动上传到云端并生成可访问链接
- **MCP 协议** - 原生支持 Model Context Protocol，便于AI集成
- **跨平台** - 基于Deno，支持Windows/Linux/macOS
- **可扩展** - 模块化设计，易于添加新的下载源和功能

## 🔒 安全说明

- 支持API密钥认证（可选）
- 文件访问控制和安全验证
- 进程隔离和资源限制
