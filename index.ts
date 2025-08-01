/**
 * yt-dlp Worker MCP Server
 * 基于 Supabase Edge Functions 的 Model Context Protocol 服务器
 *
 * 架构说明：
 * - lib/executor.ts: yt-dlp 命令执行引擎
 * - lib/storage.ts: 文件管理
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
import { ToolRegistry } from "./lib/tool-registry.ts";
import { MCPServer } from "./lib/mcp-server.ts";
import { getDomain, getDownloadUrl } from "./config.ts";
import type { JSONRPCRequest } from "./types/mcp.ts";

// 启动时自动检测并输出未完成任务（断点续传/恢复基础能力）
import { recoverUnfinishedTasks } from "./lib/download-task.ts";
import { fixOrphanedTasks, cleanupAllRunningProcesses } from "./lib/process-manager.ts";


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

// 初始化工具注册表
const toolRegistry = new ToolRegistry();

// 初始化 MCP 服务器
const mcpServer = new MCPServer(toolRegistry, config.server);

// ==================== 服务器生命周期 ====================

/**
 * 初始化服务器组件和存储桶
 * 确保所有必要的资源在服务器启动前准备就绪
 */
function initializeServer(): void {
    try {
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
                <strong>MCP JSON-RPC:</strong> POST ${getDomain()}/
            </div>
            <div class="endpoint-item">
                <strong>REST API:</strong> POST ${getDomain()}/
            </div>
        </div>

        <div class="tools-section">
            <h2>🛠️ 可用工具 (${tools.length})</h2>
            <div class="tools-grid">
                ${tools.map((tool) => `
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

    // 主页 HTML
    if (req.method === "GET" && url.pathname === "/") {
        return new Response(generateHomePage(), {
            headers: {
                ...corsHeaders,
                "Content-Type": "text/html; charset=utf-8",
            },
        });
    }

    // 处理文件下载接口 GET /storage/{id}
    if (req.method === "GET" && url.pathname.startsWith("/storage/")) {
        const id = url.pathname.replace("/storage/", "");
        if (!id) {
            return new Response(JSON.stringify({ error: "缺少文件ID" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        // 查询任务
        // 这里直接 import getTask，避免循环依赖
        const { getTask } = await import("./lib/storage.ts");
        const task = getTask(id);
        if (!task) {
            return new Response(JSON.stringify({ error: "任务不存在" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        if (task.status !== "success") {
            // 返回详细任务状态，并拼接下载链接（如果已知 id）
            return new Response(JSON.stringify({
                error: "文件未就绪或任务未成功",
                status: task.status,
                message: task.error || (task.status === "pending" ? "任务等待中" : task.status === "running" ? "任务正在执行" : "任务失败"),
                downloadUrl: getDownloadUrl(task.id),
                task: {
                    id: task.id,
                    type: task.type,
                    status: task.status,
                    createdAt: task.createdAt,
                    updatedAt: task.updatedAt,
                    error: task.error,
                    input: task.input,
                }
            }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        // 任务 result 应为文件路径或 URL
        const filePath = typeof task.result === "string" ? task.result : undefined;
        if (!filePath) {
            return new Response(JSON.stringify({ error: "未找到文件路径" }), {
                status: 410,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        try {
            // 只支持本地文件路径（如需代理云端可扩展）
            const file = await Deno.open(filePath, { read: true });
            const stat = await Deno.stat(filePath);
            const fileName = (filePath as string).split("/").pop() || `file-${id}`;
            const headers = {
                ...corsHeaders,
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename=\"${encodeURIComponent(fileName)}\"`,
                "Content-Length": stat.size.toString(),
                "Cache-Control": "public, max-age=86400, immutable",
            };
            return new Response(file.readable, { status: 200, headers });
        } catch (err) {
            return new Response(
                JSON.stringify({ error: "文件读取失败", detail: err instanceof Error ? err.message : String(err) }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
            );
        }
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

    try {
        const requestBody = await req.json();

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
                        id: requestBody.id || null,
                    }),
                    {
                        status: 401,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    },
                );
            }
        }
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

        // 动态映射 action 到工具名，支持别名和自动注册
        // 别名映射表（可扩展）
        const actionAlias: Record<string, string> = {
            info: "get_video_info",
            download: "download_video",
            audio: "download_audio",
            formats: "get_formats",
            playlist: "download_playlist",
        };
        // 优先用别名，否则直接用 action
        const toolName = actionAlias[action] || action;
        if (!toolRegistry.hasTool(toolName)) {
            console.log(`❌ 未知的 REST API 操作: ${action}（未注册工具: ${toolName}）`);
            return new Response(
                JSON.stringify({
                    error: `未知操作: ${action}（未注册工具: ${toolName}）`,
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
            );
        }
        // 组装参数，url 必须有
        const toolArgs = { url: videoUrl, ...options };
        const result = await toolRegistry.executeTool(toolName, toolArgs);
        console.log(`✅ REST API 请求处理完成: ${toolName}`);
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        console.error("❌ 请求处理失败:", errorMessage);

        // 如果是JSON解析错误，id为null是正确的
        // 如果是其他错误，尝试从可能存在的requestBody中获取id
        let responseId = null;
        let errorCode = -32700; // 默认为解析错误

        // 检查是否是JSON解析错误
        if (error instanceof SyntaxError || errorMessage.includes("JSON")) {
            errorCode = -32700;
            responseId = null;
        } else {
            // 其他错误，可能requestBody已经解析成功
            errorCode = -32603; // 内部错误
            // 这里无法获取requestBody，因为我们在catch块中
        }

        return new Response(
            JSON.stringify({
                jsonrpc: "2.0",
                error: {
                    code: errorCode,
                    message: errorCode === -32700 ? "解析错误" : "内部错误",
                    data: errorMessage,
                },
                id: responseId,
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
initializeServer();



// 修复孤儿任务
await fixOrphanedTasks();

// 恢复未完成任务
recoverUnfinishedTasks();

// 注册优雅退出处理 - 使用 beforeunload 事件或进程退出钩子
globalThis.addEventListener?.("beforeunload", async () => {
    console.log("🛑 检测到进程退出，开始清理...");
    await cleanupAllRunningProcesses();
});

// 对于 Deno，尝试使用 process 退出事件
try {
    globalThis.addEventListener?.("unload", async () => {
        console.log("🛑 进程卸载，开始清理...");
        await cleanupAllRunningProcesses();
    });
} catch {
    // 忽略不支持的环境
}

// 启动 HTTP 服务器
console.log("🌐 HTTP 服务器已启动，等待请求...");
serve(handleRequest, {
    port: 8000,
    hostname: "0.0.0.0",
    onListen: ({ port, hostname }) => {
        console.log(`🚀 服务器运行在 http://${hostname}:${port}`);
    },
});
