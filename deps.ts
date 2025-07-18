/**
 * 统一依赖管理 - Supabase Edge Functions 专用
 * 集中管理所有外部依赖，避免版本冲突
 */

// Supabase 客户端
export { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
export type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Deno 标准库
export { serve } from "https://deno.land/std@0.208.0/http/server.ts";

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
