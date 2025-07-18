/**
 * 统一配置管理 - Supabase Edge Functions 环境
 * 集中管理所有环境变量和配置项
 */

/**
 * 应用配置接口
 */
export interface AppConfig {
    // 服务器配置
    server: {
        name: string;
        version: string;
        description: string;
    };

    // 安全配置
    security: {
        apiKey?: string;
        corsOrigins: string[];
    };

    // 网络配置
    network: {
        proxyUrl?: string;
    };

    // Supabase 配置
    supabase: {
        url: string;
        anonKey: string;
        storageBucket: string;
    };

    // 功能配置
    features: {
        maxDownloads: number;
        fileRetentionHours: number;
        debugMode: boolean;
    };
}

/**
 * 配置覆盖选项 - 用于边缘函数内部配置
 */
export interface ConfigOverrides {
    // 网络配置覆盖
    PROXY_URL?: string;
    
    // Supabase 配置覆盖
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    STORAGE_BUCKET?: string;
    
    // 安全配置覆盖
    WORKER_DLP_API_KEY?: string;
    
    // 功能配置覆盖
    MAX_DOWNLOADS?: string;
    FILE_RETENTION_HOURS?: string;
    DENO_LOG?: string;
}

/**
 * 从环境变量和覆盖参数加载配置
 * 优先级：覆盖参数 > 环境变量 > 默认值
 * 
 * @param overrides 配置覆盖对象，用于边缘函数内部配置
 */
export function loadConfig(overrides: ConfigOverrides = {}): AppConfig {
    // 获取环境变量值，支持覆盖
    const getEnvValue = (key: keyof ConfigOverrides, fallback?: string): string | undefined => {
        return overrides[key] ?? Deno.env.get(key) ?? fallback;
    };

    return {
        server: {
            name: "worker-dlp",
            version: "2.0.0",
            description: "基于云端的视频下载和音频提取服务，支持多平台视频处理",
        },

        security: {
            apiKey: getEnvValue("WORKER_DLP_API_KEY"),
            corsOrigins: [
                "*", // 开发环境允许所有源，生产环境建议限制
            ],
        },

        network: {
            proxyUrl: getEnvValue("PROXY_URL"),
        },

        supabase: {
            url: getEnvValue("SUPABASE_URL", "http://localhost:54321")!,
            anonKey: getEnvValue("SUPABASE_ANON_KEY", "")!,
            storageBucket: getEnvValue("STORAGE_BUCKET", "tmp")!,
        },

        features: {
            maxDownloads: parseInt(getEnvValue("MAX_DOWNLOADS", "10")!),
            fileRetentionHours: parseInt(getEnvValue("FILE_RETENTION_HOURS", "24")!),
            debugMode: getEnvValue("DENO_LOG") === "debug",
        },
    };
}

/**
 * 验证配置是否完整
 */
export function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.supabase.url) {
        errors.push("缺少 SUPABASE_URL 环境变量");
    }

    if (!config.supabase.anonKey) {
        errors.push("缺少 SUPABASE_ANON_KEY 环境变量");
    }

    if (config.features.maxDownloads <= 0) {
        errors.push("MAX_DOWNLOADS 必须大于 0");
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}








/**
 * 全局配置实例
 * 
 * 在边缘函数中，您可以通过以下方式覆盖配置：
 * 
 * @example
 * ```typescript
 * // 使用自定义代理和存储桶
 * export const config = loadConfig({
 *   PROXY_URL: "http://0.0.0.0:10080",
 *   STORAGE_BUCKET: "my-private-bucket"
 * });
 * ```
 */
export const config = loadConfig({
    // 在这里添加边缘函数特定的配置覆盖
    // 例如：PROXY_URL: "http://0.0.0.0:10080"
});

/**
 * 用于测试的配置加载器
 * 当直接运行此文件时，输出当前配置
 */
if (import.meta.main) {
    console.log("🔧 当前配置:");
    console.log(JSON.stringify(config, null, 2));
    
    const validation = validateConfig(config);
    if (validation.valid) {
        console.log("✅ 配置验证通过");
    } else {
        console.log("❌ 配置验证失败:");
        validation.errors.forEach(error => console.log(`  - ${error}`));
    }
}
