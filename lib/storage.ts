/**
 * Supabase 存储管理器
 * 处理文件上传、下载、清理等存储相关操作
 */

import { createClient, type SupabaseClient } from "../deps.ts";
import { sanitizeFileName, getTempDir, findFileInTempDir } from "./utils.ts";

/**
 * 文件上传结果接口
 */
export interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

/**
 * Supabase Storage 管理器
 * 负责文件的上传、清理和管理
 */
export class StorageManager {
    private supabase: SupabaseClient;
    private bucketName: string;

    /**
     * 创建存储管理器实例
     * @param supabaseUrl Supabase 项目 URL
     * @param supabaseKey Supabase 匿名密钥
     * @param bucketName 存储桶名称，默认为 "downloads"
     */
    constructor(supabaseUrl: string, supabaseKey: string, bucketName = "tmp") {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.bucketName = bucketName;
        // 边缘函数环境下减少启动日志
    }

    /**
     * 初始化存储桶（如果不存在则创建）
     */
    initializeBucket(): void {
        // TODO(@user): 暂时没必要创建存储桶，因为已经存在
        try {
            // const { data: buckets } = await this.supabase.storage.listBuckets();
            // const bucketExists = buckets?.some((bucket) => bucket.name === this.bucketName);

            // if (!bucketExists) {
            //     const {
            //         error,
            //     } = await this.supabase.storage.createBucket(this.bucketName, {
            //         public: true,
            //         allowedMimeTypes: ["video/*", "audio/*"],
            //         fileSizeLimit: 100 * 1024 * 1024, // 100MB 限制
            //     });
            //     if (error) throw error;
            // }
        } catch (error) {
            console.error("初始化存储桶失败:", error);
        }
    }

    /**
     * 上传文件到 Supabase Storage
     * @param localPath 本地文件路径
     * @param fileName 存储的文件名
     * @returns 上传结果，包含公共 URL
     */
    async uploadFile(localPath: string, fileName: string): Promise<UploadResult> {
        try {
            // 读取本地文件
            const fileData = await Deno.readFile(localPath);

            const cleanFileName = sanitizeFileName(fileName);
            const uniqueFileName = cleanFileName;
            const contentType = getMimeType(fileName);

            // 上传到 Supabase Storage
            const { error: uploadError } = await this.supabase.storage
                .from(this.bucketName)
                .upload(uniqueFileName, fileData, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: contentType,
                });

            if (uploadError) {
                return {
                    success: false,
                    error: `上传失败: ${uploadError.message}`,
                };
            }

            // 获取公共 URL
            const { data: urlData } = this.supabase.storage
                .from(this.bucketName)
                .getPublicUrl(uniqueFileName);

            return {
                success: true,
                url: urlData.publicUrl,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            return {
                success: false,
                error: `上传文件失败: ${errorMessage}`,
            };
        }
    }

    /**
     * 清理本地临时文件
     * @param filePath 要删除的文件路径
     */
    async cleanupLocalFile(filePath: string): Promise<void> {
        try {
            await Deno.remove(filePath);
        } catch (error) {
            // 忽略删除错误（文件可能已不存在）
            if (Deno.env.get("DENO_LOG") === "debug") {
                console.warn(`清理文件失败: ${filePath}`, error);
            }
        }
    }

    /**
     * 清理过期文件（边缘函数环境优化）
     * @param maxAgeHours 文件最大保存时间（小时）
     */
    async cleanupExpiredFiles(maxAgeHours = 24): Promise<void> {
        try {
            const { data: files } = await this.supabase.storage
                .from(this.bucketName)
                .list();

            if (!files || files.length === 0) return;

            // 计算过期时间
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

            const expiredFiles = files.filter((file: { created_at: string | number | Date; }) => {
                const fileTime = new Date(file.created_at);
                return fileTime < cutoffTime;
            });

            // 批量删除过期文件
            if (expiredFiles.length > 0) {
                const filesToDelete = expiredFiles.map((file: { name: string; }) => file.name);
                await this.supabase.storage
                    .from(this.bucketName)
                    .remove(filesToDelete);

                if (Deno.env.get("DENO_LOG") === "debug") {
                    console.log(`清理了 ${expiredFiles.length} 个过期文件`);
                }
            }
        } catch (error) {
            console.error("清理过期文件失败:", error);
        }
    }

    /**
     * 获取存储统计信息
     * @returns 文件总数和总大小
     */
    async getStorageStats(): Promise<{
        totalFiles: number;
        totalSize: number;
    }> {
        try {
            const { data: files } = await this.supabase.storage
                .from(this.bucketName)
                .list();

            if (!files) {
                return { totalFiles: 0, totalSize: 0 };
            }

            const totalFiles = files.length;
            const totalSize = files.reduce((sum: number, file: { metadata: { size: number; }; }) => sum + (file.metadata?.size || 0), 0);

            return { totalFiles, totalSize };
        } catch (error) {
            console.error("获取存储统计失败:", error);
            return { totalFiles: 0, totalSize: 0 };
        }
    }

    /**
     * 检查文件是否已存在于存储桶中
     * @param fileName 要检查的文件名
     * @returns 如果文件存在返回公共URL，否则返回null
     */
    async checkFileExists(fileName: string): Promise<string | null> {
        try {
            const cleanFileName = sanitizeFileName(fileName);

            // 列出存储桶中的文件，查找匹配的文件名
            const { data: files } = await this.supabase.storage
                .from(this.bucketName)
                .list();

            if (!files) return null;

            // 查找文件名包含清理后文件名的文件（考虑到时间戳前缀）
            const existingFile = files.find((file: { name: string }) =>
                file.name.includes(cleanFileName) ||
                file.name.endsWith(cleanFileName)
            );

            if (existingFile) {
                // 返回现有文件的公共URL
                const { data: urlData } = this.supabase.storage
                    .from(this.bucketName)
                    .getPublicUrl(existingFile.name);

                return urlData.publicUrl;
            }

            return null;
        } catch (error) {
            console.error("检查文件是否存在失败:", error);
            return null;
        }
    }

    /**
     * 检查本地临时目录中是否存在文件
     * @param fileName 要检查的文件名
     * @returns 如果文件存在返回完整路径，否则返回null
     */
    async checkLocalFileExists(fileName: string): Promise<string | null> {
        const cleanFileName = sanitizeFileName(fileName);
        return await findFileInTempDir(cleanFileName);
    }

    /**
     * 检查基础文件名是否已存在于存储桶中（忽略扩展名）
     * @param baseFileName 基础文件名（不包含扩展名）
     * @returns 如果找到匹配文件返回 {url: string, fileName: string}，否则返回null
     */
    async checkBaseFileNameExists(baseFileName: string): Promise<{ url: string, fileName: string } | null> {
        try {
            const cleanBaseFileName = sanitizeFileName(baseFileName);

            // 列出存储桶中的文件
            const { data: files } = await this.supabase.storage
                .from(this.bucketName)
                .list();

            if (!files) return null;

            // 查找匹配基础文件名的文件（可能有不同扩展名）
            const existingFile = files.find((file: { name: string }) => {
                // 移除时间戳前缀（如果有）
                const fileNameWithoutPrefix = file.name.replace(/^\d+_/, '');
                // 移除扩展名
                const fileBaseName = fileNameWithoutPrefix.replace(/\.[^.]*$/, '');

                return fileBaseName === cleanBaseFileName ||
                    file.name.includes(cleanBaseFileName);
            });

            if (existingFile) {
                // 返回现有文件的公共URL和文件名
                const { data: urlData } = this.supabase.storage
                    .from(this.bucketName)
                    .getPublicUrl(existingFile.name);

                return {
                    url: urlData.publicUrl,
                    fileName: existingFile.name
                };
            }

            return null;
        } catch (error) {
            console.error("检查基础文件名是否存在失败:", error);
            return null;
        }
    }
}

/**
 * 根据文件扩展名获取 MIME 类型
 * @param fileName 文件名
 * @returns MIME 类型字符串
 */
function getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    const mimeTypes: Record<string, string> = {
        // 视频格式
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime',
        'mkv': 'video/x-matroska',
        'flv': 'video/x-flv',
        '3gp': 'video/3gpp',
        'm4v': 'video/x-m4v',
        
        // 音频格式
        'mp3': 'audio/mpeg',
        'aac': 'audio/aac',
        'flac': 'audio/flac',
        'm4a': 'audio/mp4',
        'opus': 'audio/opus',
        'ogg': 'audio/ogg',
        'vorbis': 'audio/vorbis',
        'wav': 'audio/wav',
        'wma': 'audio/x-ms-wma',
        
        // 其他常见格式
        'txt': 'text/plain',
        'json': 'application/json',
        'pdf': 'application/pdf',
        'zip': 'application/zip',
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
}
