# Token Usage Statistics

The Token Usage Statistics component is a feature that tracks and displays token consumption across different language models and providers in the application. It provides detailed insights into how tokens are being used in conversations, including cost breakdowns and usage patterns.

## Features

- **Real-time Token Tracking**: Monitors token usage for each conversation in real-time
- **Multi-Model Support**: Tracks usage across different AI models and providers
- **Cost Breakdown**: Provides detailed cost analysis for token usage
- **Usage Statistics**: Shows prompt vs. completion token distribution
- **Per-Chat Analytics**: View token usage statistics for individual chat sessions
- **Chat Title Integration**: Displays chat titles consistently with URL identifiers

## Components

### TokenUsageTab
The main component that displays token usage information. It includes:
- Total cost display
- Model-specific usage statistics
- Detailed cost breakdown
- Settings configuration access
- Chat title display (synchronized with URL identifier)

### Token Usage Hook (`useTokenUsage`)
A React hook that calculates token usage statistics by:
- Processing message history
- Tracking usage per model/provider
- Calculating total token consumption
- Computing prompt vs. completion percentages

## Data Structure

### TokenUsage Interface
```typescript
interface TokenUsage {
  completionTokens: number;
  promptTokens: number;
  totalTokens: number;
  model?: string;
  provider?: string;
}
```

### ModelUsage Interface
```typescript
interface ModelUsage {
  model: string;
  provider: string;
  completionTokens: number;
  promptTokens: number;
  totalTokens: number;
  count: number;
}
```

## Usage Tracking

Token usage is tracked automatically for each conversation. The system:
1. Extracts model and provider information from messages
2. Accumulates token usage statistics per model
3. Calculates total usage across all models
4. Computes usage percentages for prompts and completions
5. Displays chat titles based on URL identifiers

## Components Location

- Main Component: `/app/components/settings/tokenusagestats/TokenUsageTab.tsx`
- Usage Hook: `/app/lib/hooks/useTokenUsage.ts`
- Types: `/app/types/token-usage.ts`
- UI Components:
  - ModelUsageCard: `/app/components/ui/ModelUsageCard.tsx`
  - CostBreakdownCard: `/app/components/ui/CostBreakdownCard.tsx`
  - TotalCostCard: `/app/components/ui/TotalCostCard.tsx`

## Implementation Details

The token usage tracking system works by:
1. Monitoring all chat messages
2. Extracting model and provider information from user messages
3. Finding corresponding usage annotations in assistant responses
4. Aggregating usage data per model/provider
5. Calculating total usage and percentages
6. Displaying the information in an organized UI
7. Synchronizing chat titles with URL identifiers

## Chat Title Handling

The system maintains consistent chat titles across the interface by:
1. Using URL identifiers (e.g., "todo-app-react") as the primary source for chat titles
2. Synchronizing titles between the chat store and token usage display
3. Ensuring titles are consistent between the URL and the token usage statistics

## Settings

Token usage settings can be configured through the TokenUsageSettingsModal, which allows users to:
- View and manage token usage preferences
- Access detailed usage statistics
- Configure display preferences

## Integration

The token usage statistics are automatically integrated into the chat interface and can be accessed through:
1. The settings panel
2. Individual chat sessions (with consistent chat titles)
3. Overall usage statistics view

## Upcoming Features

Planned enhancements for the token usage system include:
1. **Export Functionality**: Ability to export token usage statistics in various formats (CSV, JSON)
2. **Usage Alerts**: Configurable alerts for token usage thresholds
3. **Advanced Analytics**: 
   - Usage trends over time
   - Cost projections
   - Model efficiency comparisons
4. **Custom Title Support**: Ability to set and persist custom chat titles while maintaining URL synchronization
5. **Batch Operations**: Tools for managing token usage across multiple chats simultaneously
6. **Enhanced Dashboard View**:
   - Comprehensive overview of all chats in a single view
   - Sortable and filterable chat list with usage metrics
   - Detailed cost breakdown per chat and model
   - Usage patterns and trends visualization
   - Interactive charts and graphs for usage analysis
   - Aggregated statistics across all conversations
   - Time-based usage analysis (daily, weekly, monthly)
