/**
 * MCP (Model Context Protocol) 类型定义
 * 基于 MCP 2024-11-05 规范
 */

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

export interface MCPToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
}

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
