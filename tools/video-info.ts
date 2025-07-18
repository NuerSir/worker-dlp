import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import type { YtDlpExecutor } from "../lib/executor.ts";

/**
 * 创建视频信息获取工具的处理器
 * 当用户询问视频详情、想了解视频信息时会自动调用此工具
 */
export function createVideoInfoTool(executor: YtDlpExecutor): MCPToolHandler {
    const tool: MCPTool = {
        name: "get_video_info",
        description:
            "获取视频的详细信息，包括标题、时长、上传者、观看次数等。当用户提供视频链接并询问'这个视频是什么内容'、'视频多长时间'、'谁上传的'等问题时，应该主动调用此工具来获取信息。支持 YouTube、Bilibili 等主流视频平台。",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "要分析的视频 URL 地址，支持各大视频平台链接",
                },
            },
            required: ["url"],
        },
    };

    const handler = async (args: Record<string, unknown>): Promise<MCPToolResult> => {
        const { url } = args;

        // 参数验证
        if (typeof url !== "string" || !url.trim()) {
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: "错误：请提供有效的视频 URL 地址",
                }],
            };
        }

        try {
            // 执行 yt-dlp 获取视频信息
            const result = await executor.getVideoInfo(url.trim());

            if (!result.success) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `获取视频信息失败：${result.error || "未知错误"}`,
                    }],
                };
            }

            // 解析 JSON 输出
            try {
                const videoInfo = JSON.parse(result.output);

                // 格式化时长显示
                const formatDuration = (seconds: number): string => {
                    const hours = Math.floor(seconds / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);
                    const secs = seconds % 60;

                    if (hours > 0) {
                        return `${hours}:${minutes.toString().padStart(2, "0")}:${
                            secs.toString().padStart(2, "0")
                        }`;
                    } else {
                        return `${minutes}:${secs.toString().padStart(2, "0")}`;
                    }
                };

                // 格式化文件大小
                const formatFileSize = (bytes: number): string => {
                    if (!bytes) return "未知";
                    const sizes = ["B", "KB", "MB", "GB"];
                    const i = Math.floor(Math.log(bytes) / Math.log(1024));
                    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
                };

                // 构建详细的视频信息响应
                const info = [
                    `🎬 **视频信息**`,
                    ``,
                    `📺 **标题**：${videoInfo.title || "未知"}`,
                    `⏱️ **时长**：${
                        videoInfo.duration ? formatDuration(videoInfo.duration) : "未知"
                    }`,
                    `👤 **上传者**：${videoInfo.uploader || videoInfo.channel || "未知"}`,
                    `👀 **观看次数**：${
                        videoInfo.view_count ? videoInfo.view_count.toLocaleString() : "未知"
                    }`,
                    `📅 **上传日期**：${
                        videoInfo.upload_date
                            ? videoInfo.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
                            : "未知"
                    }`,
                    ``,
                    `📝 **描述预览**：`,
                    videoInfo.description
                        ? (videoInfo.description.length > 300
                            ? videoInfo.description.substring(0, 300) + "..."
                            : videoInfo.description)
                        : "无描述",
                    ``,
                    `🎥 **技术信息**：`,
                    `- 格式数量：${videoInfo.formats ? videoInfo.formats.length : 0} 种可用格式`,
                    `- 视频 ID：${videoInfo.id || "未知"}`,
                    `- 平台：${videoInfo.extractor || "未知"}`,
                    videoInfo.filesize ? `- 预估大小：${formatFileSize(videoInfo.filesize)}` : "",
                    videoInfo.width && videoInfo.height
                        ? `- 分辨率：${videoInfo.width}x${videoInfo.height}`
                        : "",
                ].filter((line) => line !== "").join("\n");

                return {
                    content: [{
                        type: "text",
                        text: info,
                    }],
                };
            } catch (_parseError) {
                // 如果 JSON 解析失败，返回原始输出
                return {
                    content: [{
                        type: "text",
                        text: `视频信息（原始格式）：\n${result.output}`,
                    }],
                };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: `获取视频信息时发生错误：${errorMessage}`,
                }],
            };
        }
    };

    return { tool, handler };
}
