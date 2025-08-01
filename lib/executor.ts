import type { ExecutorResult } from "../types/mcp.ts";
import { getFilesDir } from "./storage.ts";
import type { ApiResponse } from "../types/api.ts";
import { ApiErrorCode } from "../types/api.ts";
import { config } from "../config.ts";
// yt-dlp 元信息类型
export interface YtDlpMeta {
    id: string;
    title: string;
    duration?: number;
    uploader?: string;
    [key: string]: unknown;
}

/**
 * yt-dlp 命令执行器
 *
 * 负责执行各种 yt-dlp 操作并返回结果
 * 支持代理配置、错误处理和多种下载选项
 *
 * 主要功能：
 * - 视频信息获取 (JSON 格式)
 * - 视频格式查询
 * - 视频文件下载
 * - 音频提取
 * - 播放列表批量下载
 *
 * @class YtDlpExecutor
 */
export class YtDlpExecutor {
    private proxyUrl?: string;

    /**
     * 创建 yt-dlp 执行器实例
     * @param proxyUrl 可选的代理服务器 URL
     */
    constructor(proxyUrl?: string) {
        this.proxyUrl = proxyUrl || config.network.proxyUrl;
        // if (this.proxyUrl) {
        //     console.log(`🌐 YtDlpExecutor 已配置代理: ${this.proxyUrl}`);
        // }
    }

    /**
     * 执行 yt-dlp 命令的核心方法
     * 自动添加代理配置，处理输出和错误
     *
     * @param args yt-dlp 命令参数数组
     * @param taskId 可选的任务ID，用于进程管理
     * @returns 执行结果，包含成功状态、输出和错误信息
     */
    async execute(args: string[], taskId?: string): Promise<ExecutorResult> {
        try {
            // 如果配置了代理，则添加代理参数
            const finalArgs = this.proxyUrl ? ["--proxy", this.proxyUrl, ...args] : args;

            // 边缘函数环境：只在调试模式下输出详细命令
            if (Deno.env.get("DENO_LOG") === "debug") {
                console.log(`🔧 执行 yt-dlp: ${finalArgs.join(" ")}`);
            }

            const command = new Deno.Command("yt-dlp", {
                args: finalArgs,
                stdout: "piped",
                stderr: "piped",
            });

            const child = command.spawn();

            // 如果提供了 taskId，记录进程 PID 用于后续管理
            if (taskId && child.pid) {
                const { updateTaskProcessId } = await import("./storage.ts");
                await updateTaskProcessId(taskId, child.pid);
            }

            const { code, stdout, stderr } = await child.output();

            // 执行完成后清除进程 PID
            if (taskId) {
                const { updateTaskProcessId } = await import("./storage.ts");
                await updateTaskProcessId(taskId, undefined);
            }

            const output = new TextDecoder().decode(stdout);
            const error = new TextDecoder().decode(stderr);

            const success = code === ApiErrorCode.OK;
            console.log(
                `${success ? "✅" : "❌"} yt-dlp 命令执行${
                    success ? "成功" : "失败"
                } (代码: ${code})`,
            );

            return {
                success,
                output,
                error: code !== 0 ? error : undefined,
            };
        } catch (err) {
            // 执行异常时也要清除进程 PID
            if (taskId) {
                try {
                    const { updateTaskProcessId } = await import("./storage.ts");
                    await updateTaskProcessId(taskId, undefined);
                } catch {
                    // 忽略清理错误
                }
            }

            const errorMessage = err instanceof Error ? err.message : "未知错误";
            console.error("❌ yt-dlp 命令执行异常:", errorMessage);

            return {
                success: false,
                output: "",
                error: `执行 yt-dlp 失败: ${errorMessage}`,
            };
        }
    }

    /**
     * 获取视频/音频元信息（JSON 格式）
     * @param url 视频/音频 URL
     * @param extraArgs 额外 yt-dlp 参数
     * @returns ApiResponse<YtDlpMeta>
     */
    async getMeta(url: string, extraArgs: string[] = []): Promise<ApiResponse<YtDlpMeta>> {
        if (!url || typeof url !== "string") {
            return { code: ApiErrorCode.INVALID_PARAM, msg: "无效的URL参数" };
        }
        const args = ["--dump-json", "--no-download", ...extraArgs, url];
        const result = await this.execute(args);
        if (!result.success || !result.output) {
            return { code: ApiErrorCode.META_FETCH_FAILED, msg: result.error || "获取元信息失败" };
        }
        let meta: YtDlpMeta;
        try {
            meta = JSON.parse(result.output);
        } catch (e) {
            return { code: ApiErrorCode.META_FETCH_FAILED, msg: "元信息解析失败" };
        }
        return { code: ApiErrorCode.OK, msg: "ok", data: meta };
    }

    /**
     * 兼容旧接口，获取视频信息（JSON 格式）
     * @deprecated 请使用 getMeta
     */
    getVideoInfo(url: string): Promise<ExecutorResult> {
        console.log(`📊 获取视频信息: ${url}`);
        return this.execute(["--dump-json", "--no-download", url]);
    }

    /**
     * 获取可用格式列表
     * 显示所有可下载的视频和音频格式
     *
     * @param url 视频 URL
     * @returns 格式列表文本结果
     */
    getFormats(url: string): Promise<ExecutorResult> {
        console.log(`📋 查询可用格式: ${url}`);
        return this.execute(["-F", url]);
    }

    /**
     * 下载视频文件
     * 支持格式选择、质量指定和输出模板自定义
     *
     * @param url 视频 URL
     * @param options 下载选项
     * @param options.format 格式选择器 (如 "best", "worst", "mp4")
     * @param options.quality 质量偏好 (如 "720p", "1080p")
     * @param options.outputTemplate 输出文件名模板
     * @returns 下载执行结果
     */
    downloadVideo(url: string, options: {
        format?: string;
        quality?: string;
        outputTemplate?: string;
    } = {}): Promise<ExecutorResult> {
        const args: string[] = [];

        if (options.format) {
            args.push("-f", options.format);
        }

        if (options.quality && options.format === "best") {
            args.push("-f", `best[height<=${options.quality.replace("p", "")}]`);
        }

        if (options.outputTemplate) {
            // 统一输出到 files 目录
            const outputPath = `${getFilesDir()}/${options.outputTemplate}`;
            args.push("-o", outputPath);
        } else {
            // 默认输出到 storage/files
            const outputPath = `${getFilesDir()}/%(title)s.%(ext)s`;
            args.push("-o", outputPath);
        }

        args.push(url);

        console.log(`📥 下载视频: ${url} (格式: ${options.format || "best"})`);
        return this.execute(args);
    }

    /**
     * 从视频中提取音频
     * 支持多种音频格式和质量选项
     *
     * @param url 视频 URL
     * @param options 音频提取选项
     * @param options.format 音频格式 (如 "mp3", "aac", "flac")
     * @param options.quality 音频质量 (如 "best", "320K", "128K")
     * @param options.outputTemplate 输出文件名模板
     * @returns 音频提取执行结果
     */
    extractAudio(url: string, options: {
        format?: string;
        quality?: string;
        outputTemplate?: string;
    } = {}): Promise<ExecutorResult> {
        const args: string[] = ["--extract-audio"];

        if (options.format) {
            args.push("--audio-format", options.format);
        }

        if (options.quality && options.quality !== "best") {
            args.push("--audio-quality", options.quality);
        }

        if (options.outputTemplate) {
            // 统一输出到 files 目录
            const outputPath = `${getFilesDir()}/${options.outputTemplate}`;
            args.push("-o", outputPath);
        } else {
            // 默认输出到 storage/files
            const outputPath = `${getFilesDir()}/%(title)s.%(ext)s`;
            args.push("-o", outputPath);
        }

        args.push(url);

        console.log(`🎵 提取音频: ${url} (格式: ${options.format || "mp3"})`);
        return this.execute(args);
    }

    /**
     * 批量下载播放列表或频道视频
     * 支持下载范围控制和数量限制
     *
     * @param url 播放列表或频道 URL
     * @param options 批量下载选项
     * @param options.format 视频格式选择器
     * @param options.maxDownloads 最大下载数量
     * @param options.playlistStart 开始下载的索引位置 (1-based)
     * @param options.playlistEnd 结束下载的索引位置 (1-based)
     * @returns 批量下载执行结果
     */
    downloadPlaylist(url: string, options: {
        format?: string;
        maxDownloads?: number;
        playlistStart?: number;
        playlistEnd?: number;
    } = {}): Promise<ExecutorResult> {
        const args: string[] = [];

        if (options.format) {
            args.push("-f", options.format);
        }

        if (options.maxDownloads) {
            args.push("--max-downloads", options.maxDownloads.toString());
        }

        if (options.playlistStart) {
            args.push("--playlist-start", options.playlistStart.toString());
        }

        if (options.playlistEnd) {
            args.push("--playlist-end", options.playlistEnd.toString());
        }

        args.push(url);

        console.log(`📋 下载播放列表: ${url} (最大: ${options.maxDownloads || "无限制"})`);
        return this.execute(args);
    }
}
