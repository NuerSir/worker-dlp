#!/bi# 检查依赖和配置
echo "🔍 检查依赖文件..."
if ! deno check echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 下一步配置："
echo "   supabase secrets set WORKER_DLP_API_KEY=your-api-key"
echo "   supabase secrets set PROXY_URL=http://proxy:8080  # 可选"
echo "   supabase secrets set LOG_LEVEL=info              # 可选"
echo ""
echo "🔍 查看部署日志："
echo "   supabase functions logs worker-dlp --follow"
echo ""; then
    echo "❌ deps.ts 检查失败"
    exit 1
fi

echo "🔍 检查配置文件..."
if ! deno check config.ts; then
    echo "❌ config.ts 检查失败"
    exit 1
fi

echo "🔍 检查主文件..."
if ! deno check index.ts; then
    echo "❌ index.ts 检查失败"
    exit 1
fi

echo "🔍 检查所有模块..."
if ! deno check **/*.ts; then
    echo "❌ 模块检查失败"
    exit 1
fi

echo "🎨 代码格式化..."
deno fmt

echo "🔧 测试配置系统..."
if ! deno run --allow-env config.ts; then
    echo "⚠️ 配置测试失败，但继续部署..."
fi yt-dlp Worker MCP Server 部署脚本 (简化版)
echo "🚀 部署 yt-dlp Worker MCP 服务器..."

# 检查并格式化代码
echo "� 代码检查..."
if ! deno check index.ts; then
    echo "❌ TypeScript 检查失败"
    exit 1
fi

echo "🎨 代码格式化..."
deno fmt

# 部署到 Supabase
echo "☁️ 部署到 Supabase Edge Functions..."
if ! supabase functions deploy worker-dlp; then
    echo "❌ 部署失败"
    exit 1
fi

echo ""
echo "✅ 部署完成！"
echo ""
echo "� 下一步配置："
echo "   supabase secrets set WORKER_DLP_API_KEY=your-api-key"
echo "   supabase secrets set PROXY_URL=http://proxy:8080  # 可选"
echo ""
