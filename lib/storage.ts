/**
 * Supabase 存储管理器
 * 处理文件上传、下载、清理等存储相关操作
 */

import { createClient, type SupabaseClient } from "../deps.ts";

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
    async initializeBucket(): Promise<void> {
        //TODO: 暂时没必要;
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

            // 生成唯一的文件名（添加时间戳）
            const timestamp = Date.now();
            const uniqueFileName = `${timestamp}_${fileName}`;

            // 上传到 Supabase Storage
            const { error: uploadError } = await this.supabase.storage
                .from(this.bucketName)
                .upload(uniqueFileName, fileData, {
                    cacheControl: "3600",
                    upsert: false,
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

            const expiredFiles = files.filter((file) => {
                const fileTime = new Date(file.created_at);
                return fileTime < cutoffTime;
            });

            // 批量删除过期文件
            if (expiredFiles.length > 0) {
                const filesToDelete = expiredFiles.map((file) => file.name);
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
            const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);

            return { totalFiles, totalSize };
        } catch (error) {
            console.error("获取存储统计失败:", error);
            return { totalFiles: 0, totalSize: 0 };
        }
    }
}
