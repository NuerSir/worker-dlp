// 通用下载任务调度器，供所有下载型工具调用
import { createTask, updateTaskStatus } from "./storage.ts";
import type { TaskBase, TaskStatus, MCPToolResult, DownloadResult, DownloadEntry } from "../types/mcp.ts";
import { TaskStatus as StatusEnum } from "../types/mcp.ts";
import { getDefaultOutputTemplate, getDownloadUrl } from "../config.ts";
import type { ApiResponse } from "../types/api.ts";
import { ApiErrorCode } from "../types/api.ts";
import { YtDlpExecutor, YtDlpMeta } from "./executor.ts";
import { getAllTasks } from "./storage.ts";


/**
 * 恢复所有未完成（pending/running）任务，支持服务重启后的自动恢复。
 * 仅调度未完成任务，不会重复已完成/失败任务。
 * 需在 index.ts 启动时调用。
 */
export async function recoverUnfinishedTasks() {
    const tasks = getAllTasks();
    for (const task of tasks) {
        if (task.status === StatusEnum.PENDING || task.status === StatusEnum.RUNNING) {
            try {
                switch (task.type) {
                    case "download_video": {
                        const mod = await import("../tools/download-video.ts");
                        if (mod && mod.default && typeof mod.default.handler === "function") {
                            console.log(`[任务恢复] 自动恢复视频任务: ${task.id}`);
                            // 直接调用 handler 恢复（需 handler 支持幂等）
                            mod.default.handler(task.input);
                        }
                        break;
                    }
                    case "download_playlist": {
                        const mod = await import("../tools/download-playlist.ts");
                        if (mod && mod.default && typeof mod.default.handler === "function") {
                            console.log(`[任务恢复] 自动恢复合集任务: ${task.id}`);
                            mod.default.handler(task.input);
                        }
                        break;
                    }
                    // 可扩展更多类型
                    default:
                        console.log(`[任务恢复] 检测到未完成任务: ${task.id} (${task.type})，暂不支持自动恢复。`);
                }
            } catch (err) {
                console.error(`[任务恢复] 恢复任务 ${task.id} (${task.type}) 失败:`, err);
            }
        }
    }
}

export interface DownloadTaskOptions {
    type: string; // 任务类型
    url: string;
    input: Record<string, unknown>;
    sync?: boolean;
    outputTemplate?: string;
    onDownload: (id: string, url: string, task: TaskBase, outputTemplate: string) => Promise<MCPToolResult>;
}

export async function downloadTask({ type, url, input, sync, outputTemplate, onDownload }: DownloadTaskOptions): Promise<ApiResponse<{ taskId: string }>> {
    if (typeof url !== "string" || !url.trim()) {
        return {
            code: ApiErrorCode.INVALID_PARAM,
            msg: "错误：请提供有效的 URL 地址",
        };
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const tpl = outputTemplate || getDefaultOutputTemplate();
    const executor = new YtDlpExecutor();
    // 1. 获取元信息
    const metaResp = await executor.getMeta(url);
    let meta: YtDlpMeta | undefined = undefined;
    if (metaResp.code === ApiErrorCode.OK && metaResp.data) {
        meta = metaResp.data;
    }
    // 初始化 DownloadResult 结构
    const initialResult: DownloadResult = {
        entries: [],
        status: StatusEnum.PENDING,
        progress: 0,
    };
    const task: TaskBase = {
        id,
        type: type as import("../types/mcp.ts").TaskType,
        status: StatusEnum.PENDING,
        createdAt: now,
        updatedAt: now,
        input,
        meta,
        result: initialResult,
    };
    await createTask(task);
    const download = async (): Promise<ApiResponse<{ taskId: string }>> => {
        try {
            await updateTaskStatus(id, StatusEnum.RUNNING);
            const result = await onDownload(id, url, task, tpl);
            if (result.code === ApiErrorCode.OK) {
                // 2. 写入 DownloadResult 产物信息（单文件/多文件均为 entries 数组）
                let entries: DownloadEntry[] = [];
                // 若 result.data 为对象且含 entries 字段，直接用（如 playlist）
                const resultData = result.data as { entries?: DownloadEntry[] } | undefined;
                if (resultData && Array.isArray(resultData.entries)) {
                    entries = resultData.entries;
                } else {
                    // 单文件下载
                    entries = [{
                        id: meta?.id || id,
                        title: meta?.title || "",
                        path: tpl,
                        downloadUrl: undefined, // 可后续补充 getDownloadUrl(id)
                        status: StatusEnum.SUCCESS,
                        progress: 100,
                        size: undefined,
                        duration: meta?.duration,
                        uploader: meta?.uploader,
                        ext: undefined,
                        playlist_index: undefined,
                    }];
                }
                const downloadResult: DownloadResult = {
                    entries,
                    status: StatusEnum.SUCCESS,
                    progress: 100,
                };
                await updateTaskStatus(id, StatusEnum.SUCCESS, downloadResult);
                return {
                    code: ApiErrorCode.OK,
                    msg: "下载成功",
                    data: { taskId: id },
                };
            } else {
                // 失败也写入 DownloadResult，便于前端展示部分成功/失败等
                const failResult: DownloadResult = {
                    entries: [],
                    status: StatusEnum.FAILED,
                    progress: 0,
                    error: result.msg || "下载失败",
                };
                await updateTaskStatus(id, StatusEnum.FAILED, failResult, result.msg);
                return {
                    code: result.code,
                    msg: result.msg || "下载失败",
                    data: { taskId: id },
                };
            }
        } catch (err) {
            await updateTaskStatus(id, StatusEnum.FAILED, undefined, err instanceof Error ? err.message : String(err));
            return {
                code: ApiErrorCode.INTERNAL_ERROR,
                msg: `下载异常：${err instanceof Error ? err.message : String(err)}`,
                data: { taskId: id },
            };
        }
    };
    if (sync) {
        return await download();
    } else {
        (async () => { await download(); })();
        return {
            code: ApiErrorCode.OK,
            msg: `任务已提交，稍后可通过 /task/${id} 获取结果。`,
            data: { taskId: id },
        };
    }
}
