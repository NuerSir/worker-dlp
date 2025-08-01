import type { MCPToolHandler } from "../types/mcp.ts";




/**
 * 工具注册表
 * 负责管理所有可用的 MCP 工具
 */
export class ToolRegistry {
    private tools: Map<string, MCPToolHandler> = new Map();

    constructor() {
        this.registerTools();
    }

    /**
     * 注册所有工具
     */
    /**
     * 自动扫描 tools 目录并注册所有工具
     * 工具需导出默认对象 { name, tool, handler }
     */
    private async registerTools() {
        const toolsDir = new URL("../tools/", import.meta.url);
        for await (const entry of Deno.readDir(toolsDir)) {
            if (entry.isFile && entry.name.endsWith(".ts")) {
                try {
                    // 动态 import 工具模块
                    const mod = await import(`${toolsDir}${entry.name}`);
                    const toolMod = mod.default;
                    if (toolMod && toolMod.name && toolMod.tool && toolMod.handler) {
                        this.tools.set(toolMod.name, toolMod);
                    } else {
                        console.warn(`工具 ${entry.name} 缺少必要导出，已跳过。`);
                    }
                } catch (err) {
                    console.error(`加载工具 ${entry.name} 失败:`, err);
                }
            }
        }
    }

    /**
     * 获取所有工具定义
     */
    getAllTools() {
        return Array.from(this.tools.values()).map((handler) => handler.tool);
    }

    /**
     * 获取指定工具的处理器
     */
    getToolHandler(name: string): MCPToolHandler | undefined {
        return this.tools.get(name);
    }

    /**
     * 检查工具是否存在
     */
    hasTool(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * 获取工具数量
     */
    getToolCount(): number {
        return this.tools.size;
    }

    /**
     * 获取所有工具名称
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * 执行工具调用
     */
    async executeTool(name: string, args: Record<string, unknown>) {
        const handler = this.tools.get(name);
        if (!handler) {
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: `未知工具：${name}。可用工具：${this.getToolNames().join(", ")}`,
                }],
            };
        }

        try {
            return await handler.handler(args);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: `执行工具 ${name} 时发生错误：${errorMessage}`,
                }],
            };
        }
    }
}
