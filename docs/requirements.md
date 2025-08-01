# 1. 需求分析 (Requirements)

## 1.1 项目目标
- 封装 yt-dlp 为 MCP (Model Context Protocol) server，支持大模型客户端通过对话调用视频/音频下载与信息提取。
- 支持异步下载机制，任务ID查询进度与结果。
- 兼容 Supabase Edge Functions 云部署。

## 1.2 用户需求

### 核心功能需求
- 支持主流视频网站（YouTube、Bilibili、Douyin、Twitter、Facebook、Twitch、Instagram、TikTok 等）的视频/音频下载。
- 支持多种下载模式：单视频、音频提取、播放列表、批量下载。
- 支持格式/清晰度选择、字幕下载、断点续传、代理、Cookies、限速等常用功能。

### 任务管理需求
- 提供任务状态查询、结果获取、错误反馈。
- 支持任务的停止、重试、批量查询等管理操作。
- 任务状态持久化，支持服务重启后的任务恢复。

### API接口需求
- 原生支持 MCP (Model Context Protocol) 协议，便于AI客户端集成。
- 提供兼容的 REST API 接口，支持传统HTTP客户端。
- 统一的响应格式和错误处理机制。
- 完整的API文档和开发者体验。

### 性能和可靠性需求
- 异步任务处理，支持长时间下载任务。
- 进程级别的异常恢复和断点续传。
- 云端文件存储和CDN分发。
- 跨平台兼容性（Windows/Linux/macOS）。

## 1.3 业务场景
- AI 助手/大模型自动化下载与分析视频内容。
- 教育、内容归档、数据采集等自动化场景。

## 1.4 约束与假设
- 优先依赖 Deno 生态，其次使用 Node.js/nmp 包。
- 云端部署需兼容 Supabase Edge Functions。
- 任务状态与结果需持久化，支持重启恢复。

## 1.5 API接口规范

### MCP协议支持
- 基于 JSON-RPC 2.0 的 Model Context Protocol 实现
- 支持工具发现、调用和结果返回
- 与AI客户端（如Claude Desktop）的原生集成

### HTTP API设计
- RESTful 风格的补充接口
- 统一的 `ApiResponse<T>` 响应格式
- 标准HTTP状态码和自定义业务错误码

### 错误处理规范
- 统一错误码体系（0=成功，非0=错误）
- 详细的错误消息和上下文信息
- 支持国际化的错误提示

### 任务生命周期API
- 任务创建：返回任务ID和状态
- 状态查询：支持单个和批量查询
- 任务管理：支持停止、重试、取消操作
- 文件下载：通过任务ID直接下载产物

### 数据格式标准
- ISO 8601 时间格式
- UTF-8 字符编码
- JSON 数据交换格式
- 类型安全的 TypeScript 接口定义

## 1.6 主要参考
- yt-dlp 官方文档与社区教程
- MCP 协议规范
- Supabase Edge Functions 文档
- JSON-RPC 2.0 规范
- TypeScript 类型系统最佳实践
