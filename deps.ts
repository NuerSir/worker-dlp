/**
 * 统一依赖管理 - Supabase Edge Functions 专用
 * 集中管理所有外部依赖，避免版本冲突
 */

export * as path from "https://deno.land/std@0.224.0/path/mod.ts";
// Deno 标准库
export { serve } from "https://deno.land/std@0.208.0/http/server.ts";
export { default as LRU } from "https://deno.land/x/lru@1.0.2/mod.ts";

// 类型定义
export type {
    JSONRPCError,
    JSONRPCRequest,
    JSONRPCResponse,
    MCPInitializeParams,
    MCPInitializeResult,
    MCPServerCapabilities,
    MCPServerInfo,
    // 重新导出项目内部类型，方便统一导入
    MCPTool,
    MCPToolCallParams,
    MCPToolHandler,
    MCPToolListResult,
    MCPToolResult,
} from "./types/mcp.ts";
