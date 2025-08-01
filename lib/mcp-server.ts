import type {
    JSONRPCRequest,
    JSONRPCResponse,
    MCPInitializeParams,
    MCPInitializeResult,
    MCPServerCapabilities,
    MCPServerInfo,
    MCPToolCallParams,
    MCPToolListResult,
    TaskBase,
} from "../types/mcp.ts";
import { getTask } from "./storage.ts";
import { ToolRegistry } from "./tool-registry.ts";

/**
 * MCP 服务器核心
 * 处理 MCP 协议相关的请求和响应
 */
export class MCPServer {
    private toolRegistry: ToolRegistry;
    private serverInfo: MCPServerInfo;
    private capabilities: MCPServerCapabilities;

    constructor(toolRegistry: ToolRegistry, serverInfo: MCPServerInfo) {
        this.toolRegistry = toolRegistry;
        this.serverInfo = serverInfo;
        this.capabilities = {
            tools: {
                list: true,
                call: true,
            },
        };
    }

    /**
     * 处理 MCP JSON-RPC 请求
     */
    async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse | null> {
        const { method, params, id } = request;

        try {
            switch (method) {
                case "initialize":
                    return this.handleInitialize(params as MCPInitializeParams, id);

                case "notifications/initialized":
                    // 初始化通知，无需响应
                    return null;

                case "tools/list":
                    return this.handleToolsList(id);

                case "tools/call":
                    return await this.handleToolsCall(params as MCPToolCallParams, id);

                case "tasks/get":
                    return this.handleTaskGet(params as { id?: string }, id);

                default:
                    return {
                        jsonrpc: "2.0",
                        id,
                        error: {
                            code: -32601,
                            message: `方法未找到：${method}`,
                        },
                    };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            return {
                jsonrpc: "2.0",
                id,
                error: {
                    code: -32603,
                    message: "内部错误",
                    data: errorMessage,
                },
            };
        }
    }

    /**
     * 处理初始化请求
     */
    private handleInitialize(
        _params: MCPInitializeParams,
        id?: string | number | null,
    ): JSONRPCResponse {
        const result: MCPInitializeResult = {
            protocolVersion: "2024-11-05",
            capabilities: this.capabilities,
            serverInfo: this.serverInfo,
        };

        return {
            jsonrpc: "2.0",
            id,
            result,
        };
    }

    /**
     * 处理工具列表请求
     */
    private handleToolsList(id?: string | number | null): JSONRPCResponse {
        const result: MCPToolListResult = {
            tools: this.toolRegistry.getAllTools(),
        };

        return {
            jsonrpc: "2.0",
            id,
            result,
        };
    }

    /**
     * 处理工具调用请求
     */
    private async handleToolsCall(
        params: MCPToolCallParams,
        id?: string | number | null,
    ): Promise<JSONRPCResponse> {
        if (!params?.name || typeof params.name !== "string") {
            return {
                jsonrpc: "2.0",
                id,
                error: {
                    code: -32602,
                    message: "无效参数：缺少工具名称",
                },
            };
        }

        const toolResult = await this.toolRegistry.executeTool(
            params.name,
            params.arguments || {},
        );

        return {
            jsonrpc: "2.0",
            id,
            result: toolResult,
        };
    }

    /**
     * 处理任务状态查询请求
     */
    private handleTaskGet(params: { id?: string }, id?: string | number | null): JSONRPCResponse {
        if (!params?.id || typeof params.id !== "string") {
            return {
                jsonrpc: "2.0",
                id,
                error: {
                    code: -32602,
                    message: "无效参数：缺少任务ID (id)",
                },
            };
        }
        const task = getTask(params.id);
        if (!task) {
            return {
                jsonrpc: "2.0",
                id,
                error: {
                    code: -32004,
                    message: `未找到任务：${params.id}`,
                },
            };
        }
        // 直接返回任务详情
        return {
            jsonrpc: "2.0",
            id,
            result: task,
        };
    }

    /**
     * 获取服务器信息
     */
    getServerInfo(): MCPServerInfo {
        return this.serverInfo;
    }

    /**
     * 获取服务器能力
     */
    getCapabilities(): MCPServerCapabilities {
        return this.capabilities;
    }

    /**
     * 获取工具统计
     */
    getStats() {
        return {
            toolCount: this.toolRegistry.getToolCount(),
            availableTools: this.toolRegistry.getToolNames(),
            serverInfo: this.serverInfo,
            capabilities: this.capabilities,
        };
    }
}
