import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import { ApiErrorCode } from "../types/api.ts";
import { YtDlpExecutor } from "../lib/executor.ts";
import { downloadTask } from "../lib/download-task.ts";


// Playlist 单条目类型，便于类型安全
type PlaylistEntry = {
    id: string;
    title: string;
    duration?: number;
    uploader?: string;
    uploader_id?: string;
    channel?: string;
    channel_id?: string;
    webpage_url?: string;
    ext?: string;
    playlist_index?: number;
    thumbnails?: { url: string;[key: string]: unknown }[];
    description?: string;
    view_count?: number;
    like_count?: number;
    upload_date?: string;
    downloadUrl?: string;
    status?: string;
    progress?: number;
    error?: string;
};

// yt-dlp 返回的 meta 数据类型
type YtDlpMeta = {
    entries?: PlaylistEntry[];
    [key: string]: unknown;
};



export const name = "download_playlist";
export const tool: MCPTool = {
    name,
    description: "下载播放列表或合集到云端存储。支持 YouTube/Bilibili 等平台的 playlist/合集/频道批量下载。可指定格式、画质、下载范围等。下载完成后返回可直接访问的下载链接。",
    inputSchema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "要下载的播放列表/合集/频道 URL 地址",
            },
            format: {
                type: "string",
                description: "视频格式选择器，如 'best'（最佳质量）、'worst'（最小文件）、'bestvideo+bestaudio'（最佳视频+音频）",
                default: "best",
            },
            max_downloads: {
                type: "number",
                description: "最大下载数量（可选）",
            },
            playlist_start: {
                type: "number",
                description: "开始下载的索引位置 (1-based，可选)",
            },
            playlist_end: {
                type: "number",
                description: "结束下载的索引位置 (1-based，可选)",
            },
            quality: {
                type: "string",
                description: "视频画质偏好，如 '720p'、'1080p'、'480p' 等",
            },
            output_template: {
                type: "string",
                description: "输出文件名模板，如 '%(title)s.%(ext)s'（使用视频标题作为文件名）",
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


import { updateTaskStatus, getTask } from "../lib/storage.ts";

const handler: MCPToolHandler["handler"] = async (args: Record<string, unknown>): Promise<MCPToolResult> => {
    const { url, format = "best", quality, output_template, sync, max_downloads, playlist_start, playlist_end } = args as Record<string, unknown>;
    return await downloadTask({
        type: "download_playlist",
        url: url as string,
        input: { url, format, quality, output_template, max_downloads, playlist_start, playlist_end },
        sync: !!sync,
        outputTemplate: typeof output_template === "string" && output_template ? output_template : undefined,
        onDownload: async (taskId, url, task, outputTemplate) => {
            const executor = new YtDlpExecutor();
            // 使用 downloadTask 已获取的元信息，不再重复调用 getMeta
            let entries: PlaylistEntry[] = [];
            const metaData = task.meta as YtDlpMeta | undefined;
            if (metaData && Array.isArray(metaData.entries)) {
                entries = metaData.entries.map((item: PlaylistEntry): PlaylistEntry => ({
                    id: item.id,
                    title: item.title,
                    duration: item.duration,
                    uploader: item.uploader,
                    uploader_id: item.uploader_id,
                    channel: item.channel,
                    channel_id: item.channel_id,
                    webpage_url: item.webpage_url,
                    ext: item.ext,
                    playlist_index: item.playlist_index,
                    thumbnails: item.thumbnails,
                    description: item.description,
                    view_count: item.view_count,
                    like_count: item.like_count,
                    upload_date: item.upload_date,
                    downloadUrl: undefined,
                    status: "pending",
                    progress: 0,
                    error: undefined
                }));
            }
            // 应用 playlist_start, playlist_end, max_downloads 参数筛选
            let filtered = entries;
            if (typeof playlist_start === "number" && typeof playlist_end === "number") {
                filtered = filtered.filter(e => typeof e.playlist_index === "number" && e.playlist_index >= playlist_start && e.playlist_index <= playlist_end);
            } else if (typeof playlist_start === "number") {
                filtered = filtered.filter(e => typeof e.playlist_index === "number" && e.playlist_index >= playlist_start);
            } else if (typeof playlist_end === "number") {
                filtered = filtered.filter(e => typeof e.playlist_index === "number" && e.playlist_index <= playlist_end);
            }
            if (typeof max_downloads === "number" && filtered.length > max_downloads) {
                filtered = filtered.slice(0, max_downloads);
            }
            // 恢复历史进度
            let oldEntries: PlaylistEntry[] | undefined = undefined;
            const taskResult = task.result as { entries?: PlaylistEntry[] } | undefined;
            if (task && taskResult && Array.isArray(taskResult.entries)) {
                oldEntries = taskResult.entries;
            }
            if (oldEntries) {
                for (const entry of filtered) {
                    const old = oldEntries.find(e => e.id === entry.id);
                    if (old && old.status && old.status !== "pending") {
                        entry.status = old.status;
                        entry.progress = old.progress;
                        entry.error = old.error;
                    }
                }
            }
            // 分片循环下载
            for (let i = 0; i < filtered.length; i++) {
                const entry = filtered[i];
                if (entry.status === "success") continue;
                entry.status = "downloading";
                entry.progress = 0;
                await updateTaskStatus(taskId, "running", filtered);
                // 单条下载
                // add resume flag for idempotency and breakpoint resume
                const args: string[] = ["-c"];
                if (typeof format === "string") args.push("-f", format);
                if (typeof quality === "string" && format === "best") args.push("-f", `best[height<=${quality.replace("p", "")}]`);
                args.push("-o", outputTemplate);
                args.push(entry.webpage_url || url);
                const result = await executor.execute(args, taskId);
                if (result.success) {
                    entry.status = "success";
                    entry.progress = 100;
                } else {
                    entry.status = "failed";
                    entry.progress = 0;
                    entry.error = result.error || "下载失败";
                }
                await updateTaskStatus(taskId, "running", filtered);
            }
            // 统计整体状态
            return {
                code: filtered.every(e => e.status === "success") ? ApiErrorCode.OK : ApiErrorCode.DOWNLOAD_FAILED,
                msg: filtered.every(e => e.status === "success") ? "合集全部下载成功" : "部分失败",
                data: filtered,
            };
        },
    });
};

export default { name, tool, handler };
