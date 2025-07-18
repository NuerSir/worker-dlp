import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import type { YtDlpExecutor } from "../lib/executor.ts";
import type { StorageManager } from "../lib/storage.ts";

/**
 * 创建播放列表下载工具的处理器
 * 当用户要求下载播放列表或频道内容时会自动调用此工具
 */
export function createDownloadPlaylistTool(
    executor: YtDlpExecutor,
    storage: StorageManager,
): MCPToolHandler {
    const tool: MCPTool = {
        name: "download_playlist",
        description:
            "下载整个播放列表或频道的视频。当用户说'下载这个播放列表'、'下载频道所有视频'、'批量下载'等涉及多个视频下载的需求时，应该主动调用此工具。支持限制下载数量、指定下载范围等选项，避免过大的下载任务。",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "播放列表或频道的 URL 地址",
                },
                format: {
                    type: "string",
                    description: "视频格式选择器，应用于播放列表中的所有视频",
                    default: "best",
                },
                max_downloads: {
                    type: "number",
                    description: "最大下载数量，防止下载过多视频（建议不超过 10）",
                },
                playlist_start: {
                    type: "number",
                    description: "从播放列表的第几个视频开始下载（1-based 索引）",
                },
                playlist_end: {
                    type: "number",
                    description: "下载到播放列表的第几个视频结束（1-based 索引）",
                },
            },
            required: ["url"],
        },
    };

    const handler = async (args: Record<string, unknown>): Promise<MCPToolResult> => {
        const { url, format = "best", max_downloads, playlist_start, playlist_end } = args;

        // 参数验证
        if (typeof url !== "string" || !url.trim()) {
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: "错误：请提供有效的播放列表或频道 URL 地址",
                }],
            };
        }

        // 安全检查：限制下载数量
        const maxAllowedDownloads = 20; // 设置合理的上限
        let actualMaxDownloads = maxAllowedDownloads;

        if (typeof max_downloads === "number" && max_downloads > 0) {
            if (max_downloads > maxAllowedDownloads) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text:
                            `错误：为避免过度使用资源，单次最多只能下载 ${maxAllowedDownloads} 个视频。请减少下载数量或分批下载。`,
                    }],
                };
            }
            actualMaxDownloads = max_downloads;
        }

        try {
            // 构建下载选项
            const downloadOptions = {
                format: typeof format === "string" ? format : "best",
                maxDownloads: actualMaxDownloads,
                playlistStart: typeof playlist_start === "number" ? playlist_start : undefined,
                playlistEnd: typeof playlist_end === "number" ? playlist_end : undefined,
            };

            // 生成输出模板
            const timestamp = new Date().getTime();
            const _outputTemplate = `playlist_${timestamp}/%(playlist_index)s_%(title)s.%(ext)s`;

            // 执行播放列表下载
            const downloadResult = await executor.downloadPlaylist(url.trim(), downloadOptions);

            if (!downloadResult.success) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `播放列表下载失败：${downloadResult.error || "未知错误"}`,
                    }],
                };
            }

            // 解析下载结果
            const _outputLines = downloadResult.output.split("\n");
            const downloadedFiles: string[] = [];
            const downloadedUrls: string[] = [];
            let completedCount = 0;
            let errorCount = 0;

            // 查找播放列表目录
            const playlistDir = `playlist_${timestamp}`;

            try {
                // 检查目录是否存在
                await Deno.stat(playlistDir);

                // 扫描下载的文件
                for await (const dirEntry of Deno.readDir(playlistDir)) {
                    if (dirEntry.isFile) {
                        downloadedFiles.push(dirEntry.name);

                        try {
                            // 上传文件到存储
                            const filePath = `${playlistDir}/${dirEntry.name}`;
                            const uploadResult = await storage.uploadFile(filePath, dirEntry.name);

                            if (uploadResult.success && uploadResult.url) {
                                downloadedUrls.push(`- [${dirEntry.name}](${uploadResult.url})`);
                                completedCount++;
                            } else {
                                errorCount++;
                                console.error(`上传失败: ${dirEntry.name}`, uploadResult.error);
                            }

                            // 清理本地文件
                            await storage.cleanupLocalFile(filePath);
                        } catch (uploadError) {
                            errorCount++;
                            console.error(`处理文件失败: ${dirEntry.name}`, uploadError);
                        }
                    }
                }

                // 清理播放列表目录
                try {
                    await Deno.remove(playlistDir, { recursive: true });
                } catch (cleanupError) {
                    console.warn("清理目录失败:", cleanupError);
                }
            } catch (dirError) {
                console.warn("访问播放列表目录失败:", dirError);

                // 如果目录不存在，可能是单个文件下载
                return {
                    content: [{
                        type: "text",
                        text:
                            `✅ **播放列表处理完成**\n\n📊 **下载概要**：\n${downloadResult.output}\n\n💡 **提示**：可能只下载了部分内容或格式不支持播放列表。`,
                    }],
                };
            }

            // 构建结果报告
            const resultLines = [
                `🎬 **播放列表下载完成！**`,
                ``,
                `📊 **下载统计**：`,
                `- 成功下载：${completedCount} 个文件`,
                errorCount > 0 ? `- 失败：${errorCount} 个文件` : "",
                `- 总计处理：${downloadedFiles.length} 个文件`,
                ``,
                `🔗 **下载链接**：`,
            ].filter((line) => line !== "");

            if (downloadedUrls.length > 0) {
                resultLines.push(...downloadedUrls);
            } else {
                resultLines.push("暂无可用下载链接");
            }

            resultLines.push(
                ``,
                `💡 **提示**：`,
                `- 所有链接有效期为 24 小时`,
                `- 建议及时下载到本地保存`,
                `- 大文件下载可能需要较长时间`,
            );

            if (errorCount > 0) {
                resultLines.push(
                    ``,
                    `⚠️ **注意**：部分文件处理失败，请检查网络连接或稍后重试。`,
                );
            }

            return {
                content: [{
                    type: "text",
                    text: resultLines.join("\n"),
                }],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: `下载播放列表时发生错误：${errorMessage}`,
                }],
            };
        }
    };

    return { tool, handler };
}
