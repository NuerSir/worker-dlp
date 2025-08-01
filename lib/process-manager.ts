/**
 * 进程管理模块
 * 负责管理正在运行的任务进程，支持优雅退出和异常恢复
 */

import { getTasksByStatus, updateTaskStatus } from "./storage.ts";
import { TaskStatus } from "../types/mcp.ts";

/**
 * 终止指定进程
 */
export async function killProcess(pid: number): Promise<boolean> {
    try {
        // 在不同平台上终止进程
        if (Deno.build.os === "windows") {
            const command = new Deno.Command("taskkill", {
                args: ["/F", "/PID", pid.toString()],
                stdout: "null",
                stderr: "null",
            });
            const { success } = await command.output();
            return success;
        } else {
            // Unix-like systems (Linux, macOS)
            const command = new Deno.Command("kill", {
                args: ["-9", pid.toString()],
                stdout: "null", 
                stderr: "null",
            });
            const { success } = await command.output();
            return success;
        }
    } catch (error) {
        console.error(`❌ 终止进程 ${pid} 失败:`, error);
        return false;
    }
}

/**
 * 检查进程是否还在运行
 */
export async function isProcessRunning(pid: number): Promise<boolean> {
    try {
        if (Deno.build.os === "windows") {
            const command = new Deno.Command("tasklist", {
                args: ["/FI", `PID eq ${pid}`, "/FO", "CSV"],
                stdout: "piped",
                stderr: "null",
            });
            const { success, stdout } = await command.output();
            if (!success) return false;
            const output = new TextDecoder().decode(stdout);
            return output.includes(pid.toString());
        } else {
            // Unix-like systems
            const command = new Deno.Command("ps", {
                args: ["-p", pid.toString()],
                stdout: "null",
                stderr: "null",
            });
            const { success } = await command.output();
            return success;
        }
    } catch {
        return false;
    }
}

/**
 * 清理所有正在运行的任务进程
 * 在服务退出时调用
 */
export async function cleanupAllRunningProcesses(): Promise<void> {
    console.log("🧹 开始清理所有正在运行的进程...");
    
    const runningTasks = getTasksByStatus(TaskStatus.RUNNING);
    const cleanupPromises = runningTasks.map(async (task) => {
        if (task.processId) {
            console.log(`🛑 终止任务 ${task.id} 的进程 ${task.processId}`);
            const killed = await killProcess(task.processId);
            if (killed) {
                console.log(`✅ 成功终止进程 ${task.processId}`);
            } else {
                console.log(`⚠️ 无法终止进程 ${task.processId}，可能已经退出`);
            }
            
            // 更新任务状态为失败
            try {
                await updateTaskStatus(task.id, TaskStatus.FAILED, undefined, "服务退出时被终止");
            } catch (error) {
                console.error(`❌ 更新任务 ${task.id} 状态失败:`, error);
            }
        }
    });
    
    await Promise.all(cleanupPromises);
    console.log("✅ 进程清理完成");
}

/**
 * 修复启动时的孤儿任务
 * 检查所有 running 状态的任务，如果对应进程已不存在，标记为失败
 */
export async function fixOrphanedTasks(): Promise<void> {
    console.log("🔍 检查孤儿任务...");
    
    const runningTasks = getTasksByStatus(TaskStatus.RUNNING);
    const fixPromises = runningTasks.map(async (task) => {
        if (task.processId) {
            const isRunning = await isProcessRunning(task.processId);
            if (!isRunning) {
                console.log(`🧹 发现孤儿任务 ${task.id}，进程 ${task.processId} 已不存在`);
                try {
                    await updateTaskStatus(task.id, TaskStatus.FAILED, undefined, "进程异常退出，重启时发现");
                } catch (error) {
                    console.error(`❌ 修复孤儿任务 ${task.id} 失败:`, error);
                }
            }
        } else {
            // 没有进程ID的running任务也标记为失败
            console.log(`🧹 发现无进程ID的running任务 ${task.id}`);
            try {
                await updateTaskStatus(task.id, TaskStatus.FAILED, undefined, "缺少进程ID，可能异常退出");
            } catch (error) {
                console.error(`❌ 修复任务 ${task.id} 失败:`, error);
            }
        }
    });
    
    await Promise.all(fixPromises);
    console.log("✅ 孤儿任务检查完成");
}

/**
 * 手动终止指定任务
 */
export async function stopTask(taskId: string): Promise<boolean> {
    const { getTask, updateTaskStatus } = await import("./storage.ts");
    const task = getTask(taskId);
    
    if (!task) {
        console.error(`❌ 任务 ${taskId} 不存在`);
        return false;
    }
    
    if (task.status !== TaskStatus.RUNNING) {
        console.log(`⚠️ 任务 ${taskId} 当前状态为 ${task.status}，无需终止`);
        return false;
    }
    
    if (task.processId) {
        console.log(`🛑 手动终止任务 ${taskId} 的进程 ${task.processId}`);
        const killed = await killProcess(task.processId);
        if (killed) {
            await updateTaskStatus(taskId, TaskStatus.CANCELLED, undefined, "手动终止");
            console.log(`✅ 成功终止任务 ${taskId}`);
            return true;
        } else {
            console.error(`❌ 无法终止任务 ${taskId} 的进程 ${task.processId}`);
            return false;
        }
    } else {
        // 没有进程ID，直接更新状态
        await updateTaskStatus(taskId, TaskStatus.CANCELLED, undefined, "手动终止（无进程ID）");
        console.log(`✅ 任务 ${taskId} 已标记为取消`);
        return true;
    }
}
