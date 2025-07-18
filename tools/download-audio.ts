import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import type { YtDlpExecutor } from "../lib/executor.ts";
import type { StorageManager } from "../lib/storage.ts";

/**
 * 创建音频下载工具的处理器
 * 当用户要求提取或下载音频时会自动调用此工具
 */
export function createDownloadAudioTool(
    executor: YtDlpExecutor,
    storage: StorageManager,
): MCPToolHandler {
    const tool: MCPTool = {
        name: "download_audio",
        description:
            "从视频中提取并下载音频文件。当用户说'提取音频'、'下载音乐'、'只要音频'、'转换成MP3'等涉及音频提取的需求时，应该主动调用此工具。支持多种音频格式如 MP3、AAC、FLAC 等，并可指定音质。",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "要提取音频的视频 URL 地址",
                },
                format: {
                    type: "string",
                    description: "音频格式：mp3、aac、flac、m4a、opus、vorbis、wav",
                    default: "mp3",
                },
                quality: {
                    type: "string",
                    description:
                        "音频质量：'best'（最佳）、'worst'（最小）或具体比特率如 '320K'、'128K'",
                    default: "best",
                },
                output_template: {
                    type: "string",
                    description: "输出文件名模板，如 '%(title)s.%(ext)s'",
                },
            },
            required: ["url"],
        },
    };

    const handler = async (args: Record<string, unknown>): Promise<MCPToolResult> => {
        const { url, format = "mp3", quality = "best", output_template } = args;

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

        // 验证音频格式
        const validFormats = ["mp3", "aac", "flac", "m4a", "opus", "vorbis", "wav"];
        const audioFormat = typeof format === "string" ? format.toLowerCase() : "mp3";
        if (!validFormats.includes(audioFormat)) {
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: `错误：不支持的音频格式 '${format}'。支持的格式：${
                        validFormats.join(", ")
                    }`,
                }],
            };
        }

        try {
            // 生成临时文件名
            const timestamp = new Date().getTime();
            const tempFileName = output_template
                ? (typeof output_template === "string"
                    ? output_template
                    : `audio_${timestamp}.%(ext)s`)
                : `audio_${timestamp}.%(ext)s`;

            // 执行音频提取
            const extractResult = await executor.extractAudio(url.trim(), {
                format: audioFormat,
                quality: typeof quality === "string" ? quality : "best",
                outputTemplate: tempFileName,
            });

            if (!extractResult.success) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `音频提取失败：${extractResult.error || "未知错误"}`,
                    }],
                };
            }

            // 从输出中提取实际的文件路径
            const outputLines = extractResult.output.split("\n");
            let extractedFilePath = "";

            // 查找输出文件路径
            for (const line of outputLines) {
                if (line.includes("Destination:")) {
                    extractedFilePath = line.split("Destination:")[1].trim();
                    break;
                } else if (line.includes("[ExtractAudio]")) {
                    // 查找 [ExtractAudio] 相关的输出
                    const match = line.match(/Destination:\s*(.+)$/);
                    if (match) {
                        extractedFilePath = match[1].trim();
                        break;
                    }
                }
            }

            // 如果没有找到具体路径，尝试查找音频文件
            if (!extractedFilePath) {
                try {
                    const baseFileName = tempFileName.replace(/\.\%\(ext\)s$/, "");
                    const files = [];

                    for await (const dirEntry of Deno.readDir(".")) {
                        if (
                            dirEntry.isFile &&
                            (dirEntry.name.startsWith(baseFileName) ||
                                dirEntry.name.endsWith(`.${audioFormat}`))
                        ) {
                            files.push(dirEntry.name);
                        }
                    }

                    if (files.length > 0) {
                        // 选择最新的文件
                        extractedFilePath = files.sort().pop() || "";
                    }
                } catch (readDirError) {
                    console.warn("无法读取目录:", readDirError);
                }
            }

            if (!extractedFilePath) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `音频提取完成但无法确定文件位置。提取输出：\n${extractResult.output}`,
                    }],
                };
            }

            // 检查文件是否存在
            try {
                const fileInfo = await Deno.stat(extractedFilePath);

                // 获取文件大小
                const formatFileSize = (bytes: number): string => {
                    const sizes = ["B", "KB", "MB", "GB"];
                    const i = Math.floor(Math.log(bytes) / Math.log(1024));
                    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
                };

                const fileSize = formatFileSize(fileInfo.size);

                // 上传到 Supabase Storage
                const uploadResult = await storage.uploadFile(extractedFilePath, extractedFilePath);

                // 清理本地临时文件
                await storage.cleanupLocalFile(extractedFilePath);

                if (!uploadResult.success) {
                    return {
                        isError: true,
                        content: [{
                            type: "text",
                            text: `文件上传失败：${uploadResult.error || "未知错误"}`,
                        }],
                    };
                }

                return {
                    content: [{
                        type: "text",
                        text:
                            `🎵 **音频提取成功！**\n\n🔗 **下载链接**：${uploadResult.url}\n\n📁 **文件信息**：\n- 文件名：${extractedFilePath}\n- 格式：${audioFormat.toUpperCase()}\n- 大小：${fileSize}\n- 质量：${quality}\n\n💡 **提示**：链接有效期为 24 小时，请及时保存到本地。`,
                    }],
                };
            } catch {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text:
                            `提取的音频文件不存在：${extractedFilePath}\n\n提取输出：\n${extractResult.output}`,
                    }],
                };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: `提取音频时发生错误：${errorMessage}`,
                }],
            };
        }
    };

    return { tool, handler };
}
