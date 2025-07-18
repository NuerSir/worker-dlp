import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import type { YtDlpExecutor } from "../lib/executor.ts";
import type { StorageManager } from "../lib/storage.ts";

/**
 * 创建视频下载工具的处理器
 * 当用户明确表达下载意图时会自动调用此工具
 */
export function createDownloadVideoTool(
    executor: YtDlpExecutor,
    storage: StorageManager,
): MCPToolHandler {
    const tool: MCPTool = {
        name: "download_video",
        description:
            "下载视频文件到云端存储。当用户明确说'下载这个视频'、'帮我下载'、'我要下载'等表达下载意图的话语时，应该主动调用此工具。下载完成后会返回可直接访问的下载链接。支持指定视频格式和画质。",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "要下载的视频 URL 地址",
                },
                format: {
                    type: "string",
                    description:
                        "视频格式选择器，如 'best'（最佳质量）、'worst'（最小文件）、'bestvideo+bestaudio'（最佳视频+音频）",
                    default: "best",
                },
                quality: {
                    type: "string",
                    description: "视频画质偏好，如 '720p'、'1080p'、'480p' 等",
                },
                output_template: {
                    type: "string",
                    description: "输出文件名模板，如 '%(title)s.%(ext)s'（使用视频标题作为文件名）",
                },
            },
            required: ["url"],
        },
    };

    const handler = async (args: Record<string, unknown>): Promise<MCPToolResult> => {
        const { url, format = "best", quality, output_template } = args;

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
            // 生成临时文件名
            const timestamp = new Date().getTime();
            const tempFileName = output_template
                ? (typeof output_template === "string"
                    ? output_template
                    : `video_${timestamp}.%(ext)s`)
                : `video_${timestamp}.%(ext)s`;

            // 执行视频下载
            console.log(`🎬 开始下载视频: ${url}`);
            
            // 添加下载进度提示
            const startTime = Date.now();
            
            const downloadResult = await executor.downloadVideo(url.trim(), {
                format: typeof format === "string" ? format : "best",
                quality: typeof quality === "string" ? quality : undefined,
                outputTemplate: tempFileName,
            });

            const downloadTime = Math.round((Date.now() - startTime) / 1000);
            console.log(`⏱️ 下载耗时: ${downloadTime}秒`);

            if (!downloadResult.success) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `视频下载失败：${downloadResult.error || "未知错误"}`,
                    }],
                };
            }

            console.log(`✅ 视频下载完成，开始处理文件...`);

            // 从下载输出中提取实际的文件路径
            const outputLines = downloadResult.output.split("\n");
            let downloadedFilePath = "";

            // 查找 "Destination:" 或 "[download] xxx%" 这样的行来确定文件路径
            for (const line of outputLines) {
                if (line.includes("Destination:")) {
                    downloadedFilePath = line.split("Destination:")[1].trim();
                    break;
                } else if (line.includes("[download] 100%")) {
                    // 从完成行中提取文件路径（可能在不同位置）
                    const match = line.match(/in\s+\d+:\d+:\d+\s+at\s+[\d.]+\w+\/s$/);
                    if (match) {
                        // 这种情况下文件路径可能在其他行
                        continue;
                    }
                }
            }

            // 如果没有找到具体路径，尝试使用通配符查找
            if (!downloadedFilePath) {
                try {
                    const pattern = tempFileName.replace(/\.\%\(ext\)s$/, ".*");
                    const files = [];
                    for await (const dirEntry of Deno.readDir(".")) {
                        if (dirEntry.isFile && dirEntry.name.startsWith(pattern.split(".")[0])) {
                            files.push(dirEntry.name);
                        }
                    }

                    if (files.length > 0) {
                        // 选择最新的文件
                        downloadedFilePath = files.sort().pop() || "";
                    }
                } catch (readDirError) {
                    console.warn("无法读取目录:", readDirError);
                }
            }

            if (!downloadedFilePath) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `下载完成但无法确定文件位置。下载输出：\n${downloadResult.output}`,
                    }],
                };
            }

            // 检查文件是否存在
            try {
                await Deno.stat(downloadedFilePath);
            } catch {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text:
                            `下载的文件不存在：${downloadedFilePath}\n\n下载输出：\n${downloadResult.output}`,
                    }],
                };
            }

            // 上传到 Supabase Storage
            const uploadResult = await storage.uploadFile(downloadedFilePath, downloadedFilePath);

            // 清理本地临时文件
            await storage.cleanupLocalFile(downloadedFilePath);

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
                        `✅ **视频下载成功！**\n\n🔗 **下载链接**：${uploadResult.url}\n\n📁 **文件名**：${downloadedFilePath}\n\n💡 **提示**：链接有效期为 24 小时，请及时保存到本地。\n\n📊 **下载详情**：\n${
                            downloadResult.output.split("\n").slice(-5).join("\n")
                        }`,
                }],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: `下载视频时发生错误：${errorMessage}`,
                }],
            };
        }
    };

    return { tool, handler };
}
