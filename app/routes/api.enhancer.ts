import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';
import type { ProviderInfo } from '~/types/model';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';
import { isReasoningModel } from '~/lib/.server/llm/constants';

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

const logger = createScopedLogger('api.enhancher');

function getEnhancementInstructions(
  promptTemplate?: string,
  chatMode?: 'build' | 'discuss',
  capabilities?: { maxInputTokens: number; maxOutputTokens: number },
  isReasoning?: boolean,
): string {
  const baseInstructions = stripIndents`
    You are a professional prompt engineer specializing in crafting precise, effective prompts.
    Your task is to enhance prompts by making them more specific, actionable, and effective.
  `;

  // Template-specific instructions
  let templateInstructions = '';

  if (promptTemplate === 'lightweight') {
    templateInstructions = stripIndents`
      OPTIMIZATION FOR LIGHTWEIGHT MODE:
      - Prioritize brevity and speed
      - Focus on essential details only
      - Avoid complex multi-step requests
      - Keep context minimal but sufficient
    `;
  } else if (promptTemplate === 'coding') {
    templateInstructions = stripIndents`
      OPTIMIZATION FOR FULL-FEATURED CODING:
      - Include detailed technical specifications
      - Specify design patterns and architecture
      - Add accessibility and best practices requirements
      - Consider mobile responsiveness and production readiness
    `;
  }

  // Mode-specific instructions
  let modeInstructions = '';

  if (chatMode === 'discuss') {
    modeInstructions = stripIndents`
      DISCUSSION MODE OPTIMIZATION:
      - Focus on planning and strategic thinking
      - Ask for architecture decisions and trade-offs
      - Include requirements gathering questions
      - Avoid requesting immediate code implementation
    `;
  } else {
    modeInstructions = stripIndents`
      BUILD MODE OPTIMIZATION:
      - Make requests implementation-ready
      - Include specific technical requirements
      - Specify expected deliverables and artifacts
      - Focus on actionable development tasks
    `;
  }

  // Model-specific instructions
  let modelInstructions = '';

  if (isReasoning) {
    modelInstructions = stripIndents`
      REASONING MODEL OPTIMIZATION:
      - Encourage deep analysis and step-by-step thinking
      - Frame requests for complex problem-solving
      - Ask for detailed explanations of trade-offs
      - Focus on conceptual understanding over tools
    `;
  } else if (capabilities && capabilities.maxOutputTokens > 32000) {
    modelInstructions = stripIndents`
      HIGH-OUTPUT MODEL OPTIMIZATION:
      - Can handle comprehensive, detailed responses
      - Suitable for complete implementations
      - Can generate extensive documentation
      - Optimal for complex, multi-part solutions
    `;
  }

  return stripIndents`
    ${baseInstructions}
    
    ${templateInstructions}
    
    ${modeInstructions}
    
    ${modelInstructions}

    ENHANCEMENT RULES:
    - Make instructions explicit and unambiguous
    - Add relevant context and constraints
    - Remove redundant information
    - Maintain the core intent
    - Ensure the prompt is self-contained
    - Use professional language
    - Optimize for the current model's capabilities

    For unclear prompts, provide clear guidance on what information is needed.
    
    IMPORTANT: Your response must ONLY contain the enhanced prompt text.
    Do not include any explanations, metadata, or wrapper tags.
  `;
}

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  const { message, model, provider, promptTemplate, chatMode } = await request.json<{
    message: string;
    model: string;
    provider: ProviderInfo;
    promptTemplate?: string;
    chatMode?: 'build' | 'discuss';
    apiKeys?: Record<string, string>;
  }>();

  const { name: providerName } = provider;

  // validate 'model' and 'provider' fields
  if (!model || typeof model !== 'string') {
    throw new Response('Invalid or missing model', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  if (!providerName || typeof providerName !== 'string') {
    throw new Response('Invalid or missing provider', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  // Get model capabilities for smarter enhancement - simplified approach for now
  const isReasoning = isReasoningModel(model);
  const capabilities = {
    maxInputTokens: 128000, // Default fallback
    maxOutputTokens: isReasoning ? 32000 : 4096, // Higher for reasoning models
  };

  try {
    // Create context-aware enhancement prompt
    const enhancementContext = stripIndents`
      [Model: ${model} | Provider: ${providerName}]
      [Template: ${promptTemplate || 'coding'} | Mode: ${chatMode || 'build'}]
      [Capabilities: Input ${capabilities.maxInputTokens}, Output ${capabilities.maxOutputTokens}]
      ${isReasoning ? '[REASONING MODEL - No tools, focuses on deep analysis]' : '[STANDARD MODEL - Supports tools and artifacts]'}
    `;

    const enhancementInstructions = getEnhancementInstructions(promptTemplate, chatMode, capabilities, isReasoning);

    const result = await streamText({
      messages: [
        {
          role: 'user',
          content: `[Model: ${model}]\n\n[Provider: ${providerName}]\n\n${enhancementContext}\n\n${enhancementInstructions}\n\n<original_prompt>${message}</original_prompt>`,
        },
      ],
      env: context.cloudflare?.env as any,
      apiKeys,
      providerSettings,
      promptId: 'coding', // Use coding prompt as base
      options: {
        system:
          'You are a senior software principal architect, you should help the user analyse the user query and enrich it with the necessary context and constraints to make it more specific, actionable, and effective. You should also ensure that the prompt is self-contained and uses professional language. Your response should ONLY contain the enhanced prompt text. Do not include any explanations, metadata, or wrapper tags.',

        /*
         * onError: (event) => {
         *   throw new Response(null, {
         *     status: 500,
         *     statusText: 'Internal Server Error',
         *   });
         * }
         */
      },
    });

    // Handle streaming errors in a non-blocking way
    (async () => {
      try {
        for await (const part of result.fullStream) {
          if (part.type === 'error') {
            const error: any = part.error;
            logger.error('Streaming error:', error);
            break;
          }
        }
      } catch (error) {
        logger.error('Error processing stream:', error);
      }
    })();

    // Return the text stream directly since it's already text data
    return new Response(result.textStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    console.log(error);

    if (error instanceof Error && error.message?.includes('API key')) {
      throw new Response('Invalid or missing API key', {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
