# OpenRouter Free Models Guide

## Overview

This guide provides comprehensive recommendations for using free models on OpenRouter, including best practices, troubleshooting tips, and when to consider upgrading to paid models.

## Free Model Characteristics

### Common Issues with Free Models

1. **Rate Limiting**: Free tiers often have strict usage limits
2. **Queue Times**: May experience delays during peak hours
3. **Response Quality**: Can be less consistent than paid models
4. **Service Reliability**: May have more frequent outages or slowdowns
5. **Context Window Limitations**: Often smaller context windows than paid alternatives

### When Free Models Work Well

✅ **Good Use Cases:**
- Simple code reviews
- Basic questions and explanations
- Small code snippets
- Learning and experimentation
- Quick prototyping

❌ **Not Recommended For:**
- Complex application development
- Large codebase modifications
- Performance-critical features
- Production deployments
- Time-sensitive work

## Best Practices

### 1. Model Selection Strategy

```typescript
// Recommended approach for selecting models
const modelStrategy = {
  primary: "Paid models (Claude 3.5 Sonnet, GPT-4o)",
  fallback: "Free models for simple tasks",
  emergency: "Most reliable free model available"
};
```

### 2. Usage Patterns

**For Simple Tasks:**
- Use free models first to test approach
- Switch to paid models if results are inadequate
- Keep sessions short to avoid rate limits

**For Complex Tasks:**
- Start with paid models from the beginning
- Use free models only for preliminary testing
- Have backup models ready

### 3. Error Handling

```typescript
// Example error handling for free model issues
try {
  const response = await useFreeModel(query);
  if (!response.satisfactory) {
    // Automatically switch to paid model
    return await usePaidModel(query);
  }
} catch (error) {
  if (error.type === 'rate_limit') {
    // Wait and retry or switch models
    await delay(5000);
    return retryWithDifferentModel(query);
  }
}
```

## Recommended Paid Alternatives

### Top Performing Models

| Model | Provider | Best For | Cost/Million Tokens |
|-------|----------|----------|-------------------|
| Claude 3.5 Sonnet | OpenRouter | Overall best | $3-15 |
| GPT-4o | OpenRouter | Code generation | $2.50-10 |
| DeepSeek Coder V2 | OpenRouter | Coding tasks | $0.14-0.28 |
| Gemini 2.0 Flash | Google | Speed | $0.15-0.60 |

### Cost-Effective Options

| Model | Provider | Use Case | Notes |
|-------|----------|----------|--------|
| DeepSeek Coder V2 236b | OpenRouter | Large codebases | Excellent free alternative |
| Qwen 2.5 Coder 32b | OpenRouter | Self-hosted option | Good for local deployment |
| Mistral Large | OpenRouter | General coding | Balanced performance/cost |

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Rate Limiting
```
Error: "Rate limit exceeded"
```
**Solutions:**
- Wait 1-5 minutes before retrying
- Switch to a different free model
- Consider upgrading to paid tier
- Implement request queuing in your application

#### 2. Slow Response Times
```
Issue: Responses taking 30+ seconds
```
**Solutions:**
- Try during off-peak hours (2-6 AM UTC)
- Switch to Gemini 2.0 Flash for speed
- Use smaller context windows
- Break large requests into smaller chunks

#### 3. Quality Issues
```
Issue: Poor code quality or incorrect responses
```
**Solutions:**
- Switch to Claude 3.5 Sonnet or GPT-4o
- Provide more specific prompts
- Use the enhance prompt feature
- Break complex tasks into simpler steps

#### 4. Service Outages
```
Issue: Model unavailable or API errors
```
**Solutions:**
- Check OpenRouter status page
- Try alternative free models
- Use cached responses when possible
- Have offline fallback options

### Monitoring and Alerts

Set up monitoring for:
- Response time degradation
- Error rate increases
- Rate limit hits
- Service availability

## Configuration Recommendations

### API Settings

```typescript
// Recommended settings for free models
const freeModelConfig = {
  timeout: 30000, // 30 second timeout
  retries: 2,     // Limited retries to avoid rate limits
  contextWindow: 32000, // Conservative context usage
  temperature: 0.7,     // Balanced creativity vs consistency
};
```

### Application-Level Settings

```typescript
// Bolt.diy specific recommendations
const boltSettings = {
  // Use free models for simple tasks
  simpleTasks: ['code_review', 'explanation', 'small_fixes'],

  // Always use paid models for
  complexTasks: ['full_app_development', 'architecture_design', 'performance_critical'],

  // Automatic fallback settings
  autoFallback: {
    enabled: true,
    fromFreeToPaid: true,
    qualityThreshold: 0.7,
  }
};
```

## Cost Optimization

### Usage Patterns

1. **Batch Processing**: Group similar tasks together
2. **Prompt Optimization**: Use the enhance prompt feature
3. **Context Management**: Keep context windows efficient
4. **Caching**: Cache frequent responses

### Monitoring Usage

Track your usage patterns to:
- Identify cost optimization opportunities
- Detect unusual usage patterns
- Plan budget allocations
- Optimize model selection

## Migration Strategy

### Gradual Transition

1. **Phase 1**: Continue using free models for simple tasks
2. **Phase 2**: Gradually introduce paid models for complex work
3. **Phase 3**: Full transition based on usage analysis

### A/B Testing

Compare free vs paid model performance:
- Response quality
- Speed and reliability
- User satisfaction
- Cost efficiency

## Community Resources

- **OpenRouter Status Page**: Monitor service health
- **Bolt.diy Community**: Share experiences and solutions
- **GitHub Issues**: Report bugs and request improvements
- **Documentation**: Stay updated with latest recommendations

## Future Improvements

We're continuously working to improve free model support:

- **Better Quality Detection**: Automatic quality assessment
- **Smart Fallbacks**: Intelligent model switching
- **Usage Optimization**: Automatic prompt optimization
- **Performance Monitoring**: Real-time quality metrics

## Support

If you encounter issues with free models:

1. Check this guide first
2. Review the troubleshooting section
3. Try the recommended alternatives
4. Reach out to the community for help

Remember: Free models are a great starting point, but paid models generally provide better reliability and quality for serious development work.
