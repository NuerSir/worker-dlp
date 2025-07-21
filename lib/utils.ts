/**
 * 通用工具函数
 * 提供项目中各处需要的公共功能
 */
import { path } from "../deps.ts";


/**
 * 获取系统临时目录
 */
export function getTempDir(): string {
    const os = Deno.build.os;

    if (os === "windows") {
        return Deno.env.get("TEMP") || Deno.env.get("TMP") || "C:\\temp";
    } else {
        return Deno.env.get("TMPDIR") || "/tmp";
    }
}

/**
 * 云存储安全的文件名清理
 * 遵循 AWS S3、Azure Blob Storage 等云存储的命名规范
 */
export function sanitizeFileName(fileName: string): string {
    if (!fileName || fileName.trim().length === 0) {
        return "unnamed";
    }

    let cleaned = fileName.trim();

    // 1. 移除或替换不安全的字符，只保留安全字符
    // 安全字符：字母、数字、连字符、下划线、点号
    cleaned = cleaned
        .normalize('NFD') // 规范化 Unicode
        .replace(/[\u0300-\u036f]/g, '') // 移除重音符号
        .replace(/[^\w\s.-]/g, '') // 只保留字母、数字、空格、点、连字符
        .replace(/\s+/g, '-') // 空格替换为连字符
        .replace(/\.{2,}/g, '.') // 多个点替换为单个点
        .replace(/-{2,}/g, '-') // 多个连字符替换为单个
        .replace(/^[-._]+|[-._]+$/g, '') // 移除开头和结尾的特殊字符
        .toLowerCase(); // 转为小写（云存储推荐）

    // 2. 限制长度（大多数云存储建议文件名不超过 255 字符，但实际应该更短）
    const maxLength = 100; // 保守的长度限制
    if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength);
        // 确保不以特殊字符结尾
        cleaned = cleaned.replace(/[-._]+$/, '');
    }

    // 3. 避免空文件名或只有扩展名的情况
    if (cleaned.length === 0 || cleaned === '.') {
        cleaned = 'unnamed';
    }

    return cleaned;
}

/**
 * 从视频URL获取基础文件名
 */
export async function getBaseFileNameFromUrl(executor: { getVideoInfo: (url: string) => Promise<{ success: boolean; output: string }> }, url: string, defaultName: string = "video"): Promise<string> {
    try {
        const videoInfoResult = await executor.getVideoInfo(url.trim());

        if (videoInfoResult.success) {
            try {
                const videoInfo = JSON.parse(videoInfoResult.output);
                const title = videoInfo.title || defaultName;
                // 应用文件名清理
                return sanitizeFileName(title);
            } catch {
                return sanitizeFileName(defaultName);
            }
        }
    } catch (error) {
        console.warn(`获取视频信息失败: ${error}`);
    }

    return sanitizeFileName(defaultName);
}

/**
 * 在临时目录中查找匹配的文件
 */
export async function findFileInTempDir(pattern: string, extension: string = ""): Promise<string | null> {
    const tempDir = getTempDir();

    try {
        // 首先检查目录是否存在
        const dirInfo = await Deno.stat(tempDir).catch(() => null);
        if (!dirInfo || !dirInfo.isDirectory) {
            console.warn(`临时目录不存在或不是目录: ${tempDir}`);
            return null;
        }

        for await (const entry of Deno.readDir(tempDir)) {
            if (entry.isFile) {
                const fileName = entry.name;

                // 检查文件名是否包含模式
                if (fileName.includes(pattern)) {
                    // 如果指定了扩展名，检查扩展名是否匹配
                    if (extension && !fileName.endsWith(extension)) {
                        continue;
                    }

                    return path.join(tempDir, fileName);
                }
            }
        }
    } catch (error) {
        console.warn(`读取临时目录失败: ${error}`);
    }

    return null;
}

/**
 * 从yt-dlp输出中提取文件路径
 */
export function extractFilePathFromOutput(output: string): string {
    const outputLines = output.split('\n');
    const actualTempDir = getTempDir();

    // 优先查找 "[ExtractAudio] Destination:" 行
    for (const line of outputLines) {
        if (line.includes("[ExtractAudio] Destination:")) {
            const extractedPath = line.split("[ExtractAudio] Destination:")[1].trim();
            // 修复：使用 path.isAbsolute 而不是简单检查 '/'
            if (path.isAbsolute(extractedPath)) {
                return extractedPath;
            } else {
                return path.join(actualTempDir, extractedPath);
            }
        }
    }

    // 如果没有找到音频转换行，查找普通的 "Destination:" 行
    for (const line of outputLines) {
        if (line.includes("Destination:") && !line.includes("[ExtractAudio]")) {
            const extractedPath = line.split("Destination:")[1].trim();
            if (path.isAbsolute(extractedPath)) {
                return extractedPath;
            } else {
                return path.join(actualTempDir, extractedPath);
            }
        }
    }

    return "";
}

/**
 * 生成带时间戳的唯一文件名模板
 */
export function generateOutputTemplate(prefix: string = "file", extension: string = "%(ext)s"): string {
    const timestamp = new Date().getTime();
    return `${prefix}_${timestamp}.${extension}`;
}
