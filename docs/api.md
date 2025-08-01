# API 文档

本文档详细说明了 worker-dlp MCP 服务器的所有API接口、数据结构和使用方法。

## 目录

- [概述](#概述)
- [认证](#认证)
- [MCP 工具 API](#mcp-工具-api)
- [HTTP API](#http-api)
- [数据结构](#数据结构)
- [错误码](#错误码)
- [示例](#示例)

## 概述

worker-dlp 提供两种API接口：

1. **MCP 工具 API** - 基于 Model Context Protocol 的 JSON-RPC 接口
2. **HTTP API** - 传统的 REST 风格接口

所有API都遵循统一的响应格式和错误处理规范。

### 基础信息

- **服务地址**: `http://localhost:8000` (本地开发)
- **协议**: HTTP/HTTPS
- **内容类型**: `application/json`
- **字符编码**: UTF-8

## 认证

### API 密钥认证（可选）

如果服务器配置了API密钥，所有请求都需要包含认证头：

```http
Authorization: Bearer <api_key>
```

### 示例
```bash
curl -H "Authorization: Bearer your-api-key" \
     -H "Content-Type: application/json" \
     http://localhost:8000
```

## MCP 工具 API

基于 JSON-RPC 2.0 协议的工具调用接口。

### 请求格式

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "<tool_name>",
    "arguments": {
      // 工具特定参数
    }
  },
  "id": 1
}
```

### 响应格式

```json
{
  "jsonrpc": "2.0",
  "result": {
    "code": 0,
    "msg": "操作成功",
    "data": {
      // 响应数据
    }
  },
  "id": 1
}
```

### 可用工具

#### 1. download_video

下载单个视频到云端存储。

**参数**:
```typescript
{
  url: string;           // 要下载的视频URL（必需）
  format?: string;       // 格式选择器，默认 "best"
  quality?: string;      // 画质偏好，如 "720p", "1080p"
  output_template?: string; // 输出文件名模板
  sync?: boolean;        // 是否同步等待，默认 false
}
```

**响应**:
```typescript
{
  code: 0;
  msg: string;
  data: {
    taskId: string;      // 任务ID
    status: string;      // 任务状态
    downloadUrl: string; // 下载链接
  }
}
```

**示例**:
```json
{
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
}
```

#### 2. download_playlist

下载播放列表/合集到云端存储。

**参数**:
```typescript
{
  url: string;           // 播放列表URL（必需）
  format?: string;       // 格式选择器，默认 "best"
  quality?: string;      // 画质偏好
  max_downloads?: number; // 最大下载数量
  playlist_start?: number; // 开始索引（1-based）
  playlist_end?: number;   // 结束索引（1-based）
  output_template?: string; // 输出文件名模板
  sync?: boolean;        // 是否同步等待，默认 false
}
```

**响应**:
```typescript
{
  code: 0;
  msg: string;
  data: {
    taskId: string;      // 任务ID
    status: string;      // 任务状态
    downloadUrl: string; // 下载链接
  }
}
```

#### 3. get_task_status

查询任务状态，支持单个任务或批量查询。

**参数**:
```typescript
{
  taskId?: string;       // 任务ID（可选）
  status?: "pending" | "running" | "success" | "failed" | "cancelled"; // 状态过滤
  limit?: number;        // 返回数量限制，默认10
}
```

**响应**:

单个任务查询:
```typescript
{
  code: 0;
  msg: string;
  data: {
    task: TaskInfo;      // 任务详情
  }
}
```

批量查询:
```typescript
{
  code: 0;
  msg: string;
  data: {
    tasks: TaskInfo[];   // 任务列表
    total: number;       // 总数量
    filtered?: object;   // 过滤条件
  }
}
```

#### 4. stop_task

停止正在运行的任务。

**参数**:
```typescript
{
  taskId: string;        // 要停止的任务ID（必需）
}
```

**响应**:
```typescript
{
  code: 0;
  msg: string;
  data: {
    taskId: string;
    previousStatus: string;
    newStatus: "cancelled";
  }
}
```

#### 5. retry_task

重试失败的任务。

**参数**:
```typescript
{
  taskId: string;        // 要重试的任务ID（必需）
}
```

**响应**:
```typescript
{
  code: 0;
  msg: string;
  data: {
    taskId: string;
    previousStatus: string;
    newStatus: "pending";
  }
}
```

## HTTP API

### 文件下载接口

#### GET /storage/{taskId}

下载任务产物文件。

**路径参数**:
- `taskId`: 任务ID

**响应**:
- **成功 (200)**: 文件流下载
- **任务未完成 (200)**: JSON格式的任务状态信息
- **任务不存在 (404)**: 错误信息
- **文件不存在 (410)**: 错误信息
- **服务器错误 (500)**: 错误信息

**示例**:
```bash
# 下载文件
curl -o video.mp4 http://localhost:8000/storage/task_abc123

# 查看任务状态（如果未完成）
curl http://localhost:8000/storage/task_abc123
```

**未完成任务的响应示例**:
```json
{
  "error": "文件未就绪或任务未成功",
  "status": "running",
  "message": "任务正在执行",
  "downloadUrl": "http://localhost:8000/storage/task_abc123",
  "task": {
    "id": "task_abc123",
    "type": "download_video",
    "status": "running",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:01:00Z",
    "input": {
      "url": "https://youtube.com/watch?v=example"
    }
  }
}
```

### 任务查询接口（计划中）

#### GET /task/{taskId}

查询任务详细信息。

**路径参数**:
- `taskId`: 任务ID

**响应**:
```typescript
{
  code: 0;
  msg: string;
  data: {
    task: TaskInfo;
  }
}
```

### REST API（兼容模式）

#### POST /

支持传统REST风格的API调用。

**请求**:
```json
{
  "url": "https://youtube.com/watch?v=example",
  "action": "download",  // 操作类型: "download", "info", "audio", "playlist"
  "quality": "720p",
  // 其他参数...
}
```

**Action 映射**:
- `info` → `get_video_info`
- `download` → `download_video`
- `audio` → `download_audio`
- `formats` → `get_formats`
- `playlist` → `download_playlist`

## 数据结构

### TaskInfo

任务详细信息结构。

```typescript
interface TaskInfo {
  id: string;              // 任务ID
  type: string;            // 任务类型
  status: TaskStatus;      // 任务状态
  createdAt: string;       // 创建时间（ISO格式）
  updatedAt: string;       // 更新时间（ISO格式）
  processId?: number;      // 进程ID（运行时）
  input: Record<string, unknown>; // 输入参数
  meta?: VideoMeta;        // 视频元信息
  result?: DownloadResult; // 下载结果
  error?: string;          // 错误信息
}
```

### TaskStatus

任务状态枚举。

```typescript
type TaskStatus = 
  | "pending"    // 等待中
  | "running"    // 运行中
  | "success"    // 成功
  | "failed"     // 失败
  | "cancelled"; // 已取消
```

### VideoMeta

视频元信息结构。

```typescript
interface VideoMeta {
  id: string;              // 视频ID
  title: string;           // 标题
  description?: string;    // 描述
  duration?: number;       // 时长（秒）
  uploader?: string;       // 上传者
  upload_date?: string;    // 上传日期
  view_count?: number;     // 观看次数
  ext?: string;            // 文件扩展名
  thumbnail?: string;      // 缩略图URL
  webpage_url?: string;    // 网页URL
}
```

### DownloadResult

下载结果结构。

```typescript
interface DownloadResult {
  entries: DownloadEntry[]; // 下载条目列表
}

interface DownloadEntry {
  id: string;              // 条目ID
  title: string;           // 标题
  path: string;            // 本地文件路径
  downloadUrl?: string;    // 下载URL
  status: string;          // 状态
  progress: number;        // 进度（0-100）
  size?: number;           // 文件大小（字节）
  duration?: number;       // 时长（秒）
  uploader?: string;       // 上传者
  ext?: string;            // 文件扩展名
  playlist_index?: number; // 播放列表索引
}
```

### ApiResponse

统一API响应格式。

```typescript
interface ApiResponse<T = unknown> {
  code: number;            // 响应码：0=成功，非0=错误
  msg: string;             // 响应消息
  data?: T;                // 响应数据
}
```

## 错误码

### 标准错误码

| 代码 | 常量 | 含义 | 说明 |
|------|------|------|------|
| 0 | `OK` | 成功 | 操作成功完成 |
| 1001 | `INVALID_PARAM` | 参数错误 | 请求参数无效或缺失 |
| 1002 | `NOT_FOUND` | 资源不存在 | 请求的资源不存在 |
| 2001 | `DOWNLOAD_FAILED` | 下载失败 | 视频下载过程中发生错误 |
| 2002 | `META_FETCH_FAILED` | 元信息获取失败 | 无法获取视频元信息 |
| 5000 | `INTERNAL_ERROR` | 内部错误 | 服务器内部错误 |

### JSON-RPC 错误码

| 代码 | 含义 | 说明 |
|------|------|------|
| -32700 | 解析错误 | JSON格式无效 |
| -32600 | 请求无效 | JSON-RPC格式错误 |
| -32601 | 方法不存在 | 请求的方法不存在 |
| -32602 | 参数无效 | 方法参数无效 |
| -32603 | 内部错误 | JSON-RPC内部错误 |
| -32001 | 未授权 | API密钥无效或缺失 |

## 示例

### 完整下载流程示例

#### 1. 启动下载任务

```bash
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "download_video",
      "arguments": {
        "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
        "quality": "720p"
      }
    },
    "id": 1
  }'
```

响应：
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

#### 2. 查询任务状态

```bash
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
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

响应（运行中）：
```json
{
  "jsonrpc": "2.0",
  "result": {
    "code": 0,
    "msg": "查询成功",
    "data": {
      "task": {
        "id": "task_abc123",
        "type": "download_video",
        "status": "running",
        "processId": 12345,
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-01T00:01:00Z",
        "input": {
          "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
          "quality": "720p"
        },
        "meta": {
          "id": "dQw4w9WgXcQ",
          "title": "Rick Astley - Never Gonna Give You Up",
          "duration": 212,
          "uploader": "RickAstleyVEVO"
        }
      }
    }
  },
  "id": 2
}
```

#### 3. 下载完成后获取文件

```bash
# 直接下载文件
curl -o "Never Gonna Give You Up.mp4" \
     http://localhost:8000/storage/task_abc123
```

### 播放列表下载示例

```bash
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "download_playlist",
      "arguments": {
        "url": "https://youtube.com/playlist?list=PLrAXtmRdnEQy4SJqiPUk9JsQZ6xCFz5kT",
        "max_downloads": 3,
        "quality": "480p"
      }
    },
    "id": 1
  }'
```

### 任务管理示例

#### 停止任务

```bash
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "stop_task",
      "arguments": {
        "taskId": "task_abc123"
      }
    },
    "id": 1
  }'
```

#### 重试失败的任务

```bash
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "retry_task",
      "arguments": {
        "taskId": "task_abc123"
      }
    },
    "id": 1
  }'
```

#### 批量查询任务

```bash
# 查询所有失败的任务
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_task_status",
      "arguments": {
        "status": "failed",
        "limit": 20
      }
    },
    "id": 1
  }'
```

### 错误处理示例

#### 参数错误

请求：
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "download_video",
    "arguments": {
      // 缺少必需的 url 参数
    }
  },
  "id": 1
}
```

响应：
```json
{
  "jsonrpc": "2.0",
  "result": {
    "code": 1001,
    "msg": "参数错误：缺少必需的 url 参数",
    "data": null
  },
  "id": 1
}
```

#### 任务不存在

请求：
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_task_status",
    "arguments": {
      "taskId": "invalid_task_id"
    }
  },
  "id": 1
}
```

响应：
```json
{
  "jsonrpc": "2.0",
  "result": {
    "code": 1002,
    "msg": "任务不存在",
    "data": {
      "taskId": "invalid_task_id"
    }
  },
  "id": 1
}
```

## 最佳实践

### 1. 异步任务处理

- 大部分下载任务都应该使用异步模式（`sync: false`）
- 通过 `get_task_status` 定期轮询任务状态
- 使用 `/storage/{taskId}` 接口下载完成的文件

### 2. 错误处理

- 始终检查响应中的 `code` 字段
- 根据错误码进行适当的重试或用户提示
- 对于网络相关错误，可以考虑自动重试

### 3. 任务管理

- 定期清理失败或过期的任务
- 使用 `stop_task` 及时停止不需要的任务
- 利用 `retry_task` 重试临时失败的任务

### 4. 性能优化

- 合理设置 `max_downloads` 避免过大的播放列表
- 根据需求选择合适的画质和格式
- 考虑使用 `playlist_start` 和 `playlist_end` 分段下载大型播放列表

---

> 📝 **注意**: 此API文档会随着项目发展持续更新。建议关注项目的 CHANGELOG 或 release notes 了解最新变化。
