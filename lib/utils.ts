/**
 * 通用工具函数
 * 提供项目中各处需要的公共功能
 */
import { path } from "../deps.ts";



/**
 * 重试函数
 * 对失败的异步操作进行重试
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delayMs = 100
): Promise<T> {
    let lastErr;
    for (let i = 0; i < retries; i++) {
        try {
        return await fn();
    } catch (err) {
        lastErr = err;
        await new Promise(res => setTimeout(res, delayMs));
    }
    }
    throw lastErr;
}

/**
 * 超时控制
 * 对 Promise 添加超时控制
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
}
