import type { MCPToolHandler } from "../types/mcp.ts";
import { createVideoInfoTool } from "./video-info.ts";
import { createDownloadVideoTool } from "./download-video.ts";
import { createDownloadAudioTool } from "./download-audio.ts";
import { createGetFormatsTool } from "./get-formats.ts";
import { createDownloadPlaylistTool } from "./download-playlist.ts";
import type { YtDlpExecutor } from "../lib/executor.ts";
import type { StorageManager } from "../lib/storage.ts";

/**
 * 工具注册表
 * 负责管理所有可用的 MCP 工具
 */
export class ToolRegistry {
    private tools: Map<string, MCPToolHandler> = new Map();

    constructor(executor: YtDlpExecutor, storage: StorageManager) {
        this.registerTools(executor, storage);
    }

    /**
     * 注册所有工具
     */
    private registerTools(executor: YtDlpExecutor, storage: StorageManager): void {
        // 注册视频信息工具
        const videoInfoTool = createVideoInfoTool(executor);
        this.tools.set(videoInfoTool.tool.name, videoInfoTool);

        // 注册视频下载工具
        const downloadVideoTool = createDownloadVideoTool(executor, storage);
        this.tools.set(downloadVideoTool.tool.name, downloadVideoTool);

        // 注册音频下载工具
        const downloadAudioTool = createDownloadAudioTool(executor, storage);
        this.tools.set(downloadAudioTool.tool.name, downloadAudioTool);

        // 注册格式查询工具
        const getFormatsTool = createGetFormatsTool(executor);
        this.tools.set(getFormatsTool.tool.name, getFormatsTool);

        // 注册播放列表下载工具
        const downloadPlaylistTool = createDownloadPlaylistTool(executor, storage);
        this.tools.set(downloadPlaylistTool.tool.name, downloadPlaylistTool);
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
