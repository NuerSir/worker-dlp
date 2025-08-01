import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import { YtDlpExecutor } from "../lib/executor.ts";
import { downloadTask } from "../lib/download-task.ts";

import { ApiErrorCode } from "../types/api.ts";


export const name = "download_video";
export const tool: MCPTool = {
    name,
    description: "下载单个视频到云端存储。仅下载单视频（不含合集/playlist），支持格式、画质等参数。下载完成后返回可直接访问的下载链接。",
    inputSchema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "要下载的视频 URL 地址（仅单视频）",
            },
            format: {
                type: "string",
                description: "视频格式选择器，如 'best'、'worst'、'bestvideo+bestaudio'",
                default: "best",
            },
            quality: {
                type: "string",
                description: "视频画质偏好，如 '720p'、'1080p'、'480p' 等",
            },
            output_template: {
                type: "string",
                description: "输出文件名模板，如 '%(title)s.%(ext)s'",
            },
            sync: {
                type: "boolean",
                description: "是否同步等待下载完成，true=同步，false=异步（默认）",
                default: false,
            },
        },
        required: ["url"],
    },
};

const handler: MCPToolHandler["handler"] = async (args: Record<string, unknown>): Promise<MCPToolResult> => {
    const { url, format = "best", quality, output_template, sync } = args as Record<string, unknown>;
    return await downloadTask({
        type: "download_video",
        url: url as string,
        input: { url, format, quality, output_template },
        sync: !!sync,
        outputTemplate: typeof output_template === "string" && output_template ? output_template : undefined,
        onDownload: async (_id, url, task, outputTemplate) => {
            const executor = new YtDlpExecutor();
            // use resume flag for idempotency
            const ytArgs: string[] = ["-c", "--no-playlist"];
            if (typeof format === "string") ytArgs.push("-f", format);
            if (typeof quality === "string" && format === "best") ytArgs.push("-f", `best[height<=${quality.replace("p", "")}]`);
            ytArgs.push("-o", outputTemplate);
            ytArgs.push(url);
            // 使用 downloadTask 已获取的元信息，不再重复调用 getMeta
            const meta = task.meta;
            const result = await executor.execute(ytArgs, _id);
            if (result.success) {
// 返回 DownloadEntry 数组
                return {
                    code: ApiErrorCode.OK,
                    msg: "单视频下载成功",
                    data: {
                        entries: [{
                            id: meta?.id || _id,
                            title: meta?.title || "",
                            path: outputTemplate,
                            downloadUrl: undefined, // 可后续补充
                            status: "success",
                            progress: 100,
                            size: undefined,
                            duration: meta?.duration,
                            uploader: meta?.uploader,
                            ext: meta?.ext,
                            playlist_index: undefined,
                        }],
                    },
                };
            } else {
                return { code: ApiErrorCode.DOWNLOAD_FAILED, msg: result.error || "未知错误" };
            }
        },
    });
};

export default { name, tool, handler };
