# AI SDK v5 Migration Checklist

**Status**: 📋 Research Phase Complete - Ready for Implementation
**Branch**: `feature/ai-sdk-v5-upgrade`
**Current AI SDK Version**: 4.1.2
**Target Version**: 5.x
**Created**: January 2025

## Research Summary ✅

### Key Findings from Research Phase:
- **Breaking Changes**: Complete API rewrite with no backward compatibility
- **Scope**: ~50-60 files need updates across the entire codebase
- **Critical Impact**: Core streaming, provider system, and chat interface
- **Data Incompatibility**: v5 chat data format incompatible with v4
- **Timeline Estimate**: 3-4 weeks for full migration

---

## Phase 1: Core Package Updates (Priority: CRITICAL)

### 1.1 Main AI SDK Package
- [ ] **Update `ai` package from 4.1.2 to 5.x**
  - Current: `"ai": "4.1.2"`
  - Target: `"ai": "^5.0.0"`
  - Impact: Core functionality across entire application

### 1.2 AI SDK Provider Packages - All Need v5 Updates
```json
Current Provider Versions (All Need Updates):
"@ai-sdk/amazon-bedrock": "1.0.6"     → "@ai-sdk/amazon-bedrock": "^5.0.0"
"@ai-sdk/anthropic": "0.0.39"         → "@ai-sdk/anthropic": "^5.0.0"
"@ai-sdk/cohere": "1.0.3"             → "@ai-sdk/cohere": "^5.0.0"
"@ai-sdk/deepseek": "0.1.3"           → "@ai-sdk/deepseek": "^5.0.0"
"@ai-sdk/google": "0.0.52"            → "@ai-sdk/google": "^5.0.0"
"@ai-sdk/mistral": "0.0.43"           → "@ai-sdk/mistral": "^5.0.0"
"@ai-sdk/openai": "1.1.2"             → "@ai-sdk/openai": "^5.0.0"
```

- [ ] **Update provider packages** (7 packages)
- [ ] **Test package installation** and compatibility
- [ ] **Document compilation errors** after package updates

### 1.3 Third-party AI Providers
- [ ] **Check compatibility**: `@openrouter/ai-sdk-provider`: "^0.0.5"
- [ ] **Check compatibility**: `ollama-ai-provider`: "^0.15.2"
- [ ] **Update if needed** or find alternatives

---

## Phase 2: Core Infrastructure Migration (Priority: HIGH)

### 2.1 Base Provider System
- [ ] **Update `/app/lib/modules/llm/base-provider.ts`**
  - Current: Uses `LanguageModelV1` from 'ai'
  - Update: New v5 model interface definitions
  - Impact: All 21+ provider implementations depend on this

### 2.2 Provider Implementations (21 files in `/app/lib/modules/llm/providers/`)
- [ ] **OpenAI Provider** (`openai.ts`)
- [ ] **Anthropic Provider** (`anthropic.ts`)
- [ ] **Google Provider** (`google.ts`)
- [ ] **Mistral Provider** (`mistral.ts`)
- [ ] **Amazon Bedrock Provider** (`amazon-bedrock.ts`)
- [ ] **Cohere Provider** (`cohere.ts`)
- [ ] **DeepSeek Provider** (`deepseek.ts`)
- [ ] **Groq Provider** (`groq.ts`)
- [ ] **Together Provider** (`together.ts`)
- [ ] **OpenRouter Provider** (`openrouter.ts`)
- [ ] **Fireworks Provider** (`fireworks.ts`)
- [ ] **HuggingFace Provider** (`huggingface.ts`)
- [ ] **Ollama Provider** (`ollama.ts`)
- [ ] **LMStudio Provider** (`lmstudio.ts`)
- [ ] **Cerebras Provider** (`cerebras.ts`)
- [ ] **Remaining Providers** (6+ more files)

Each provider needs:
- ✅ Import updates for v5 SDK
- ✅ Model creation function updates
- ✅ Configuration pattern updates
- ✅ Type definition updates

---

## Phase 3: Core Streaming System (Priority: HIGH)

### 3.1 Main Streaming Logic
- [ ] **Update `/app/lib/.server/llm/stream-text.ts`** (200+ lines)
  - Current: `streamText()`, `convertToCoreMessages()`, `Message` type
  - Update: New v5 streaming API
  - Changes Required:
    - [ ] Replace `streamText` function call
    - [ ] Update `convertToCoreMessages` → new message conversion
    - [ ] Replace `Message` type with `UIMessage`/`ModelMessage`
    - [ ] Update streaming response handling
    - [ ] Update parameter names (`maxTokens` → `maxOutputTokens`)

### 3.2 API Route Updates
- [ ] **Update `/app/routes/api.chat.ts`** (Main chat endpoint)
  - Current: `createDataStream()`, `generateId()` from 'ai'
  - Update: New v5 streaming response format
  - Changes Required:
    - [ ] Replace `createDataStream` with new API
    - [ ] Update response format to `toUIMessageStreamResponse()`
    - [ ] Update message handling logic

---

## Phase 4: Context Processing System (Priority: HIGH)

### 4.1 Context Optimization
- [ ] **Update `/app/lib/.server/llm/create-summary.ts`**
  - Current: `generateText()`, `CoreTool`, `GenerateTextResult`, `Message`
  - Update: New v5 text generation API and types

- [ ] **Update `/app/lib/.server/llm/select-context.ts`**
  - Current: Same v4 patterns as create-summary
  - Update: New v5 API patterns

### 4.2 Utilities
- [ ] **Update `/app/lib/.server/llm/utils.ts`**
  - Current: Uses `Message` type from 'ai'
  - Update: Use new v5 message types

---

## Phase 5: Chat UI System Migration (Priority: MEDIUM)

### 5.1 Main Chat Component
- [ ] **Update `/app/components/chat/Chat.client.tsx`**
  - Current: `useChat` hook from 'ai/react', `Message` type
  - Major Changes Required:
    - [ ] Add manual input state: `const [input, setInput] = useState('')`
    - [ ] Replace `useChat` options with transport-based API
    - [ ] Replace `append()` → `sendMessage({ text })`
    - [ ] Replace `reload()` → `regenerate()`
    - [ ] Replace `isLoading` → `status` checks
    - [ ] Replace `handleInputChange` → manual input handling
    - [ ] Replace `handleSubmit` → custom form submission
    - [ ] Update `Message` → `UIMessage` type usage

### 5.2 Supporting Components
- [ ] **Messages Components** (Multiple files)
  - Update message type handling throughout UI
- [ ] **Deployment Components**
  - `VercelDeploy.client.tsx`, `NetlifyDeploy.client.tsx`, etc.
  - Update AI SDK imports and usage

---

## Phase 6: Tool Calling System (Priority: MEDIUM)

### 6.1 Tool Definition Updates
- [ ] **Find and update tool definitions throughout codebase**
  - Current: `parameters: z.object({...})`
  - Update: `inputSchema: z.object({...})`
  - Add: `outputSchema` for type safety
  - Update: Tool result access `.result` → `.output`

### 6.2 Tool Execution
- [ ] **Update tool calling in streaming system**
- [ ] **Update WebContainer integration with tools**
- [ ] **Update tool result parsing**

---

## Phase 7: Supporting Infrastructure (Priority: LOW)

### 7.1 Type Definitions and Utils (27 files identified)
- [ ] **Update Message/CoreMessage type imports** across codebase
- [ ] **Update utility functions** using AI SDK types
- [ ] **Update persistence layers** handling AI data

### 7.2 Secondary API Routes
- [ ] **Update `/app/routes/api.enhancer.ts`**
- [ ] **Update `/app/routes/api.llmcall.ts`**
- [ ] **Update other API routes** using AI SDK

---

## Phase 8: Testing and Validation

### 8.1 Core Functionality Testing
- [ ] **Test streaming text generation** across all providers
- [ ] **Test chat interface** with new useChat implementation
- [ ] **Test WebContainer integration** with AI responses
- [ ] **Test tool calling system**

### 8.2 Provider Testing (All 20+ Providers)
- [ ] **OpenAI models** (GPT-4, GPT-3.5, o1, o3-mini)
- [ ] **Anthropic models** (Claude 3.5 Sonnet, Claude 3 Opus)
- [ ] **Google models** (Gemini 1.5 Pro, Gemini 2.0)
- [ ] **xAI models** (Grok-2, Grok-beta)
- [ ] **Local models** (Ollama, LMStudio)
- [ ] **All other providers** (15+ remaining)

### 8.3 Integration Testing
- [ ] **Full chat workflows** end-to-end
- [ ] **Context optimization system**
- [ ] **Multi-provider switching**
- [ ] **Performance benchmarking** vs v4

### 8.4 Error Handling Testing
- [ ] **Provider failures and fallbacks**
- [ ] **Rate limiting scenarios**
- [ ] **Token limit handling**
- [ ] **Network error recovery**

---

## Phase 9: Documentation and Finalization

### 9.1 Code Documentation
- [ ] **Update code comments** referencing old API
- [ ] **Update inline documentation**
- [ ] **Update developer notes**

### 9.2 Migration Documentation
- [ ] **Document breaking changes encountered**
- [ ] **Document solutions to migration challenges**
- [ ] **Create rollback procedures**
- [ ] **Update development guidelines**

---

## Migration Commands Reference

### Package Updates
```bash
# Update core AI SDK
pnpm update ai@5

# Update all provider packages
pnpm update @ai-sdk/openai@5 @ai-sdk/anthropic@5 @ai-sdk/google@5
pnpm update @ai-sdk/mistral@5 @ai-sdk/cohere@5 @ai-sdk/deepseek@5
pnpm update @ai-sdk/amazon-bedrock@5

# Install new React integration if needed
pnpm install @ai-sdk/react@5
```

### Testing Commands
```bash
# Run comprehensive testing
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build

# Test development server
pnpm run dev
```

---

## Risk Mitigation Strategies

### High Risk Areas
1. **Core Streaming**: Complete API change affects entire app
2. **Provider System**: All 20+ providers need simultaneous updates
3. **Chat Interface**: useChat hook changes affect main UX
4. **Data Compatibility**: No rollback once v5 data format adopted

### Rollback Plan
1. **Keep v4 branch**: Maintain `feature/react-19-upgrade` as rollback point
2. **Environment separation**: Test v5 in isolated environment first
3. **Gradual migration**: Consider provider-by-provider approach if needed
4. **Data backup**: Backup chat data before migration

---

## Success Criteria

### Must Have ✅
- [ ] All 20+ LLM providers functional
- [ ] Chat streaming maintained or improved
- [ ] WebContainer integration working
- [ ] Tool calling system functional
- [ ] Performance parity with v4
- [ ] Zero TypeScript compilation errors
- [ ] All existing functionality preserved

### Should Have ✅
- [ ] Model capability detection accurate
- [ ] Context optimization system working
- [ ] Error handling improved
- [ ] Documentation complete
- [ ] Test coverage maintained

### Nice to Have ✅
- [ ] Leverage new v5 features
- [ ] Enhanced developer experience
- [ ] Improved type safety benefits
- [ ] Better streaming capabilities

---

## Timeline Estimate

- **Week 1**: Phases 1-3 (Core packages, infrastructure, streaming)
- **Week 2**: Phases 4-6 (Context system, UI migration, tool calling)
- **Week 3**: Phases 7-8 (Supporting files, comprehensive testing)
- **Week 4**: Phase 9 (Documentation, optimization, final validation)

---

**Research Phase Completed**: January 2025
**Ready for Implementation**: Phase 1 - Core Package Updates
**Next Review**: After Phase 1 completion
**Owner**: Development team