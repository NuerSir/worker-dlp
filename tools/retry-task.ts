import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import { ApiErrorCode } from "../types/api.ts";
import { getTask, updateTaskStatus } from "../lib/storage.ts";
import { TaskStatus } from "../types/mcp.ts";

export const name = "retry_task";
export const tool: MCPTool = {
    name,
    description: "重试失败或取消的任务。将任务状态重置为pending，重新开始执行。",
    inputSchema: {
        type: "object",
        properties: {
            taskId: {
                type: "string", 
                description: "要重试的任务ID",
            },
        },
        required: ["taskId"],
    },
};

const handler: MCPToolHandler["handler"] = async (args: Record<string, unknown>): Promise<MCPToolResult> => {
    const { taskId } = args;

    if (!taskId || typeof taskId !== "string") {
        return { code: ApiErrorCode.INVALID_PARAM, msg: "taskId 参数是必需的" };
    }

    try {
        const task = getTask(taskId);
        
        if (!task) {
            return {
                code: ApiErrorCode.NOT_FOUND,
                msg: "任务不存在",
                data: { taskId }
            };
        }

        // 只有失败或取消的任务才能重试
        if (task.status !== TaskStatus.FAILED && task.status !== TaskStatus.CANCELLED) {
            return {
                code: ApiErrorCode.INVALID_PARAM,
                msg: `任务状态为 ${task.status}，只有失败或取消的任务才能重试`,
                data: { taskId, currentStatus: task.status }
            };
        }

        // 重置任务状态为pending，清除错误信息
        await updateTaskStatus(taskId, TaskStatus.PENDING, undefined, undefined);
        
        // 重新触发任务执行
        const { recoverUnfinishedTasks } = await import("../lib/download-task.ts");
        recoverUnfinishedTasks();

        return {
            code: ApiErrorCode.OK,
            msg: "任务已重新开始",
            data: { taskId, status: "pending" }
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        return {
            code: ApiErrorCode.INTERNAL_ERROR,
            msg: `重试任务失败: ${errorMessage}`,
            data: { taskId, error: errorMessage }
        };
    }
};

export default { name, tool, handler };
