import type { MCPTool, MCPToolHandler, MCPToolResult } from "../types/mcp.ts";
import { ApiErrorCode } from "../types/api.ts";
import { stopTask } from "../lib/process-manager.ts";

export const name = "stop_task";
export const tool: MCPTool = {
    name,
    description: "手动终止正在运行的任务。支持终止下载任务的进程，并将任务状态标记为取消。",
    inputSchema: {
        type: "object",
        properties: {
            taskId: {
                type: "string",
                description: "要终止的任务ID",
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
        const success = await stopTask(taskId);
        
        if (success) {
            return {
                code: ApiErrorCode.OK,
                msg: "任务已成功终止",
                data: { taskId, status: "cancelled" }
            };
        } else {
            return {
                code: ApiErrorCode.NOT_FOUND,
                msg: "任务终止失败，可能任务不存在或已经完成",
                data: { taskId }
            };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        return {
            code: ApiErrorCode.INTERNAL_ERROR,
            msg: `终止任务失败: ${errorMessage}`,
            data: { taskId, error: errorMessage }
        };
    }
};

export default { name, tool, handler };
