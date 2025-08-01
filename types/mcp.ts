/**
 * MCP (Model Context Protocol) 类型定义
 * 基于 MCP 2024-11-05 规范
 */
import type { ApiResponse } from "./api.ts";



// 基础 JSON-RPC 类型
export interface JSONRPCRequest {
    jsonrpc: "2.0";
    id?: string | number | null;
    method: string;
    params?: unknown;
}

export interface JSONRPCResponse {
    jsonrpc: "2.0";
    id?: string | number | null;
    result?: unknown;
    error?: JSONRPCError;
}

export interface JSONRPCError {
    code: number;
    message: string;
    data?: unknown;
}

// MCP 工具相关类型
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[];
    };
}

/**
 * 工具标准响应类型，统一为 ApiResponse 格式
 */
export type MCPToolResult<T = unknown> = ApiResponse<T>;

export interface MCPToolHandler {
    tool: MCPTool;
    handler: (args: Record<string, unknown>) => Promise<MCPToolResult>;
}

// MCP 服务器信息
export interface MCPServerInfo {
    name: string;
    version: string;
    description?: string;
}

export interface MCPServerCapabilities {
    tools?: {
        list?: boolean;
        call?: boolean;
    };
}

// MCP 初始化相关
export interface MCPInitializeParams {
    protocolVersion: string;
    capabilities: {
        tools?: {
            list?: boolean;
            call?: boolean;
        };
    };
    clientInfo: {
        name: string;
        version: string;
    };
}

export interface MCPInitializeResult {
    protocolVersion: string;
    capabilities: MCPServerCapabilities;
    serverInfo: MCPServerInfo;
}

// 工具调用相关
export interface MCPToolCallParams {
    name: string;
    arguments?: Record<string, unknown>;
}

export interface MCPToolListResult {
    tools: MCPTool[];
}

// 执行结果类型
export interface ExecutorResult {
    success: boolean;
    output: string;
    error?: string;
}

// 存储上传结果
export interface StorageUploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

/**
 * 支持的任务类型
 */
export type TaskType =
    | "download_video"
    | "download_audio"
    | "download_playlist"
    | "get_formats"
    | "get_subtitles"
    | "get_thumbnail"
    | "get_comments"
    | "get_cookies"
    | "set_cookies"
    | "get_supported_sites"
    | "get_download_history";

/**
 * 任务状态
 */
export const TaskStatus = {
    PENDING: "pending",
    RUNNING: "running",
    SUCCESS: "success",
    FAILED: "failed",
    CANCELLED: "cancelled",
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

/**
 * 任务状态机：定义合法的状态转换
 */
export const TASK_STATE_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
    [TaskStatus.PENDING]: [TaskStatus.RUNNING, TaskStatus.CANCELLED],
    [TaskStatus.RUNNING]: [TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.CANCELLED],
    [TaskStatus.SUCCESS]: [], // 成功状态是终态
    [TaskStatus.FAILED]: [TaskStatus.PENDING], // 失败可以重新开始
    [TaskStatus.CANCELLED]: [TaskStatus.PENDING], // 取消可以重新开始
};

/**
 * 检查状态转换是否合法
 */
export function isValidStateTransition(from: TaskStatus, to: TaskStatus): boolean {
    return TASK_STATE_TRANSITIONS[from].includes(to);
}

/**
 * 任务基础结构
 */

/**
 * 通用下载产物条目（单文件/分片/playlist entry）
 */
export interface DownloadEntry {
    id: string; // 视频/音频/条目标识
    title: string;
    path?: string; // 本地存储路径
    downloadUrl?: string; // 可访问的下载链接
    status: TaskStatus | "partial" | "pending" | "downloading"; // 支持部分成功/分片
    progress?: number; // 0-100，下载进度
    size?: number; // 文件大小（字节）
    duration?: number;
    uploader?: string;
    ext?: string;
    playlist_index?: number;
    error?: string;
    [key: string]: unknown;
}

/**
 * 通用下载任务产物结构
 * - 单文件下载：entries.length === 1
 * - playlist/批量下载：entries.length > 1
 * - 支持分片/断点续传/部分成功
 */
export interface DownloadResult {
    entries: DownloadEntry[];
    // 总体状态/进度
    status: TaskStatus | "partial" | "pending" | "downloading";
    progress?: number; // 0-100
    error?: string;
    [key: string]: unknown;
}

export interface TaskBase {
    id: string;
    type: TaskType;
    status: TaskStatus;
    createdAt: string;
    updatedAt: string;
    input: Record<string, unknown>;
    meta?: Record<string, unknown>; // 下载前元信息
    result?: DownloadResult; // 下载产物信息，结构化
    error?: string;
    processId?: number; // 正在运行的进程 PID，用于异常恢复时终止进程
}
