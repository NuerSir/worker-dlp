// 任务存储与状态管理模块
// 提供任务的持久化存储、状态更新、查询等功能
// 依赖 types/mcp.ts 类型定义

import { DownloadResult, TaskBase, TaskStatus, isValidStateTransition } from "../types/mcp.ts";

import { config } from "../config.ts";
import { path, LRU } from "../deps.ts";
import { withRetry, withTimeout } from "./utils.ts";

// 统一任务状态文件和产物目录
export function getTasksPath() {
    return path.join(config.storage.storageBucket, "tasks.json");
}
export function getFilesDir() {
    return path.join(config.storage.storageBucket, "files");
}

const STORAGE_PATH = getTasksPath();
const STORAGE_DIR = config.storage.storageBucket;

const CACHE_SIZE = 1000;
const cache = new LRU<TaskBase>(CACHE_SIZE);

/**
 * 确保目录和文件存在
 */
async function ensureStorage() {
    // 确保根目录和 files/ 目录存在
    try {
        await Deno.stat(STORAGE_DIR);
    } catch {
        await Deno.mkdir(STORAGE_DIR, { recursive: true });
    }
    try {
        await Deno.stat(getFilesDir());
    } catch {
        await Deno.mkdir(getFilesDir(), { recursive: true });
    }
    try {
        await Deno.stat(STORAGE_PATH);
    } catch {
        await Deno.writeTextFile(STORAGE_PATH, "{}");
    }
}

/**
 * 加载所有任务到缓存
 */
async function loadTasks() {
    await ensureStorage();
    const data = await Deno.readTextFile(STORAGE_PATH);
    const all: Record<string, TaskBase> = JSON.parse(data);
    for (const [id, task] of Object.entries(all)) {
        cache.set(id, task);
    }
}

/**
 * 持久化缓存到文件，带重试和超时
 */
async function persistTasks() {
    await withRetry(() =>
        withTimeout(
            Deno.writeTextFile(STORAGE_PATH, JSON.stringify(cache.object, null, 2)),
            2000, // 2秒超时
        ),
    );
}

/**
 * 创建新任务
 */
export async function createTask(task: TaskBase): Promise<void> {
    cache.set(task.id, task);
    await persistTasks();
}

/**
 * 更新任务状态
 */
export async function updateTaskStatus(id: string, status: TaskStatus, result?: unknown, error?: string): Promise<void> {
    const task = cache.get(id);
    if (!task) throw new Error("Task not found");

    // 状态机校验：检查状态转换是否合法
    if (!isValidStateTransition(task.status, status)) {
        const errorMsg = `非法状态转换: ${task.status} -> ${status}`;
        console.warn(`⚠️ 任务 ${id}: ${errorMsg}`);
        // 这里可以选择抛出异常或记录警告，根据业务需要决定
        // throw new Error(errorMsg);
    }

    task.status = status;
    task.updatedAt = new Date().toISOString();
    if (result !== undefined) task.result = result as DownloadResult | undefined;
    if (error !== undefined) task.error = error;
    cache.set(id, task);
    await persistTasks();
}

/**
 * 查询任务
 */
export function getTask(id: string): TaskBase | undefined {
    return cache.get(id);
}

/**
 * 查询所有任务
 */
export function getAllTasks(): TaskBase[] {
    return cache.values;
}

/**
 * 按状态查询任务
 */
export function getTasksByStatus(status: TaskStatus): TaskBase[] {
    return cache.values.filter(task => task.status === status);
}

/**
 * 更新任务进程 ID
 */
export async function updateTaskProcessId(id: string, processId?: number): Promise<void> {
    const task = cache.get(id);
    if (!task) throw new Error("Task not found");
    task.processId = processId;
    task.updatedAt = new Date().toISOString();
    cache.set(id, task);
    await persistTasks();
}

// 初始化时加载
await loadTasks();
