# 2. 系统设计 (Design)

## 2.1 架构概览
- 入口层：index.ts（HTTP 路由，JSON-RPC 分发）
- MCP Server：lib/mcp-server.ts（协议解析、工具分发、统一响应）
- 工具层：tools/（每个功能单独文件，注册于 registry.ts）
- 执行层：lib/executor.ts（yt-dlp 调用，异步任务队列）
- 存储层：lib/storage.ts（任务状态与结果持久化）
- 类型层：types/mcp.ts（统一输入输出、任务、工具等类型）
- 配置层：config.ts（环境变量、运行参数）
- 日志与监控：logs/（运行日志、错误日志）

## 2.2 关键模块设计

### 工具注册与发现
- 工具注册表自动化，支持新工具零配置注册。
- 动态扫描 `tools/` 目录，自动导入符合规范的工具模块。
- 统一的工具接口：`{ name, tool, handler }`。

### 任务状态机
任务具有明确的生命周期和状态转换规则：

```
pending → running → success
       ↘        ↘ failed
                ↘ cancelled
```

**状态说明**：
- `pending`: 任务已创建，等待执行
- `running`: 任务正在执行中
- `success`: 任务执行成功
- `failed`: 任务执行失败
- `cancelled`: 任务被手动取消

**状态转换规则**：
- 只能从 `pending` 转换到 `running`
- 从 `running` 可以转换到 `success`、`failed` 或 `cancelled`
- 从 `failed` 可以通过重试转换回 `pending`
- 其他状态转换均为非法

### 进程管理机制
- **进程生命周期跟踪**：每个运行中的任务都有对应的 `processId`
- **异常检测**：服务启动时自动检测孤儿任务并修复状态
- **优雅退出**：服务关闭时主动终止所有子进程
- **跨平台兼容**：Windows 使用 `taskkill`，Unix 使用 `kill` 信号

### API 设计

#### MCP 工具 API
基于 JSON-RPC 2.0 协议：
- `download_video`: 单视频下载
- `download_playlist`: 播放列表下载
- `get_task_status`: 任务状态查询
- `stop_task`: 停止任务
- `retry_task`: 重试任务

#### HTTP REST API
- `GET /`: 服务器状态页面
- `GET /storage/{id}`: 文件下载接口
- `POST /`: MCP JSON-RPC 调用入口
- 计划支持：`GET /task/{id}` 任务状态查询

#### 响应格式标准化
所有API均返回统一的 `ApiResponse<T>` 格式：
```typescript
{
  code: number;    // 0=成功，非0=错误
  msg: string;     // 人可读的消息
  data?: T;        // 类型安全的数据载荷
}
```

### 数据持久化
- **任务存储**：基于 LRU 缓存的内存存储，支持JSON序列化持久化
- **文件管理**：统一的输出目录结构，支持云端上传
- **状态恢复**：服务重启时自动恢复任务状态和进程映射

### 错误处理与监控
- **分层错误处理**：工具层、执行层、协议层的错误传播
- **错误码体系**：标准化的错误分类和编码
- **日志记录**：结构化日志，支持调试和监控
- **健康检查**：任务状态监控和自动修复机制

## 2.3 扩展性与健壮性

### 模块化扩展机制
- **新增工具**：只需实现 handler 函数并放置在 `tools/` 目录，自动注册发现
- **工具模板**：统一的工具接口规范，包含参数验证、错误处理等
- **类型安全**：完整的 TypeScript 类型定义，编译时错误检查

### 异常恢复能力
- **任务持久化**：任务状态和结果持久化到本地存储
- **进程管理**：完整的进程生命周期管理和异常清理
- **状态同步**：任务状态与实际进程状态的强一致性保证
- **断点续传**：支持部分完成任务的恢复执行

### 性能与可靠性
- **异步执行**：所有下载任务均为异步执行，避免阻塞
- **资源限制**：合理的并发控制和资源使用限制
- **错误重试**：可配置的重试策略和退避算法
- **监控告警**：任务执行状态的实时监控和异常告警

### 云端集成
- **存储服务**：与 Supabase Storage 的无缝集成
- **边缘计算**：基于 Supabase Edge Functions 的全球部署
- **配置管理**：环境变量驱动的配置系统
- **日志分析**：结构化日志便于云端分析和监控

## 2.4 安全与权限控制

### 访问控制
- **API密钥认证**：可选的Bearer Token认证机制
- **请求限流**：防止恶意请求和资源滥用
- **输入验证**：严格的参数验证和sanitization

### 文件安全
- **路径限制**：严格限制文件访问路径，防止目录遍历
- **内容检查**：下载内容的基础安全检查
- **访问控制**：文件下载的权限验证机制

## 2.4 参考工具清单（建议优先支持）
- get_video_info
- download_video
- download_audio
- get_formats
- download_playlist
- get_subtitles
- get_thumbnail
- get_comments
- get_cookies
- set_cookies
- get_supported_sites
- get_download_history
