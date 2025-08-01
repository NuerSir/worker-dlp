
# 3. 实现计划 (Implementation Task CoT 拆解）
- [x] 任务类型与状态定义（types/mcp.ts）
- [x] 任务存储与状态管理模块（lib/storage.ts）
- [x] yt-dlp 执行器支持异步任务（lib/executor.ts）
- [x] download_video 工具异步化（tools/download-video.ts）
- [x] MCP server 支持任务ID返回与状态查询（lib/mcp-server.ts）


- [x] 在 types/api.ts 新建标准响应类型（如 ApiResponse、ApiError、ApiSuccess），统一 code/msg/data 结构。
- [x] 所有 yt-dlp -o 路径统一用 config，确保产物全部在 storage/files 下。
- [x] 下载前用 yt-dlp --dump-json 获取元信息（如 title、id、duration、uploader），写入任务（task.input 或 task.meta）。
- [x] 下载完成后将本地文件路径、title、id等写入 task.result。
- [x] 合集下载 task.result 为数组，包含每个文件的详细信息（如 path、title、index、状态等）。
- [x] index.ts 新增 /task/{id} 路由，返回标准 JSON 响应，包含任务状态、元数据、产物（如单视频/合集/字幕等）。
- [x] /storage/{id} 只做实际文件下载（或 404/403/410），不再返回任务状态。
- [x] downloadTask、所有工具等全部用统一 ApiResponse 类型，错误时 code 非0，msg 详细，data 为任务状态或错误详情。
- [x] 错误码体系与 msg 语义细化，便于前端和自动化消费。


[主线任务内容保持不变]
- [x] 工具/任务产物结构标准化，PlaylistEntry 类型细化，entries 字段类型安全，彻底消除 any 类型。
- [x] MCPToolResult、ApiResponse、错误码体系全局统一，handler 签名、类型、返回结构全链路对齐。
- [x] downloadTask 任务产物结构、状态持久化、可恢复（基础已实现，后续可细化异常恢复和断点续传）。
- [x] downloadTask 接口增强，支持 task 参数传递，消除重复 getMeta API 调用，提升代码质量和工程标准。
- [x] 代码质量优化：消除所有 any 类型使用，类型安全完全达标，抽象层完整性保持。
- [x] downloadTask 任务异常恢复、断点续传等持久化能力增强。
    - [x] 任务 result 字段结构支持分片/多文件进度与状态，便于前端/自动化实时展示与断点续传。
    - [x] downloadTask/onDownload 实现幂等性，避免重复调度导致产物冲突。
    - [x] 支持 playlist/大文件任务的分片断点续传，重启后仅恢复未完成部分。
    - [x] 任务进度、失败、部分成功等状态细化，便于自动化监控和重试。
    - [x] 服务进程异常/退出时任务一致性与恢复能力（CoT 拆解）
        - [x] 进程退出前主动终止所有正在运行的 Deno.Command 子进程，确保不会有孤儿下载进程。
        - [x] storage 持久化层增加“正在运行/失败/已完成”等任务状态的高效查询方法。
        - [x] 服务启动时自动检测所有处于 running 状态但实际未被监控的任务，将其标记为 failed 或 pending，便于后续恢复。
        - [x] 设计任务状态机，确保任务状态与实际进程生命周期强一致。
        - [x] 提供管理接口/命令，支持手动终止、恢复、重试任务。
        - [x] 文档补充：说明 Deno 独立运行下的任务一致性与恢复机制。
- [x] API/工具文档补全，产物结构说明补充到 README.md、docs/requirements.md、docs/design.md。
    - [x] README.md 更新：实际可用工具列表、完整API示例、项目架构图
    - [x] 新增 docs/api.md：完整的API接口文档、数据结构、错误码、使用示例
    - [x] requirements.md 补充：API接口规范、错误处理规范、任务生命周期
    - [x] design.md 扩展：任务状态机、进程管理、API设计、安全机制
    - [x] MCP JSON-RPC 响应格式修复：认证失败时正确返回请求ID，避免客户端超时错误
- [ ] 更多 yt-dlp 能力工具扩展（如 get-formats、extract-info 等），并注册到 registry。
- [ ] 增加单元测试/集成测试，确保类型安全和产物结构长期可用。
- [ ] 前后端联调，收集实际使用问题，优化字段、结构和错误提示。

- [ ] get_formats 工具完善（tools/get-formats.ts）
- [ ] download_audio 工具实现（tools/download-audio.ts）
- [x] download_playlist 工具实现（tools/download-playlist.ts）


## 3.1.1 API接口设计与扩展
- [ ] 统一API接口设计与文档，明确各接口用途、返回结构、扩展点。
    - [ ] /task/{id}：查询任务状态、元信息、产物（支持单视频、playlist、未来扩展meta/字幕等）。
    - [ ] /storage/{id}：下载实际产物文件，仅做文件流返回，不返回任务状态。
    - [ ] /task/{id}/meta：获取任务的元信息（如视频/音频/playlist元数据）。
    - [ ] /task/{id}/subtitles：获取任务关联的字幕文件（如有）。
    - [ ] /task/{id}/logs：获取任务执行日志（便于调试和错误追踪）。
    - [ ] 未来可扩展更多接口，如 /task/{id}/thumbnail、/task/{id}/comments、/task/{id}/formats 等。
    - [ ] 补充API返回结构、错误码、字段说明到README和设计文档。

## 3.2 阶段二：高级功能与扩展
- [ ] get_subtitles 工具实现（tools/get-subtitles.ts）
- [ ] get_thumbnail 工具实现（tools/get-thumbnail.ts）
- [ ] get_comments 工具实现（tools/get-comments.ts）
- [ ] get_cookies/set_cookies 工具实现（tools/get-cookies.ts, tools/set-cookies.ts）
- [ ] get_supported_sites 工具实现（tools/get-supported-sites.ts）
- [ ] get_download_history 工具实现（tools/get-download-history.ts）


- [ ] downloadTask/工具产物幂等性与断点续传机制完善（如分片校验、产物去重、自动重试等）。
    - [ ] 进程退出时自动清理/终止所有子进程，防止资源泄漏和状态不一致。
    - [ ] storage 层支持任务状态高效检索与批量状态修正。
    - [ ] 启动时自动修正所有未被监控的 running 任务状态。
    - [ ] 任务状态机与进程生命周期强一致性设计与实现。
    - [ ] 提供任务管理接口，支持手动终止/恢复/重试。
    - [ ] 健壮性机制文档补充。
- [ ] 错误处理与日志细化（lib/utils.ts、logs/）。
- [ ] API 文档与注释标准（README.md、openapi-mcp.yaml）。
- [ ] 测试用例与验收脚本（test/）。


> 顺序说明：
> 1-2为基础设施，3-5为任务数据结构和产物绑定，6-7为API路由分离，8-9为全局标准化和细化。
> 建议严格按顺序推进，避免数据结构和API不一致。

## 任务模板（每个任务建议附带如下信息）
- 任务描述：
- 技术要点：
- 预期输出：
- 验收标准：
- 后续依赖：


---

> 开发建议：
> 建议严格按顺序推进主线任务，先完成基础设施，再做数据结构和产物绑定，最后实现 API 路由分离和全局标准化，避免数据结构和 API 不一致。
> 对应任务完成后使用 **x** 标记完成。