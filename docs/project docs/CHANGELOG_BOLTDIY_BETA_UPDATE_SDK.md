# Branch Change Report — BOLTDIY_BETA_UPDATE_SDK vs main

This document summarizes all noteworthy changes on branch `BOLTDIY_BETA_UPDATE_SDK` relative to `main`.

If you need an exhaustive, machine-readable diff (per-file additions/deletions table), let me know and I’ll append it.

---

## Scope & Stats

- Compare range: `main..BOLTDIY_BETA_UPDATE_SDK`
- Merge base: `bab9a64ab6bca5b39c75f6e18f01a13307700994`
- Summary: 343 files changed; 33,023 insertions; 13,330 deletions
- Uncommitted changes at time of report: none

---

## High‑Level Highlights

- SDK 5 migration and broad beta update for BOLTDIY
- Major UI/UX reorganizations for Settings → Providers and Service Integrations
- Dedicated tabs and flows for GitHub, GitLab, Vercel, Netlify, and Supabase (with API routes and UI)
- Local providers area redesigned with health checks, guidance, and removal of Service Status module
- LLM provider matrix expanded and hardened; stream stability, context scoring, and patch-based edit safeguards
- “Why selected” reasons surfaced for context files; Debug panel shows reasoning
- Build error summarization to improve “Ask Bolt” flow during failed builds
- Extensive CI/quality/security workflow enhancements and utility scripts
- Debug logging system added (capture and download)
- Sentry wiring (components and utilities)
- Docs updates (index/FAQ/CONTRIBUTING) and README improvements

---

## Notable Features and Changes by Area

### Settings: Service Integrations (GitHub/GitLab/Vercel/Netlify/Supabase)

- Added dedicated tabs and components:
  - GitHub: GitHubTab + auth, repo selection, stats, caching, user profile, and state indicators
  - GitLab: GitLabTab + auth, repo selection, project list, and stats display
  - Vercel: VercelTab + VercelConnection moved/modernized
  - Netlify: NetlifyTab + NetlifyConnection moved/modernized
  - Supabase: SupabaseTab with deep UI and API integration
- New API routes:
  - GitHub: `api.github-user`, `api.github-branches`, `api.github-stats`
  - GitLab: `api.gitlab-projects`, `api.gitlab-branches`
  - Vercel: `api.vercel-user`
  - Netlify: `api.netlify-user`
  - Supabase: `api.supabase-user`
- Shared settings UI scaffolding for service integration forms, loading/error states, and headers
- New connection helpers/hooks: `useGitHubConnection`, `useGitHubStats`, `useGitLabConnection`, and related API hooks

Why this matters: clearer, dedicated workflows by service, better performance with progressive loading, and improved state/error visibility.

### Providers: Local Providers Redesign

- New local providers components: ErrorBoundary, HealthStatusBadge, LoadingSkeleton, ModelCard, ProviderCard, SetupGuide, StatusDashboard, and types
- LocalProvidersTab massively reworked for clarity, health-checks, and guidance
- Removed Service Status module and all individual provider “status” submodules
- Consistent status/health UI patterns aligned with overall app styling

Why this matters: simplified, more reliable local provider experience, removal of mocked status patterns, and better setup guidance.

### Chat/LLM & Runtime

- Stream stability and recovery: `stream-recovery.ts` added; refined `stream-text` and `select-context`
- Context selection improvements with score and reasons; surfaced in LLMDebugPanel and streaming route
- Large-overwrite guard: blocks unsafe non-diff overwrites; requires unified diffs for protected files (package.json, lockfiles, .env)
- Enhanced message parsing: `enhanced-message-parser` introduced; improved artifacts wrapping and streaming safety
- Expanded LLM providers: new `cerebras`, `cloudflare-workers-ai`, `deepinfra`, `fireworks`, `moonshot`; updates to Anthropic, OpenAI(-like), Google, OpenRouter, Mistral, and more
- Prompts and modes: discuss/build prompts improved and consolidated; explicit build-mode signaling in discuss mode

Why this matters: more stable streaming, safer edits, clearer reasoning visibility, and broader provider support.

### Deployment UX

- New dialogs and clients for GitHub and GitLab deployments
- Enhanced DeployButton/DeployAlert UX
- Netlify/Vercel wiring improvements
- GitHub “Ask Bolt” build error summarization integrated

Why this matters: faster, safer deployment flows with clearer call-to-actions and error handling.

### Build Error Summarization

- `app/utils/buildErrorSummarizer.ts`:
  - Extracts key lines (TS codes, module-not-found, SyntaxError, etc.)
  - Produces concise summary + highlights; shown in DeployAlert and piped to “Ask Bolt”

Why this matters: reduces time to understand build failures and improves initial repair prompts.

### Debug Logging & Sentry

- Debug logging system:
  - `app/utils/debugLogger.ts` — capture and download logs; richer analysis
- Sentry:
  - `ui/SentryErrorBoundary.tsx`, `utils/sentry.ts`, `test-sentry.js`
  - Optional error boundary wrap for improved observability

Why this matters: better observability for both runtime and UI errors.

### Workbench/Editor

- Terminal improvements (Terminal, TerminalTabs, TerminalManager)
- Workbench client updates; small UX tweaks to DiffView, EditorPanel, Search, etc.
- `BranchSelector` component added

Why this matters: smoother dev ergonomics, faster troubleshooting, multi-terminal reliability.

---

## Significant Removals and Renames

- Removed
  - Service Status module and all provider-specific status submodules under `app/components/@settings/tabs/providers/service-status/*`
  - `app/components/@settings/tabs/providers/status/ServiceStatusTab.tsx`
  - Legacy GitHub connection flow under `@settings/tabs/connections/*`
  - `app/components/@settings/tabs/providers/local/OllamaModelInstaller.tsx`
  - `app/components/@settings/shared/components/DraggableTabList.tsx`
  - `app/utils/cn.ts`, `app/utils/types.ts`
  - `.eslintrc.json` (consolidation to other lint config)
- Renamed/moved
  - `NetlifyConnection.tsx` moved from `connections` to `netlify/components`
  - `VercelConnection.tsx` moved from `connections` to `vercel/components`

Why this matters: removal of legacy/mocked status patterns and consolidation toward the new tabs architecture; clarifies codebase boundaries.

---

## API Routes Added/Changed (selection)

- New
  - `api.git-info`
  - GitHub: `api.github-user`, `api.github-branches`, `api.github-stats`
  - GitLab: `api.gitlab-projects`, `api.gitlab-branches`
  - Vercel: `api.vercel-user`
  - Netlify: `api.netlify-user`
  - Supabase: `api.supabase-user`
  - `api.bug-report`
- Modified
  - `api.chat`, `api.llmcall`, `api.enhancer`, `api.github-template`, `api.netlify-deploy`, `api.vercel-deploy`, and several `api.system.*`

---

## CI/Quality/Security/Docs

- Workflows added:
  - `.github/workflows/preview.yaml`
  - `.github/workflows/quality.yaml`
  - `.github/workflows/security.yaml`
  - `.github/workflows/test-workflows.yaml`
- Workflow improvements:
  - `.github/workflows/ci.yaml`, `.github/workflows/docker.yaml`, `.github/workflows/pr-release-validation.yaml`, `.github/workflows/update-stable.yml`, `.github/workflows/electron.yml`
- Scripts:
  - `test-workflows.sh`, `scripts/setup-env.sh`
- Docs:
  - `README.md` significantly updated
  - `docs/docs/index.md` and `docs/docs/FAQ.md` expanded
  - `docs/docs/CONTRIBUTING.md` updated
- Configs:
  - `.depcheckrc.json`, `.lighthouserc.json`, `.mcp.json` added
  - `.env.example` and `.env.production` adjusted to match new integrations

---

## Dependencies

- `package.json` updated (adds/removes/updates)
- `pnpm-lock.yaml` large updates (≈3.6k insertions; ≈3.2k deletions)
- Playwright preview config added (`playwright.config.preview.ts`)

Note: For a human-readable dependency delta, request an extracted dependency diff.

---

## Full Commit Log (main..BOLTDIY_BETA_UPDATE_SDK)

- 8e4246d — 2025-09-11 — Stijnus — chore: upload local changes — phases 1–4 (stream stability, context scoring, patch-based edits, debug panel)
- 613f2fe — 2025-09-11 — Stijnus — feat(llm): Phase 3.2 large-overwrite guard + Phase 4.1 "Why selected" reasons
- df538e2 — 2025-09-10 — Stijnus — lint: convert consecutive line comments to block comment in Artifact filter
- cd31af3 — 2025-09-10 — Stijnus — deploy: summarize npm run build errors and pipe highlights to LLM via 'Ask Bolt'
- 0f54845 — 2025-09-10 — Stijnus — discuss mode: ensure 'Implement' approvals actually build by sending chatMode=build explicitly
- b566e24 — 2025-09-10 — Stijnus — chat: stop flooding chat with file actions during project import + enable quick actions and parser-safe rendering
- c99a89f — 2025-09-10 — Stijnus — feat: comprehensive BOLTDIY beta update with SDK 5 migration and enhanced features
- 8ab75d9 — 2025-09-10 — Stijnus — fix: resolve SDK 5 LLM chat flow compatibility issues
- 4ca535b — 2025-09-08 — Stijnus — feat: comprehensive service integration refactor with enhanced tabs architecture (#1978)
- 2fde6f8 — 2025-09-07 — Keoma Wright — fix: implement stream recovery to prevent chat hanging (#1977)
- 2f6f28e — 2025-09-07 — Stijnus — feat: enhance message parser with advanced AI model support and performance optimizations (#1976)
- 36f1b9c — 2025-09-06 — Stijnus — feat: comprehensive debug logging system with capture and download
- 9e01e5c — 2025-09-07 — Stijnus — feat: add support for OPENAI_LIKE_API_MODELS
- 37217a5 — 2025-09-07 — Stijnus — Revert "fix: resolve chat conversation hanging and stream interruption issues (#1971)"
- e68593f — 2025-09-06 — Keoma Wright — fix: resolve chat conversation hanging and stream interruption issues (#1971)
- a44de8a — 2025-09-06 — Stijnus — feat:  local providers refactor & enhancement (#1968)
- 3ea9650 — 2025-09-05 — Stijnus — feat: gitLab Integration Implementation / github refactor / overal improvements (#1963)
- 8a68560 — 2025-09-05 — Chris Ijoyah — fix: support cloning non-default branches by parsing branch from URL (#1956)
- 871f176 — 2025-09-05 — Stijnus — style: remove extra blank line in AvatarDropdown component
- 6c7170f — 2025-09-05 — Stijnus — feat: remove Service Status from avatar dropdown
- 177bcfb — 2025-09-05 — Stijnus — feat: add Help & Documentation to avatar dropdown menu
- e3169c3 — 2025-09-05 — Stijnus — feat: move help icon from bottom to header area for better discoverability
- 23c0a8a — 2025-09-05 — Stijnus — docs: update index.md and FAQ.md documentation
- a06161a — 2025-09-05 — Stijnus — docs: fix table of contents to match updated section names
- 118e687 — 2025-09-05 — Stijnus — docs: merge updated README from BOLTDIY_documentation branch
- 5517f7d — 2025-09-05 — Stijnus — feat: move export/sync buttons to workbench and standardize styling
- a71e08a — 2025-09-03 — Stijnus — fix: add id-token write permission to Docker workflow
- 8609972 — 2025-08-31 — Stijnus — Update Menu.client.tsx
- a6c4d37 — 2025-08-31 — Stijnus — docs: add help icon feature documentation
- 61e5cbd — 2025-08-31 — Stijnus — feat: add help icon to sidebar linking to documentation
- ad4a31a — 2025-08-31 — Stijnus — feat: comprehensive documentation updates for latest features
- df242a7 — 2025-08-31 — Stijnus — feat: add Moonshot AI (Kimi) provider and update xAI Grok models (#1953)
- 4e214dc — 2025-08-31 — Stijnus — update export and report bug button
- 7072600 — 2025-08-31 — Stijnus — feat: Redesign bug reporting and header actions
- 8c34f72 — 2025-08-31 — Stijnus — fix: docker workflow security upload (#1951)
- b88eb6e — 2025-08-31 — Stijnus — Fix security workflow to generate reports locally instead of uploading to GitHub Security (#1950)
- 9ab4880 — 2025-08-31 — Stijnus — feat: comprehensive GitHub workflow improvements with security & quality enhancements (#1940)
- fa7eeaf — 2025-08-30 — Keoma Wright — fix: resolve terminal unresponsiveness and improve reliability (#1743) (#1926)
- f65a688 — 2025-08-30 — Stijnus — Fix GitHub template authentication issue
- ff8b0d7 — 2025-08-29 — Stijnus — fix: maxCompletionTokens Implementation for All Providers (#1938)
- 38c1349 — 2025-08-29 — Stijnus — Update LLM providers and constants (#1937)
- b5d9055 — 2025-08-29 — Stijnus — 🔧 Fix Token Limits & Invalid JSON Response Errors (#1934)
- 10ac0eb — 2025-08-29 — Stijnus — fix: final formatting and code quality improvements
- 194e0d7 — 2025-08-29 — Chris Ijoyah — feat: add GitHub deployment functionality (#1904)
- 8168b9b — 2025-08-29 — Stijnus — fix: additional linting fixes for GitHub deployment components
- 8ecb780 — 2025-08-29 — Stijnus — refactor: remove redundant GitHub sync functionality
- 1d26dea — 2025-08-25 — Keoma Wright — fix: resolve code output to chat instead of files (#1797)
- 39d0775 — 2025-08-24 — Keoma Wright — fix: auto-detect and convert code blocks to artifacts when missing tags
- 56e602b — 2025-08-24 — Keoma Wright — fix: resolve .env.local not loading in docker compose
- fdbf9ff — 2025-08-12 — Chris Ijoyah — feat: add GitHub deployment functionality
- 2ce58ef — 2025-07-25 — xKevIsDev — refactor: update styling and structure in ToolInvocations and ToolCallsList components
- 4c65316 — 2025-05-13 — jawshoeadan — Update README.md

---

## Reproducing This Report Locally

- Commit log

```bash
git log --no-merges --pretty=format:'%h %ad %an %s' --date=short main..HEAD
```

- Diff stats

```bash
git diff --stat -C -M main..HEAD
```

- Per-file additions/deletions

```bash
git diff --numstat -C -M main..HEAD
```

