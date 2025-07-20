/**
 * 通用工具函数
 * 提供项目中各处需要的公共功能
 */

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
 * 清理文件名中的特殊字符
 * 使用字符映射而不是简单删除，保持文件名的可读性
 */
export function sanitizeFileName(fileName: string): string {
    // 字符映射表
    const charMap: Record<string, string> = {
        // Emoji 映射
        '🤯': '[mind-blown]',
        '🧂': '[salt]',
        '❤️': '[heart]',
        '😎': '[cool]',
        '🔥': '[fire]',
        '💯': '[hundred]',
        '🚀': '[rocket]',
        '⭐': '[star]',
        '🎵': '[music]',
        '🎶': '[notes]',
        
        // 特殊字符映射
        ':': '_colon_',
        '?': '_question_',
        '<': '_lt_',
        '>': '_gt_',
        '"': '_quote_',
        '|': '_pipe_',
        '*': '_star_',
        '/': '_slash_',
        '\\': '_backslash_',
        
        // 其他常见特殊字符
        '&': '_and_',
        '@': '_at_',
        '#': '_hash_',
        '%': '_percent_',
        '+': '_plus_',
        '=': '_equals_',
        '[': '_bracket_',
        ']': '_bracket_',
        '{': '_brace_',
        '}': '_brace_',
        '^': '_caret_',
        '~': '_tilde_',
        '`': '_grave_',
    };

    let cleaned = fileName;
    
    // 应用字符映射
    for (const [char, replacement] of Object.entries(charMap)) {
        cleaned = cleaned.replaceAll(char, replacement);
    }
    
    // 清理连续的空格和特殊字符
    cleaned = cleaned
        .replace(/\s+/g, '_')              // 多个空格替换为单个下划线
        .replace(/_{2,}/g, '_')            // 多个连续下划线替换为单个
        .replace(/^_+|_+$/g, '')           // 移除开头和结尾的下划线
        .replace(/[^a-zA-Z0-9._-]/g, '');  // 移除其他特殊字符
    
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
        for await (const entry of Deno.readDir(tempDir)) {
            if (entry.isFile) {
                const fileName = entry.name;
                
                // 检查文件名是否包含模式
                if (fileName.includes(pattern)) {
                    // 如果指定了扩展名，检查扩展名是否匹配
                    if (extension && !fileName.endsWith(extension)) {
                        continue;
                    }
                    
                    return `${tempDir}/${fileName}`;
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
    
    // 优先查找 "[ExtractAudio] Destination:" 行（音频转换后的最终文件）
    for (const line of outputLines) {
        if (line.includes("[ExtractAudio] Destination:")) {
            const extractedPath = line.split("[ExtractAudio] Destination:")[1].trim();
            // 如果路径不是绝对路径，添加临时目录前缀
            return extractedPath.startsWith('/') ? extractedPath : `${actualTempDir}/${extractedPath}`;
        }
    }
    
    // 如果没有找到音频转换行，查找普通的 "Destination:" 行
    for (const line of outputLines) {
        if (line.includes("Destination:") && !line.includes("[ExtractAudio]")) {
            const extractedPath = line.split("Destination:")[1].trim();
            // 如果路径不是绝对路径，添加临时目录前缀
            return extractedPath.startsWith('/') ? extractedPath : `${actualTempDir}/${extractedPath}`;
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
