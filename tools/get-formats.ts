import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import type { YtDlpExecutor } from "../lib/executor.ts";

/**
 * 创建格式查询工具的处理器
 * 当用户询问可用格式时会自动调用此工具
 */
export function createGetFormatsTool(executor: YtDlpExecutor): MCPToolHandler {
    const tool: MCPTool = {
        name: "get_formats",
        description:
            "查看视频的所有可用下载格式和画质选项。当用户询问'有哪些格式可以下载'、'支持什么画质'、'格式列表'等问题时，应该主动调用此工具。会显示格式 ID、分辨率、文件大小、编码等详细信息，帮助用户选择合适的下载格式。",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "要查询格式的视频 URL 地址",
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
            // 执行格式查询
            const result = await executor.getFormats(url.trim());

            if (!result.success) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `查询格式失败：${result.error || "未知错误"}`,
                    }],
                };
            }

            // 解析和格式化输出
            const formatLines = result.output.split("\n");
            const formattedOutput = [];

            formattedOutput.push("📋 **可用下载格式列表**\n");

            // 查找格式表格的开始
            let tableStarted = false;
            const videoFormats: string[] = [];
            const audioFormats: string[] = [];

            for (const line of formatLines) {
                if (line.includes("format code") || line.includes("ID")) {
                    tableStarted = true;
                    formattedOutput.push("```");
                    formattedOutput.push(line);
                    continue;
                }

                if (tableStarted) {
                    if (line.trim() === "") {
                        // 表格结束
                        formattedOutput.push("```\n");
                        break;
                    }

                    formattedOutput.push(line);

                    // 分析格式类型
                    if (
                        line.includes("video only") || line.includes("mp4") || line.includes("webm")
                    ) {
                        videoFormats.push(line.trim());
                    } else if (
                        line.includes("audio only") || line.includes("m4a") || line.includes("webm")
                    ) {
                        audioFormats.push(line.trim());
                    }
                }
            }

            // 如果没有找到表格格式，直接显示原始输出
            if (!tableStarted) {
                formattedOutput.push("```");
                formattedOutput.push(result.output);
                formattedOutput.push("```");
            }

            // 添加格式建议
            formattedOutput.push("\n💡 **下载建议**：");
            formattedOutput.push("- `best`: 自动选择最佳质量（推荐）");
            formattedOutput.push("- `worst`: 最小文件大小");
            formattedOutput.push("- `bestvideo+bestaudio`: 最佳视频+最佳音频");
            formattedOutput.push("- 特定格式：使用格式 ID（如 `22`, `18` 等）");

            if (videoFormats.length > 0) {
                formattedOutput.push("\n🎥 **推荐视频格式**：");
                // 找出一些常见的好格式
                const goodFormats = videoFormats.filter((f) =>
                    f.includes("720p") || f.includes("1080p") || f.includes("480p")
                ).slice(0, 3);

                if (goodFormats.length > 0) {
                    goodFormats.forEach((format) => {
                        const parts = format.split(/\s+/);
                        if (parts.length > 0) {
                            formattedOutput.push(`- 格式 ${parts[0]}: ${format}`);
                        }
                    });
                }
            }

            if (audioFormats.length > 0) {
                formattedOutput.push("\n🎵 **推荐音频格式**：");
                const goodAudioFormats = audioFormats.slice(0, 2);
                goodAudioFormats.forEach((format) => {
                    const parts = format.split(/\s+/);
                    if (parts.length > 0) {
                        formattedOutput.push(`- 格式 ${parts[0]}: ${format}`);
                    }
                });
            }

            formattedOutput.push("\n📝 **使用方法**：");
            formattedOutput.push("在下载时指定 `format` 参数，例如：");
            formattedOutput.push('- 下载最佳质量：`format: "best"`');
            formattedOutput.push('- 下载特定格式：`format: "22"`（使用上述格式 ID）');
            formattedOutput.push('- 指定画质：`quality: "720p"`');

            return {
                content: [{
                    type: "text",
                    text: formattedOutput.join("\n"),
                }],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: `查询格式时发生错误：${errorMessage}`,
                }],
            };
        }
    };

    return { tool, handler };
}
