import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import type { YtDlpExecutor } from "../lib/executor.ts";
import type { StorageManager } from "../lib/storage.ts";
import { getBaseFileNameFromUrl, extractFilePathFromOutput, findFileInTempDir } from "../lib/utils.ts";

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
            // 获取视频信息来生成一致的文件名
            const baseFileName = await getBaseFileNameFromUrl(executor, url.trim(), "audio");

            // 1. 首先检查 Supabase 服务器端是否已有该音频文件
            console.log(`🔍 检查服务器端是否已有音频文件: ${baseFileName}`);
            const existingUrl = await storage.checkFileExists(baseFileName);
            
            if (existingUrl) {
                console.log(`✅ 发现服务器端已有音频文件，直接返回链接`);
                return {
                    content: [{
                        type: "text",
                        text: `✅ **音频已存在于服务器！**\n\n🔗 **下载链接**：${existingUrl}\n\n📁 **文件名**：${baseFileName}\n\n💡 **提示**：音频文件已存在，无需重新提取。链接有效期为 24 小时。`,
                    }],
                };
            }

            // 2. 检查本地临时目录是否已有该音频文件
            console.log(`🔍 检查本地临时目录是否已有音频文件: ${baseFileName}`);
            const localFilePath = await storage.checkLocalFileExists(baseFileName);
            
            if (localFilePath) {
                console.log(`✅ 发现本地已有音频文件，直接上传: ${localFilePath}`);
                
                const uploadResult = await storage.uploadFile(localFilePath, baseFileName);
                
                if (uploadResult.success) {
                    return {
                        content: [{
                            type: "text",
                            text: `✅ **音频上传成功！**\n\n🔗 **下载链接**：${uploadResult.url}\n\n📁 **文件名**：${baseFileName}\n\n💡 **提示**：使用本地缓存文件上传，节省提取时间。链接有效期为 24 小时。`,
                        }],
                    };
                } else {
                    console.warn(`本地音频文件上传失败: ${uploadResult.error}，继续提取...`);
                }
            }

            // 3. 如果都没有，则进行音频提取
            console.log(`🎵 开始提取新音频: ${url}`);
            
            // 使用基于内容的文件名而不是时间戳
            const tempFileName = output_template
                ? (typeof output_template === "string"
                    ? output_template
                    : `${baseFileName}.%(ext)s`)
                : `${baseFileName}.%(ext)s`;

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
            let extractedFilePath = extractFilePathFromOutput(extractResult.output);

            // 如果没有找到具体路径，尝试查找音频文件
            if (!extractedFilePath) {
                const pattern = tempFileName.replace(/\.\%\(ext\)s$/, "");
                extractedFilePath = await findFileInTempDir(pattern, `.${audioFormat}`) || "";
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

                // 上传到 Supabase Storage，生成带扩展名的文件名
                const actualFileName = extractedFilePath.split('/').pop() || 'audio';
                const fileExtension = actualFileName.split('.').pop() || audioFormat;
                const finalFileName = `${baseFileName}.${fileExtension}`;
                
                const fileSize = formatFileSize(fileInfo.size);
                const uploadResult = await storage.uploadFile(extractedFilePath, finalFileName);

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
                            `🎵 **音频提取成功！**\n\n🔗 **下载链接**：${uploadResult.url}\n\n📁 **文件信息**：\n- 文件名：${finalFileName}\n- 格式：${audioFormat.toUpperCase()}\n- 大小：${fileSize}\n- 质量：${quality}\n\n💡 **提示**：链接有效期为 24 小时，请及时保存到本地。`,
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
