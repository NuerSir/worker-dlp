/**
 * yt-dlp Worker MCP Server
 * 基于 Supabase Edge Functions 的 Model Context Protocol 服务器
 *
 * 架构说明：
 * - lib/executor.ts: yt-dlp 命令执行引擎
 * - lib/storage.ts: Supabase Storage 文件管理
 * - lib/mcp-server.ts: MCP 协议处理核心
 * - tools/: 独立的工具实现 (video-info, download-video, download-audio, get-formats, download-playlist)
 * - types/mcp.    if (config.security.apiKey) {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== config.security.apiKey) { MCP 协议类型定义
 *
 * 功能特性：
 * - 支持 MCP JSON-RPC 协议和 REST API 双接口
 * - 自动文件上传到云端存储并生成公开链接
 * - 智能工具描述，增强 AI 客户端理解
 * - 模块化设计，易于扩展新功能
 *
 * @version 2.0.0
 * @author NuerSir
 */

import { serve } from "./deps.ts";
import { config } from "./config.ts";
import { YtDlpExecutor } from "./lib/executor.ts";
import { StorageManager } from "./lib/storage.ts";
import { ToolRegistry } from "./tools/registry.ts";
import { MCPServer } from "./lib/mcp-server.ts";
import type { JSONRPCRequest } from "./types/mcp.ts";

// ==================== 环境配置 ====================

// 配置已在 config.ts 中集中管理

// ==================== CORS 配置 ====================

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ==================== 服务器配置 ====================

const SERVER_INFO = {
    name: "worker-dlp",
    version: "2.0.0",
    description: "基于云端的视频下载和音频提取服务，支持多平台视频处理",
};

// ==================== 初始化组件 ====================

// 初始化 yt-dlp 执行器
const executor = new YtDlpExecutor(config.network.proxyUrl);

// 初始化存储管理器
const storage = new StorageManager(config.supabase.url, config.supabase.anonKey);

// 初始化工具注册表
const toolRegistry = new ToolRegistry(executor, storage);

// 初始化 MCP 服务器
const mcpServer = new MCPServer(toolRegistry, config.server);

// ==================== 服务器生命周期 ====================

/**
 * 初始化服务器组件和存储桶
 * 确保所有必要的资源在服务器启动前准备就绪
 */
async function initializeServer(): Promise<void> {
    try {
        console.log("🔧 正在初始化 Supabase Storage...");
        await storage.initializeBucket();

        console.log("✅ 服务器初始化完成");
        console.log(`📊 已注册 ${toolRegistry.getToolCount()} 个工具`);
        console.log(`🔧 可用工具: ${toolRegistry.getToolNames().join(", ")}`);

        // 输出配置信息（不包含敏感数据）
        console.log("⚙️ 服务器配置:");
        console.log(`   - API Key: ${config.security.apiKey ? "已配置" : "未配置（开放访问）"}`);
        console.log(`   - 代理: ${config.network.proxyUrl ? "已配置" : "未配置"}`);
        console.log(`   - 存储: Supabase Storage`);
    } catch (error) {
        console.error("❌ 服务器初始化失败:", error);
        throw error;
    }
}

/**
 * 生成服务器主页 HTML
 * 提供友好的 Web 界面，显示服务状态和工具信息
 */
function generateHomePage(): string {
    const stats = mcpServer.getStats();
    const tools = toolRegistry.getAllTools();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${SERVER_INFO.name} - MCP 服务器</title>
    <style>
        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        .title {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .version {
            color: #7f8c8d;
            font-size: 1.2em;
        }
        .status {
            display: inline-block;
            background: #27ae60;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            margin-top: 10px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #3498db;
        }
        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        .stat-label {
            color: #7f8c8d;
            font-size: 0.9em;
        }
        .tools-section {
            margin-top: 40px;
        }
        .tools-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .tool-card {
            background: #ffffff;
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            padding: 20px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .tool-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .tool-name {
            font-weight: bold;
            color: #2c3e50;
            font-size: 1.1em;
            margin-bottom: 10px;
        }
        .tool-desc {
            color: #5a6c7d;
            font-size: 0.95em;
            line-height: 1.5;
        }
        .endpoints {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
        }
        .endpoint-title {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 15px;
        }
        .endpoint-item {
            margin: 10px 0;
            font-family: monospace;
            background: white;
            padding: 10px;
            border-radius: 4px;
            border-left: 3px solid #3498db;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e1e8ed;
            color: #7f8c8d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${SERVER_INFO.name}</h1>
            <div class="version">版本 ${SERVER_INFO.version}</div>
            <div class="status">🟢 服务运行中</div>
            <p style="margin-top: 20px; color: #5a6c7d;">${SERVER_INFO.description}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${stats.toolCount}</div>
                <div class="stat-label">可用工具</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">MCP</div>
                <div class="stat-label">协议标准</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">云端</div>
                <div class="stat-label">文件存储</div>
            </div>
        </div>

        <div class="endpoints">
            <div class="endpoint-title">🔗 服务端点</div>
            <div class="endpoint-item">
                <strong>MCP JSON-RPC:</strong> POST ${config.supabase.url}/functions/v1/worker-dlp
            </div>
            <div class="endpoint-item">
                <strong>REST API:</strong> POST ${config.supabase.url}/functions/v1/worker-dlp
            </div>
        </div>

        <div class="tools-section">
            <h2>🛠️ 可用工具 (${tools.length})</h2>
            <div class="tools-grid">
                ${
        tools.map((tool) => `
                    <div class="tool-card">
                        <div class="tool-name">📦 ${tool.name}</div>
                        <div class="tool-desc">${tool.description}</div>
                    </div>
                `).join("")
    }
            </div>
        </div>

        <div class="footer">
            <p>🚀 基于 Supabase Edge Functions 和 Deno 构建</p>
            <p>💡 支持 MCP 客户端（如 Claude Desktop）和直接 HTTP 调用</p>
        </div>
    </div>
</body>
</html>`;
}

// ==================== 请求处理 ====================

/**
 * HTTP 请求处理器
 * 支持多种请求类型：
 * - GET /: 服务器主页
 * - POST /: MCP JSON-RPC 或 REST API
 * - OPTIONS: CORS 预检
 *
 * @param req HTTP 请求对象
 * @returns HTTP 响应
 */
async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // 处理 CORS 预检请求
    if (req.method === "OPTIONS") {
        console.log("🔄 处理 CORS 预检请求");
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method === "GET" && url.pathname === "/favicon.ico") {
        return new Response(null, { status: 404 });
    }

    // 处理主页请求 - 显示服务状态和工具信息
    if (req.method === "GET" && url.pathname === "/") {
        // console.log("📄 提供服务器主页");
        return new Response(generateHomePage(), {
            headers: {
                ...corsHeaders,
                "Content-Type": "text/html; charset=utf-8",
            },
        });
    }

    // 只处理 POST 请求用于 API 调用
    if (req.method !== "POST") {
        console.log(`❌ 不支持的请求方法: ${req.method}`);
        return new Response(
            JSON.stringify({
                error: "只支持 POST 请求",
            }),
            {
                status: 405,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }

    // API 密钥验证（如果配置了的话）
    if (config.security.apiKey) {
        const authHeader = req.headers.get("Authorization");
        if (
            !authHeader || !authHeader.startsWith("Bearer ") ||
            authHeader.slice(7) !== config.security.apiKey
        ) {
            console.log("❌ API 密钥验证失败");
            return new Response(
                JSON.stringify({
                    jsonrpc: "2.0",
                    error: {
                        code: -32001,
                        message: "未授权：无效或缺失的 API 密钥",
                    },
                    id: null,
                }),
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
            );
        }
    }

    try {
        const requestBody = await req.json();
        console.log(`📨 收到请求: ${requestBody.jsonrpc ? "MCP JSON-RPC" : "REST API"}`);

        // 处理 MCP JSON-RPC 请求
        if (requestBody.jsonrpc === "2.0") {
            console.log(`🔧 MCP 方法调用: ${requestBody.method}`);
            const response = await mcpServer.handleRequest(requestBody as JSONRPCRequest);

            // 处理通知（无需响应）
            if (response === null) {
                console.log("📤 MCP 通知已处理");
                return new Response(JSON.stringify({ jsonrpc: "2.0", result: null, id: requestBody.id }), {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            console.log("✅ MCP 请求处理完成");
            return new Response(JSON.stringify(response), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 处理传统 REST API（向后兼容）
        const { url: videoUrl, action = "info", ...options } = requestBody;

        if (!videoUrl) {
            console.log("❌ REST API 请求缺少 URL 参数");
            return new Response(
                JSON.stringify({
                    error: "缺少 URL 参数",
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
            );
        }

        console.log(`🔧 REST API 调用: ${action} - ${videoUrl}`);

        // 将 REST API 调用映射到工具调用
        let toolName: string;
        let toolArgs: Record<string, unknown>;

        switch (action) {
            case "info":
                toolName = "get_video_info";
                toolArgs = { url: videoUrl };
                break;
            case "download":
                toolName = "download_video";
                toolArgs = { url: videoUrl, ...options };
                break;
            case "audio":
                toolName = "download_audio";
                toolArgs = { url: videoUrl, ...options };
                break;
            case "formats":
                toolName = "get_formats";
                toolArgs = { url: videoUrl };
                break;
            case "playlist":
                toolName = "download_playlist";
                toolArgs = { url: videoUrl, ...options };
                break;
            default:
                console.log(`❌ 未知的 REST API 操作: ${action}`);
                return new Response(
                    JSON.stringify({
                        error: `未知操作: ${action}`,
                    }),
                    {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    },
                );
        }

        const result = await toolRegistry.executeTool(toolName, toolArgs);
        console.log(`✅ REST API 请求处理完成: ${toolName}`);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        console.error("❌ 请求处理失败:", errorMessage);

        return new Response(
            JSON.stringify({
                jsonrpc: "2.0",
                error: {
                    code: -32700,
                    message: "解析错误",
                    data: errorMessage,
                },
                id: null,
            }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }
}

// ==================== 启动服务器 ====================

console.log("🚀 正在启动 yt-dlp MCP 服务器...");
console.log(`📍 版本: ${SERVER_INFO.version}`);
console.log(`📋 描述: ${SERVER_INFO.description}`);

// 初始化服务器组件
await initializeServer();

// 启动 HTTP 服务器
console.log("🌐 HTTP 服务器已启动，等待请求...");
serve(handleRequest, {
    port: 8000,
    hostname: "0.0.0.0",
    onListen: ({ port, hostname }) => {
        console.log(`🚀 服务器运行在 http://${hostname}:${port}`);
    },
});
