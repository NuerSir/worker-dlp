# Copilot Instructions for `worker-dlp`


## Project Overview
- This is an MCP (Model Context Protocol) server for video/audio download and info extraction, built on Deno and designed for Supabase Edge Functions.
- Main entry: `index.ts` (server startup and routing)
- Core logic: `lib/` (yt-dlp executor, storage, MCP server)
- Tools: `tools/` (each file = one tool, e.g., `download-video.ts`, `get-formats.ts`)
- Types: `types/mcp.ts` (shared type definitions)

## Key Product Goals (from requirements.md)
- Provide an MCP server wrapping yt-dlp, enabling LLM clients to download/extract video/audio via dialogue.
- Support async download with task ID/status/result query.
- Compatible with Supabase Edge Functions cloud deployment.

## Key Constraints
- Prefer Deno ecosystem; avoid Node.js/npm unless absolutely necessary.
- All config via environment variables (see config.ts, .env.example).
- Task state/results must be persistent and recoverable after restart.
- API and code must be well-documented and developer-friendly.

## Development Process (Recommended)
- Before starting a new feature or fix, check docs/requirements.md, docs/design.md, docs/tasks.md for context and acceptance criteria.
- Use Copilot chat to reference or paste relevant requirements/design/tasks for best code suggestions.
- Keep copilot-instructions.md concise; detailed requirements/design/tasks should remain in docs/.
- After each change, update docs/ and instructions as needed to keep project knowledge in sync.

## How to Use Copilot Effectively
- Use Copilot chat to ask for code, refactoring, or design advice, referencing docs/ as needed.
- For complex features, paste the relevant task/requirement/design section into the chat for best results.
- Do not copy all of docs/requirements.md or design.md into copilot-instructions.md; instead, keep this file focused on conventions, structure, and key goals.
- When in doubt, clarify context in chat for more accurate Copilot output.



## Configuration
- All configuration is managed via environment variables, loaded in `config.ts`.
- You can use `.env.local` (or `.env`) for local development; see `.env.example` for all supported variables and usage.
- For Supabase cloud, set secrets with `supabase secrets set` (see `README.md`).
- For private/self-hosted, set environment variables in your process manager, shell, or via `.env` files before starting the service (see `config.ts` and `.env.example`).

## Key Patterns & Conventions
- **Tool Registration:** All tools are registered in `tools/registry.ts` and exposed via MCP JSON-RPC.
- **Tool Implementation:** Each tool is a separate file in `tools/`, exporting a function with a clear input/output contract.
- **Dependency Management:** All imports are centralized in `deps.ts`.
- **No Node.js:** This is a Deno project—do not use Node.js APIs or npm packages.
- **Supabase Integration:** For deployment, use Supabase Edge Functions.

## Developer Workflows
- **Local Dev:** `deno task dev` (starts server at http://localhost:8000)
- **Type Check:** `deno task check`
- **Lint/Format:** `deno task lint`, `deno task fmt`
- **Cloud Deploy (Supabase):** `deno task supabase:deploy` (deploys to Supabase Edge Functions; requires Supabase CLI, which is mainly for Supabase cloud)
- **Cloud Logs (Supabase):** `deno task supabase:logs` (view logs for Supabase cloud deployment)
- **Private/Self-Hosted Deploy:** Use `deno run -A index.ts` or a custom Deno deploy script. Set environment variables as needed (see `config.ts`).
- **Private Logs:** Use your own process manager (e.g., systemd, pm2, Docker logs) to manage and view logs for self-hosted deployments.

## Data Flow
- HTTP requests → `index.ts` → tool dispatch via MCP server (`lib/mcp-server.ts`) → tool logic in `tools/` → yt-dlp execution/storage as needed
- All tool calls are JSON-RPC over HTTP (see README for examples)

## Integration Points
- **yt-dlp:** All download/extract actions are wrappers around yt-dlp, invoked via `lib/executor.ts`.
- **Supabase:** For deployment and secrets management.

## Examples
- To add a new tool: create `tools/my-tool.ts`, export a function, register in `tools/registry.ts`.
- To update types: edit `types/mcp.ts` and update imports as needed.

## References
- See `README.md` for full dev commands, API usage, and architecture diagram.
- Key files: `index.ts`, `lib/mcp-server.ts`, `tools/registry.ts`, `lib/executor.ts`, `types/mcp.ts`

---

**Keep instructions concise and up-to-date. If project structure changes, update this file.**
