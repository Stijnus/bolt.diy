# LLM Providers 2025 Update Plan

## Executive Summary

This document outlines comprehensive updates to Bolt.DIY's LLM provider ecosystem for 2025, focusing exclusively on code generation models. Based on extensive research, we need to update all provider model lists, add new cloud providers, remove deprecated models, and enhance dynamic model fetching capabilities.

**Key Focus Areas:**
- Update all existing providers with 2025 model offerings
- Add new cloud providers (Cerebras, Hyperbolic, GitHub Models)
- Remove deprecated models across all providers
- Enhance dynamic model fetching with capability detection
- Update .env.example with all new provider configurations
- Focus exclusively on code generation models (ignore image/audio generation)

## Current Provider Status Analysis

### 🔴 Critical Updates Required

**OpenAI** - Major model additions needed:
- **NEW**: o3, o3-pro, o4-mini, o3-mini (reasoning models)
- **NEW**: GPT-4.1 (flagship multimodal)
- **NEW**: GPT-5 series (August 2025 release)
- **DEPRECATED**: Older GPT-4 variants

**Anthropic** - Next generation models available:
- **NEW**: Claude Opus 4, Claude Sonnet 4 (world's best coding models)
- **NEW**: Claude 3.7 Sonnet with extended thinking
- **UPDATED**: Claude 3.5 Sonnet, Claude 3.5 Haiku
- **REMOVE**: Older Claude 3.0 variants

**Google** - Gemini 2.5 generation released:
- **NEW**: Gemini 2.5 Flash, Gemini 2.5 Pro (with thinking)
- **UPDATED**: Gemini 2.0 Flash, Flash-Lite
- **REMOVE**: Gemini 1.5 models

**xAI** - Specialized code models launched:
- **NEW**: Grok 4 (most intelligent model)
- **NEW**: Grok Code Fast 1 (specialized for coding, 70.8% SWE-bench)
- **NEW**: Grok 3 (1M token context)
- **REMOVE**: Older Grok variants

**DeepSeek** - V3.1 generation available:
- **NEW**: DeepSeek-V3.1-Terminus (chat + reasoner modes)
- **UPDATED**: DeepSeek-Coder-V2 (338 languages, 128K context)
- **REMOVE**: V2 generation models

### 🟡 Major Updates Required

**Mistral** - Codestral evolution continues:
- **NEW**: Codestral 25.01 (#1 on LMsys copilot arena)
- **NEW**: Mistral Code enterprise stack
- **UPDATED**: 256K context, 2x faster generation
- **REMOVE**: Original Codestral

**Cohere** - Command A generation launched:
- **NEW**: Command A 03-2025 (111B params, best throughput)
- **UPDATED**: Command R+/R 08-2024 versions
- **REMOVE**: Pre-2024 Command models

**Amazon Bedrock** - Major provider additions:
- **NEW**: Claude Opus 4, Sonnet 4 integration
- **NEW**: Intelligent model routing
- **NEW**: Latency-optimized inference
- **UPDATED**: All Titan, Llama models

### 🟢 Minor Updates Required

**Groq** - LLaMA 4 partnership:
- **NEW**: Official Llama 4 API acceleration
- **NEW**: Llama-3-Groq-Tool-Use models
- **DEPRECATED**: mixtral-8x7b-32768 (March 2025)

**Together AI** - Expanded model catalog:
- **NEW**: Llama 4 Scout, Maverick (multimodal MoE)
- **NEW**: Llama 3.3 multilingual
- **UPDATED**: 200+ open-source model catalog

## New Providers to Add

### Cerebras Inference
- **Models**: Llama 3.1 8B, 70B optimized for speed
- **Specialty**: Ultra-fast inference with Wafer-Scale Engine
- **API**: OpenAI-compatible
- **Use Case**: Fastest code completion

### Hyperbolic
- **Models**: Llama, Mixtral, specialized fine-tunes
- **Specialty**: Cost-effective inference
- **API**: OpenAI-compatible
- **Use Case**: Budget-conscious deployments

### GitHub Models
- **Models**: GitHub-curated selection (GPT-4, Claude, Llama)
- **Specialty**: Developer-focused with GitHub integration
- **API**: Azure-based, GitHub-authenticated
- **Use Case**: Integrated development workflows

## Model Configuration Updates

### High-Priority Model Additions (SWE-bench Leaders)

1. **xAI Grok Code Fast 1**: 70.8% SWE-bench, 256K context, $0.20/$1.50 per 1M tokens
2. **Anthropic Claude Opus 4**: 72.5% SWE-bench, enterprise-grade coding
3. **Anthropic Claude Sonnet 4**: 72.7% SWE-bench, balanced performance
4. **OpenAI o4-mini**: 99.5% AIME 2025, best reasoning for cost
5. **Mistral Codestral 25.01**: #1 LMsys copilot arena, 2x faster

### Context Window Improvements

- **1M+ Tokens**: Gemini 2.5, Grok 3, Claude Opus 4
- **256K Tokens**: Grok Code Fast 1, Codestral 25.01, Command A
- **128K Tokens**: DeepSeek-Coder-V2, Command R+
- **32K+ Tokens**: Most other models

### Capability Detection Enhancements

```typescript
interface ModelCapabilities {
  reasoning: boolean;          // o3, o4-mini, Claude 4, Gemini 2.5
  fillInMiddle: boolean;      // Codestral, GitHub Copilot models
  toolUse: boolean;           // Claude 4, GPT-4.1, Grok 3
  multimodal: boolean;        // GPT-4.1, Claude 4, Gemini 2.5
  extendedContext: boolean;   // Models with 128K+ tokens
  fastInference: boolean;     // Groq, Cerebras optimized models
}
```

## Implementation Phases

### Phase 1: Core Provider Updates (Week 1)
- [ ] Update OpenAI provider with o3, o4-mini, GPT-4.1, GPT-5
- [ ] Update Anthropic provider with Claude 4 series
- [ ] Update Google provider with Gemini 2.5 series
- [ ] Update xAI provider with Grok 4, Code Fast 1

### Phase 2: Secondary Provider Updates (Week 2)
- [ ] Update DeepSeek with V3.1-Terminus
- [ ] Update Mistral with Codestral 25.01
- [ ] Update Cohere with Command A 03-2025
- [ ] Update Groq with Llama 4 models

### Phase 3: New Provider Integration (Week 3)
- [ ] Add Cerebras Inference provider
- [ ] Add Hyperbolic provider
- [ ] Add GitHub Models provider
- [ ] Update Amazon Bedrock with 2025 models

### Phase 4: System Enhancements (Week 4)
- [ ] Implement enhanced capability detection
- [ ] Update dynamic model fetching
- [ ] Add intelligent model routing
- [ ] Performance optimization for 1M+ context models

## Code Changes Required

### 1. Provider Model Lists (`app/lib/modules/llm/providers/*.ts`)

Each provider needs model list updates following this pattern:

```typescript
// Example: anthropic.ts
export const ANTHROPIC_MODELS = [
  // Claude 4 Series (NEW)
  { name: 'claude-opus-4-20250101', maxTokens: 500000, supportsImages: true },
  { name: 'claude-sonnet-4-20250101', maxTokens: 500000, supportsImages: true },

  // Claude 3.7 Series (NEW)
  { name: 'claude-3-7-sonnet-20241201', maxTokens: 200000, supportsImages: true },

  // Updated existing
  { name: 'claude-3-5-sonnet-20241022', maxTokens: 200000, supportsImages: true },
  { name: 'claude-3-5-haiku-20241022', maxTokens: 200000, supportsImages: true },

  // REMOVE: claude-3-opus-20240229, claude-3-sonnet-20240229, etc.
];
```

### 2. New Provider Implementations

```typescript
// cerebras.ts
export class CerebrasProvider extends BaseProvider {
  name = 'Cerebras';
  staticModels = CEREBRAS_MODELS;

  config = {
    baseURL: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama3.1-8b',
    requiresAuth: true,
  };
}

// hyperbolic.ts
export class HyperbolicProvider extends BaseProvider {
  name = 'Hyperbolic';
  staticModels = HYPERBOLIC_MODELS;

  config = {
    baseURL: 'https://api.hyperbolic.xyz/v1',
    defaultModel: 'llama-3.1-70b',
    requiresAuth: true,
  };
}
```

### 3. Enhanced Capability Detection

```typescript
// model-capability-service.ts updates
const REASONING_MODELS = [
  'o3', 'o3-pro', 'o4-mini', 'o3-mini',           // OpenAI
  'claude-opus-4', 'claude-sonnet-4',             // Anthropic
  'gemini-2.5-pro', 'gemini-2.5-flash',          // Google
  'deepseek-v3.1-terminus-reasoner',              // DeepSeek
];

const CODING_SPECIALISTS = [
  'grok-code-fast-1',                             // xAI
  'codestral-25.01',                              // Mistral
  'claude-opus-4', 'claude-sonnet-4',            // Anthropic
  'deepseek-coder-v2',                           // DeepSeek
];
```

### 4. Dynamic Model Fetching Updates

```typescript
// Enhanced provider registry with new capabilities
export const PROVIDER_REGISTRY = {
  // ... existing providers
  cerebras: CerebrasProvider,
  hyperbolic: HyperbolicProvider,
  github: GitHubModelsProvider,
};

// Enhanced model fetching with 2025 endpoints
async getDynamicModels(): Promise<Model[]> {
  const endpoints = {
    openai: '/v1/models',
    anthropic: '/v1/models',      // New endpoint
    xai: '/v1/models',            // New endpoint
    cerebras: '/v1/models',       // New provider
    hyperbolic: '/v1/models',     // New provider
  };

  // Implementation with error handling and caching
}
```

## Environment Configuration Updates

### .env.example Additions

```bash
# Existing providers (update comments with 2025 models)
OPENAI_API_KEY=                    # o3, o4-mini, GPT-4.1, GPT-5
ANTHROPIC_API_KEY=                 # Claude Opus 4, Sonnet 4, 3.7 Sonnet
GOOGLE_GENERATIVEAI_API_KEY=       # Gemini 2.5 Flash, Pro

# Updated providers
XAI_API_KEY=                       # Grok 4, Code Fast 1, Grok 3
DEEPSEEK_API_KEY=                  # V3.1-Terminus chat/reasoner
MISTRAL_API_KEY=                   # Codestral 25.01, Mistral Code
COHERE_API_KEY=                    # Command A 03-2025

# New providers (ADD)
CEREBRAS_API_KEY=                  # Ultra-fast Llama inference
HYPERBOLIC_API_KEY=                # Cost-effective models
GITHUB_TOKEN=                      # GitHub Models access

# Enhanced Bedrock (update)
AWS_BEDROCK_REGION=                # Claude 4, intelligent routing
AWS_BEDROCK_ACCESS_KEY_ID=
AWS_BEDROCK_SECRET_ACCESS_KEY=
```

## Performance Optimizations

### 1. Context Window Management
- Implement sliding window for 1M+ token models
- Progressive loading for large codebases
- Intelligent context compression

### 2. Model Selection Logic
```typescript
// Enhanced model routing based on task type
function selectOptimalModel(task: CodeTask): string {
  switch (task.type) {
    case 'completion':
      return 'grok-code-fast-1';        // Fastest for completions
    case 'reasoning':
      return 'o4-mini';                 // Best reasoning per cost
    case 'refactoring':
      return 'claude-opus-4';           // Best for complex code
    case 'debugging':
      return 'codestral-25.01';         // Specialized for FIM
    default:
      return 'claude-sonnet-4';         // Balanced default
  }
}
```

### 3. Caching Strategy
- Model list caching (24h TTL)
- Capability detection caching
- Provider availability status

## Testing Strategy

### 1. Model Validation Tests
- Verify all new models respond correctly
- Test capability detection accuracy
- Validate context window limits

### 2. Provider Integration Tests
- Authentication flow testing
- Error handling validation
- Rate limit compliance

### 3. Performance Benchmarks
- Response time comparisons
- Token usage optimization
- Cost efficiency analysis

## Deployment Checklist

### Pre-deployment
- [ ] All deprecated models removed from UI
- [ ] New provider documentation updated
- [ ] Environment variable validation
- [ ] Backward compatibility verified

### Deployment
- [ ] Feature flag controlled rollout
- [ ] Model availability monitoring
- [ ] User feedback collection
- [ ] Performance metrics tracking

### Post-deployment
- [ ] Provider status dashboard
- [ ] Cost optimization review
- [ ] User adoption metrics
- [ ] Continuous model updates

## Success Metrics

### Technical Metrics
- **Model Coverage**: 95% of top SWE-bench models available
- **Response Time**: <2s average for code completion
- **Context Utilization**: 80%+ efficiency for large contexts
- **Provider Uptime**: 99.5% availability

### User Experience Metrics
- **Model Selection**: Users actively choosing new 2025 models
- **Code Quality**: Improved output quality metrics
- **Developer Satisfaction**: Positive feedback on new capabilities
- **Cost Efficiency**: Reduced cost-per-interaction

## Timeline

**Week 1-2**: Core provider updates (OpenAI, Anthropic, Google, xAI)
**Week 3**: Secondary providers (DeepSeek, Mistral, Cohere, Groq)
**Week 4**: New providers (Cerebras, Hyperbolic, GitHub)
**Week 5**: System enhancements and optimization
**Week 6**: Testing, documentation, deployment preparation
**Week 7**: Gradual rollout with monitoring
**Week 8**: Full deployment and optimization

## Risk Mitigation

### API Changes
- Comprehensive error handling for new endpoints
- Fallback to previous model versions
- Provider status monitoring

### Cost Management
- Usage limits for expensive models (o3-pro, Opus 4)
- Cost tracking and alerting
- Model recommendation based on budget

### Performance Issues
- Progressive enhancement approach
- A/B testing for new models
- Rollback procedures for issues

---

**Next Steps**: Proceed to Phase 1 implementation with core provider updates, starting with OpenAI o3/o4-mini integration and Anthropic Claude 4 series.