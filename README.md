# GLMX

GLMX is a desktop coding-agent app powered by ZAI/GLM providers, with local workspace flow, chat + tools, git-aware changes, and review-ready outputs.

GLMX là ứng dụng coding-agent desktop dùng ZAI/GLM, hỗ trợ workflow local workspace, chat + tool, thay đổi code theo git, và đầu ra sẵn sàng để review.

## Screenshots / Ảnh giao diện

### Main UI
![GLMX Main UI](assets/cursor-ui.gif)

### Plan Mode
![GLMX Plan Mode](assets/plan-mode.gif)

### Worktree Flow
![GLMX Worktree Flow](assets/worktree.gif)

## Features / Tính năng

- Local repository selection and workspace-aware chats
- Multi-pane agent UI (chat, changes, terminal, details)
- Diff preview + apply/review workflow
- Git branch and commit helpers
- MCP server integration
- Provider model mapping (Heavy / Standard / Fast)

- Chọn repo local và chat theo workspace
- Giao diện đa panel (chat, changes, terminal, details)
- Xem diff + luồng apply/review
- Hỗ trợ git branch và commit
- Tích hợp MCP server
- Mapping model theo slot (Heavy / Standard / Fast)

## Configuration / Cấu hình

GLMX stores provider config locally and routes model calls through configured providers.

GLMX lưu cấu hình provider cục bộ và route model call theo provider đã chọn.

Common settings:

- Base URL: `https://api.z.ai/api/anthropic` (for ZAI-compatible Anthropic route)
- Model slots:
  - Heavy: complex tasks
  - Standard: general coding tasks
  - Fast: lightweight/quick tasks

## First Run / Khởi động lần đầu

1. Open GLMX / Mở GLMX
2. Add API key in onboarding or Settings / Nhập API key ở onboarding hoặc Settings
3. Select local folder / Chọn thư mục local
4. Start a new thread and run tasks / Tạo thread mới và chạy task

## Development

### Prerequisites

- Bun
- Node.js
- Build tools for Electron native modules (macOS/Linux/Windows)

### Install

```bash
bun install
bun run claude:download
bun run codex:download
```

### Run (Dev)

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Package

```bash
bun run package:mac
bun run package:win
bun run package:linux
```

## Important Paths / File quan trọng

- `src/main/lib/zai-config.ts` — config read/write + provider env
- `src/main/lib/trpc/routers/zai.ts` — provider config procedures
- `src/main/lib/trpc/routers/claude.ts` — agent runtime path
- `src/main/lib/trpc/routers/codex.ts` — OpenAI-compatible runtime path
- `src/renderer/App.tsx` — app bootstrap + routing
- `src/renderer/features/onboarding/*` — first-run onboarding

## Notes / Ghi chú

- This project is intended for local desktop usage.
- Upstream hosted/cloud-only flows are reduced or removed in this fork.
- Runtime binaries are downloaded via setup scripts.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
