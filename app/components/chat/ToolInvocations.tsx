import {
  getToolOrDynamicToolName,
  isToolOrDynamicToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
} from 'ai';
import type { UIMessage } from 'ai';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useMemo, useState } from 'react';
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from 'shiki';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { themeStore, type Theme } from '~/lib/stores/theme';
import { useStore } from '@nanostores/react';
import type { ToolCallAnnotation } from '~/types/context';

export type ToolInvocationPart = ToolUIPart | DynamicToolUIPart;

export type ToolInvocationState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error';

export interface ToolInvocationViewModel {
  toolCallId: string;
  toolName: string;
  state: ToolInvocationState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  providerExecuted?: boolean;
  dynamic?: boolean;
  preliminary?: boolean;
}

const highlighterOptions = {
  langs: ['json'],
  themes: ['light-plus', 'dark-plus'],
};

const jsonHighlighter: HighlighterGeneric<BundledLanguage, BundledTheme> =
  import.meta.hot?.data.jsonHighlighter ?? (await createHighlighter(highlighterOptions));

if (import.meta.hot) {
  import.meta.hot.data.jsonHighlighter = jsonHighlighter;
}

interface JsonCodeBlockProps {
  code: unknown;
  theme: Theme;
}

function JsonCodeBlock({ code, theme }: JsonCodeBlockProps) {
  let formattedCode = '';

  try {
    if (typeof code === 'string') {
      formattedCode = code;
    } else {
      formattedCode = JSON.stringify(code, null, 2);
    }
  } catch (error) {
    formattedCode = String(code);
  }

  return (
    <div
      className="text-xs rounded-md overflow-hidden border border-bolt-elements-borderColor"
      dangerouslySetInnerHTML={{
        __html: jsonHighlighter.codeToHtml(formattedCode, {
          lang: 'json',
          theme: theme === 'dark' ? 'dark-plus' : 'light-plus',
        }),
      }}
    />
  );
}

interface ToolInvocationsProps {
  toolInvocations: ToolInvocationViewModel[];
  toolCallAnnotations: ToolCallAnnotation[];
}

export const ToolInvocations = memo(({ toolInvocations, toolCallAnnotations }: ToolInvocationsProps) => {
  const theme = useStore(themeStore);
  const [expanded, setExpanded] = useState(false);

  const invocations = useMemo(() => toolInvocations, [toolInvocations]);

  if (!invocations.length) {
    return null;
  }

  return (
    <div className="tool-invocation border border-bolt-elements-borderColor flex flex-col overflow-hidden rounded-lg w-full transition-border duration-150">
      <div className="flex items-center justify-between p-2.5 bg-bolt-elements-background-depth-2">
        <div className="font-medium text-sm text-bolt-elements-textPrimary flex items-center gap-2">
          <span className="i-ph:wrench text-xl" /> Tool Invocations
        </div>
        <button
          className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
          onClick={() => setExpanded((value) => !value)}
        >
          <div className={expanded ? 'i-ph:caret-up-bold text-lg' : 'i-ph:caret-down-bold text-lg'} />
        </button>
      </div>
      <AnimatePresence>
        {(expanded ? invocations : invocations.slice(-1)).map((invocation) => {
    const annotation = toolCallAnnotations.find((item) => item.toolCallId === invocation.toolCallId);
          const key = `${invocation.toolCallId}-${invocation.state}`;

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2, ease: cubicEasingFn }}
              className="border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-3 text-sm"
            >
              <div className="flex flex-col gap-1 text-bolt-elements-textSecondary">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-bolt-elements-textPrimary">{invocation.toolName}</span>
                  <span className="rounded-full bg-bolt-elements-item-backgroundAccent px-2 py-0.5">
                    {invocation.state}
                  </span>
                  {annotation?.toolDescription && (
                    <span className="truncate">{annotation.toolDescription}</span>
                  )}
                </div>
                {invocation.input !== undefined ? (
                  <div className="mt-2">
                    <div className="uppercase tracking-wide text-xs mb-1">Input</div>
                    <JsonCodeBlock code={invocation.input} theme={theme} />
                  </div>
                ) : null}
                {invocation.output !== undefined ? (
                  <div className="mt-2">
                    <div className="uppercase tracking-wide text-xs mb-1">Output</div>
                    <JsonCodeBlock code={invocation.output} theme={theme} />
                  </div>
                ) : null}
                {invocation.errorText ? (
                  <div className="mt-2 text-red-500">{invocation.errorText}</div>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

export function extractToolParts(parts: UIMessage['parts'] | undefined): ToolInvocationPart[] {
  if (!parts?.length) {
    return [];
  }

  return parts.filter(isToolOrDynamicToolUIPart);
}

export function normalizeToolInvocations(parts: UIMessage['parts'] | undefined): ToolInvocationViewModel[] {
  const toolParts = extractToolParts(parts);

  return toolParts.map((part) => ({
    toolCallId: part.toolCallId,
    toolName: getToolOrDynamicToolName(part),
    state: part.state as ToolInvocationState,
    input: part.state === 'input-streaming' || part.state === 'input-available' ? part.input : undefined,
    output: part.state === 'output-available' ? part.output : undefined,
    errorText: part.state === 'output-error' ? part.errorText : undefined,
    providerExecuted: 'providerExecuted' in part ? part.providerExecuted : undefined,
    preliminary: 'preliminary' in part ? part.preliminary : undefined,
    dynamic: part.type === 'dynamic-tool',
  }));
}
