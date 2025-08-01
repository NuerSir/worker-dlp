import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import { ApiErrorCode } from "../types/api.ts";
import { getTask, getTasksByStatus, getAllTasks } from "../lib/storage.ts";
import { TaskStatus } from "../types/mcp.ts";

export const name = "get_task_status";
export const tool: MCPTool = {
    name,
    description: "查询任务状态。可以查询单个任务详情，或按状态批量查询任务列表。",
    inputSchema: {
        type: "object",
        properties: {
            taskId: {
                type: "string",
                description: "要查询的任务ID（可选，如果不提供则查询所有任务）",
            },
            status: {
                type: "string",
                enum: ["pending", "running", "success", "failed", "cancelled"],
                description: "按状态过滤任务（可选）",
            },
            limit: {
                type: "number",
                description: "返回任务数量限制（可选，默认10）",
                default: 10,
            },
        },
    },
};

const handler: MCPToolHandler["handler"] = (args: Record<string, unknown>): Promise<MCPToolResult> => {
    const { taskId, status, limit = 10 } = args;

    try {
        // 查询单个任务
        if (taskId && typeof taskId === "string") {
            const task = getTask(taskId);
            
            if (!task) {
                return Promise.resolve({
                    code: ApiErrorCode.NOT_FOUND,
                    msg: "任务不存在",
                    data: { taskId }
                });
            }

            return Promise.resolve({
                code: ApiErrorCode.OK,
                msg: "查询成功",
                data: { task }
            });
        }

        // 批量查询任务
        let tasks;
        if (status && typeof status === "string") {
            // 按状态查询
            tasks = getTasksByStatus(status as TaskStatus);
        } else {
            // 查询所有任务
            tasks = getAllTasks();
        }

        // 应用数量限制
        const limitNum = typeof limit === "number" ? Math.max(1, Math.min(100, limit)) : 10;
        const limitedTasks = tasks.slice(0, limitNum);

        return Promise.resolve({
            code: ApiErrorCode.OK,
            msg: `查询成功，共找到 ${tasks.length} 个任务${limitedTasks.length < tasks.length ? `，返回前 ${limitedTasks.length} 个` : ""}`,
            data: {
                tasks: limitedTasks,
                total: tasks.length,
                filtered: status ? { status } : undefined,
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        return Promise.resolve({
            code: ApiErrorCode.INTERNAL_ERROR,
            msg: `查询任务状态失败: ${errorMessage}`,
            data: { error: errorMessage }
        });
    }
};

export default { name, tool, handler };
