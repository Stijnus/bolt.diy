# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `pnpm run dev` - Start development server (port 5173)
- `pnpm run build` - Build the project for production
- `pnpm run start` - Run production build locally using Wrangler Pages
- `pnpm run preview` - Build and preview production locally
- `pnpm test` - Run test suite using Vitest
- `pnpm run test:watch` - Run tests in watch mode

### Code Quality
- `pnpm run lint` - Run ESLint on app directory
- `pnpm run lint:fix` - Auto-fix linting issues and run Prettier
- `pnpm run typecheck` - Run TypeScript type checking

### Deployment
- `pnpm run deploy` - Deploy to Cloudflare Pages
- `pnpm run typegen` - Generate TypeScript types using Wrangler

### Docker Commands
- `pnpm run dockerbuild` - Build development Docker image
- `pnpm run dockerbuild:prod` - Build production Docker image
- `pnpm run dockerrun` - Run container from built image

### Electron (Desktop App)
- `pnpm electron:build:unpack` - Build unpacked Electron app
- `pnpm electron:build:mac/win/linux` - Build platform-specific distributables
- `pnpm electron:build:dist` - Build for all platforms (Mac, Windows, Linux)

## Application Architecture

### Technology Stack
- **Framework**: Remix (React-based full-stack framework)
- **Runtime**: Cloudflare Pages with WebContainers API
- **Styling**: UnoCSS + SCSS
- **State Management**: Nanostores for global state
- **Package Manager**: pnpm
- **AI Integration**: Vercel AI SDK with multiple LLM providers

### Core Directory Structure
```
app/
├── components/          # React components organized by feature
├── lib/
│   ├── .server/         # Server-side only code (LLM, API handlers)
│   ├── stores/          # Nanostores for global state
│   ├── runtime/         # WebContainer runtime utilities
│   └── modules/         # Feature modules (LLM, git, etc.)
├── routes/              # Remix route handlers (API + pages)
├── types/               # TypeScript type definitions
├── utils/               # Shared utilities
└── styles/              # Global styles and SCSS
```

### Key Architectural Patterns

#### LLM Integration (`app/lib/.server/llm/`)
- `stream-text.ts` - Core streaming text generation with provider abstraction
- `model-capability-service.ts` - Dynamic token limit management using 4-tier capability detection
- `constants.ts` - Model configurations and provider limits
- Supports 20+ providers: OpenAI, Anthropic, Ollama, xAI, Gemini, LMStudio, Mistral, DeepSeek, Groq, OpenRouter, etc.
- Provider-specific modules in `app/lib/modules/llm/providers/`
- Abstract `BaseProvider` class with dynamic model discovery and caching
- Special handling for reasoning models (o1, o3) with parameter filtering

#### WebContainer Runtime (`app/lib/runtime/`)
- Browser-based Node.js runtime for executing code in the browser
- File system operations and terminal integration
- `message-parser.ts` - Streaming parser for `<boltArtifact>` and `<boltAction>` tags
- `action-runner.ts` - Execution pipeline with abort capability
- Isolated execution environment for running generated applications
- Auto-artifact generation from code blocks when structured tags are missing

#### State Management (Nanostores)
- `workbench.ts` - File editor, terminal, and preview orchestration with store composition
- `chat.ts` - Minimal chat state (started, aborted, showChat)
- `theme.ts` - Theme switching and persistence
- `files.ts` - File system state with WebContainer integration
- `previews.ts` - Preview window management
- `settings.ts` - Multi-layered configuration: provider settings, feature flags, shortcuts
- Additional stores: `mcp.ts`, `logs.ts`, `terminal.ts`, etc.
- Reactive atoms and maps with localStorage persistence

#### Route Structure
- `app/routes/api.chat.ts` - Main chat endpoint with streaming, context optimization, MCP integration
- `app/routes/api.models.ts` - Dynamic model list with provider-specific fetching
- `app/routes/api.*.ts` - Specialized endpoints (GitHub, Netlify, Supabase integration)
- `app/routes/_index.tsx` - Main application interface with client-only hydration
- WebContainer preview system integrated into workbench

#### Component Architecture
- Feature-based organization in `app/components/`
- UI components in `app/components/ui/` with consistent styling patterns
- Chat components handle AI interactions and tool invocations
- Workbench components manage code editing, preview, and file management
- Settings components provide provider and configuration management

## Development Guidelines

### Environment Setup
1. Copy `.env.example` to `.env.local` and configure API keys
2. Use Chrome Canary for local development (Chrome 129 compatibility issue)
3. Node.js >=18.18.0 required

### Code Style
- Uses Blitz ESLint config with custom rules
- Relative imports (`../`) not allowed - use `~/` for app directory imports
- Semi-colons required, Unix line endings enforced
- TypeScript strict mode enabled

### Key Configuration Files
- `vite.config.ts` - Vite configuration with Remix, UnoCSS, polyfills
- `tsconfig.json` - TypeScript configuration with path mapping
- `eslint.config.mjs` - ESLint rules and import restrictions
- `uno.config.ts` - UnoCSS configuration for utility-first styling

### Testing
- Vitest for unit testing
- Manual testing workflow for AI functionality
- Preview tests excluded from standard test runs
- Single test commands: `pnpm test -- <test-file>` or `pnpm test -- --testNamePattern="<pattern>"`

### AI Provider Integration
- Model configurations in `app/lib/.server/llm/constants.ts`
- Provider-specific settings and base URLs configurable via settings UI
- Dynamic token limit management through `ModelCapabilityService` with 4-tier detection
- Streaming responses with WebContainer execution integration
- Prompt library system for different use cases (`app/lib/common/prompts/`)
- Support for reasoning models (o1, o3) with parameter filtering and special handling
- Context optimization: AI-powered file selection and chat summarization
- Model-specific optimizations for Kimi, Grok Code Fast, etc.

### UI and Styling
- Global CSS variables for theming in `app/styles/variables.scss`
- UnoCSS utility classes with custom theme integration
- Consistent icon button styling with `.icon-button` class
- Dark/light theme support with CSS variable-based theming
- Component-specific SCSS in `app/styles/components/`

## Important Notes

### WebContainer Licensing
- Commercial usage requires WebContainers API license
- Free for prototypes and non-commercial use

### Browser Compatibility
- Chrome 129 has known issues with Vite dev server
- Use Chrome Canary for local development
- Production builds work fine in all browsers

### File Watching and Hot Reload
- Uses Vite's HMR for React components
- WebContainer file changes trigger preview updates
- Terminal output streams in real-time

### Deployment Targets
- Primary: Cloudflare Pages
- Also supports: Netlify, Docker, Electron desktop app

### Key Features
- Multi-provider LLM support with UI-based API key management
- Browser-based Node.js runtime via WebContainers
- Integrated terminal for command execution
- File diff view for tracking changes
- GitHub/Netlify deployment integration
- Image attachment support for prompts
- Voice prompting capabilities
- Chat history backup/restore
- Project import from GitHub repositories
- ZIP download of generated projects

## Advanced Development Patterns

### LLM Provider Implementation
To add a new LLM provider:
1. Extend `BaseProvider` in `app/lib/modules/llm/base-provider.ts`
2. Implement required abstract methods (`name`, `staticModels`, `config`)
3. Add optional `getDynamicModels()` for real-time model fetching
4. Register in `app/lib/modules/llm/registry.ts`
5. Test dynamic model caching and capability detection

### Context Optimization System
- **File Selection**: AI determines relevant files for context
- **Chat Summarization**: Compresses conversation history when near token limits
- **Progressive Loading**: Streams responses with intermediate context updates
- **Token Management**: Dynamic context window utilization per provider

### Stream Processing Architecture
- Uses `StreamingMessageParser` for real-time `<boltArtifact>` and `<boltAction>` parsing
- Supports streaming file operations and shell command execution
- Auto-generates artifacts from code blocks when structured tags missing
- Provides abort capability for long-running operations

### State Management Best Practices
- Use Nanostores for reactive state with fine-grained updates
- Compose stores in `WorkbenchStore` pattern for complex state orchestration
- Implement localStorage persistence for user preferences
- Cross-store communication via reactive atoms and computed values

### Error Handling Strategy
- Provider-specific error messages with retry logic
- WebContainer error capture and user-friendly alerts
- Preview error detection with automatic fixes via AI
- Terminal error monitoring with context-aware suggestions