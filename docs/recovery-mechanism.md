# 任务一致性与恢复机制

本文档说明 worker-dlp 在 Deno 独立运行环境下的任务一致性与恢复机制。

## 概述

worker-dlp 实现了完整的任务生命周期管理，确保下载任务在各种异常情况下的数据一致性和可恢复性。

## 核心机制

### 1. 任务状态机

任务遵循严格的状态流转规则：

```
PENDING → RUNNING → SUCCESS/FAILED/CANCELLED
    ↓         ↓
CANCELLED → PENDING (可重试)
FAILED   → PENDING (可重试)
```

**状态定义**：
- `PENDING`: 等待执行
- `RUNNING`: 正在执行
- `SUCCESS`: 执行成功（终态）
- `FAILED`: 执行失败
- `CANCELLED`: 手动取消

**状态校验**：每次状态变更都会通过 `isValidStateTransition()` 校验合法性。

### 2. 进程管理

#### 进程 PID 记录
- 每个执行中的任务在 `TaskBase.processId` 中记录对应的 `yt-dlp` 进程 PID
- 进程启动时自动记录，完成或异常时自动清除

#### 优雅退出
服务退出时自动执行：
1. 遍历所有 `RUNNING` 状态的任务
2. 根据 `processId` 终止对应进程：
   - Windows: `taskkill /F /PID <pid>`
   - Unix-like: `kill -9 <pid>`
3. 更新任务状态为 `FAILED`

### 3. 启动时恢复

#### 孤儿任务检测
服务启动时自动执行：
1. 查询所有 `RUNNING` 状态的任务
2. 检查对应 `processId` 是否还在运行：
   - Windows: `tasklist /FI "PID eq <pid>"`
   - Unix-like: `ps -p <pid>`
3. 不存在的进程对应任务标记为 `FAILED`

#### 断点续传
- 支持 playlist 任务的分片断点续传
- 通过 `task.result.entries` 恢复每个文件的下载状态
- 已成功的文件自动跳过，仅重试失败或未完成的部分

### 4. 幂等性保证

#### yt-dlp 层面
- 所有下载命令添加 `-c` 参数支持断点续传
- 避免重复下载相同文件

#### 应用层面
- 任务状态更新具有事务性
- 重复调用 `downloadTask` 不会产生冲突

## API 接口

### 任务管理接口

#### `stop_task` - 手动终止任务
```json
{
  "name": "stop_task",
  "arguments": {
    "taskId": "task_123"
  }
}
```

#### `retry_task` - 重试失败任务
```json
{
  "name": "retry_task", 
  "arguments": {
    "taskId": "task_123"
  }
}
```

#### `get_task_status` - 查询任务状态
```json
{
  "name": "get_task_status",
  "arguments": {
    "taskId": "task_123",  // 可选，不提供则查询所有
    "status": "running",   // 可选，按状态过滤
    "limit": 10           // 可选，限制返回数量
  }
}
```

## 数据持久化

### 存储结构
- 任务数据存储在 `storage/tasks.json`
- 下载文件存储在 `storage/files/`
- 使用 LRU 缓存提升查询性能

### 容错机制
- 文件写入带重试和超时机制
- 启动时自动修复损坏的任务状态
- 支持并发访问的任务状态同步

## 错误处理

### 分级处理
1. **进程级错误**: 进程异常退出，自动标记任务失败
2. **任务级错误**: 单个下载失败，支持重试机制  
3. **系统级错误**: 服务重启，自动恢复所有任务状态

### 日志记录
- 所有状态变更都有详细日志
- 包含任务 ID、状态转换、时间戳等关键信息
- 便于问题排查和监控告警

## 最佳实践

### 部署建议
1. 配置进程管理器（如 systemd、pm2）自动重启
2. 定期备份 `storage/tasks.json` 文件
3. 监控磁盘空间，避免下载文件占满存储

### 监控建议
1. 监控长时间 `RUNNING` 状态的任务
2. 定期检查孤儿任务数量
3. 关注任务失败率和重试频率

## 技术细节

### 跨平台兼容性
- 进程管理命令针对不同操作系统适配
- 文件路径处理兼容 Windows/Unix

### 性能优化
- LRU 缓存减少文件 I/O
- 批量状态更新减少持久化开销
- 异步处理避免阻塞主流程

## 故障场景处理

### 场景 1: 服务异常退出
- **检测**: 启动时发现 `RUNNING` 任务但进程不存在
- **处理**: 自动标记为 `FAILED`，可手动重试

### 场景 2: 网络中断
- **检测**: yt-dlp 进程超时或返回网络错误
- **处理**: 任务标记为 `FAILED`，支持断点续传重试

### 场景 3: 磁盘空间不足
- **检测**: yt-dlp 返回磁盘空间错误
- **处理**: 任务标记为 `FAILED`，清理临时文件

### 场景 4: 手动中断
- **检测**: 用户调用 `stop_task`
- **处理**: 优雅终止进程，状态标记为 `CANCELLED`
