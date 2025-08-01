module.exports = {
    apps: [
        {
            name: "worker-dlp",
            script: "./worker-dlp-linux-x64", // 根据你的目标平台调整
            cwd: "./release/worker-dlp", // 部署路径

            // 环境变量配置
            env: {
                NODE_ENV: "production",
                PORT: 8000,
            },

            // 从 .env 文件加载环境变量
            env_file: ".env",

            // 进程管理配置
            instances: 1, // 单实例模式，因为是 Deno 二进制文件
            exec_mode: "fork", // 使用 fork 模式而不是 cluster

            // 自动重启配置
            autorestart: true,
            watch: false, // 对于生产环境建议关闭文件监控
            max_memory_restart: "1G", // 内存限制重启

            // 重启策略
            restart_delay: 4000, // 重启延迟 4 秒
            max_restarts: 10, // 最大重启次数
            min_uptime: "10s", // 最小运行时间

            // 日志配置
            log_file: "./logs/worker-dlp.log",
            out_file: "./logs/worker-dlp-out.log",
            error_file: "./logs/worker-dlp-error.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            merge_logs: true,

            // 进程时间配置
            time: true,

            // 高级配置
            kill_timeout: 5000, // 强制杀死进程的超时时间
            listen_timeout: 3000, // 监听超时

            // 健康检查（需要在应用中实现对应的端点）
            health_check_url: "http://localhost:8000/health",
            health_check_grace_period: 3000,
        },

        // 开发环境配置
        {
            name: "dlp-dev",
            script: "deno",
            args: "task dev",
            cwd: "./",

            env: {
                NODE_ENV: "development",
                DENO_LOG: "wran",
                PORT: 8000,
            },

            env_file: ".env.local",

            instances: 1,
            // exec_mode: "fork",
            watch: true, // 开发环境启用文件监控
            watch_delay: 1000,
            ignore_watch: [
                "node_modules",
                "logs",
                "dist",
                "*.log",
                ".git",
            ],

            autorestart: true,
            max_memory_restart: "200M",

            log_file: "./logs/worker-dlp-dev.log",
            out_file: "./logs/worker-dlp-dev-out.log",
            error_file: "./logs/worker-dlp-dev-error.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
        },
    ],

    // 部署配置
    deploy: {
        production: {
            user: "deploy",
            host: ["your-server.com"],
            ref: "origin/main",
            repo: "git@github.com:your-username/worker-dlp.git",
            path: "./release/worker-dlp",
            "post-deploy":
                "chmod +x build.sh && ./build.sh && pm2 reload ecosystem.config.js --env production",
            "pre-setup": "mkdir -p ./release/worker-dlp/logs",
        },
    },
};
