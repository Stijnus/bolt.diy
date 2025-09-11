/* eslint-disable @typescript-eslint/naming-convention */

import { AnimatePresence, motion } from 'framer-motion';
import { memo, useMemo, useState } from 'react';
import type { ProviderInfo } from '~/types/model';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';

interface LLMDebugPanelProps {
  provider?: ProviderInfo;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null;
  codeFiles?: string[];
  candidates?: Array<{
    path: string;
    score: number;
    reasons?: { pathWeight: number; fileHitScore: number; relHitScore: number; contentHits: number };
  }>;
  reasons?: Array<{
    path: string;
    score: number;
    reasons?: { pathWeight: number; fileHitScore: number; relHitScore: number; contentHits: number };
  }>;
}

export const LLMDebugPanel = memo(
  ({ provider, model, usage, codeFiles = [], candidates = [], reasons = [] }: LLMDebugPanelProps) => {
    const [expanded, setExpanded] = useState(false);
    const [showScoring, setShowScoring] = useState(false);
    const [showWhy, setShowWhy] = useState(false);

    const hasAny = !!usage || (codeFiles && codeFiles.length > 0) || (candidates && candidates.length > 0);

    const usageSummary = useMemo(() => {
      if (!usage) {
        return '—';
      }

      const i = usage.inputTokens ?? 0;
      const o = usage.outputTokens ?? 0;
      const t = usage.totalTokens ?? i + o;

      return `${t} tokens (in ${i} • out ${o})`;
    }, [usage]);
    const reasonMap = useMemo(() => {
      const m = new Map<
        string,
        {
          path: string;
          score: number;
          reasons?: { pathWeight: number; fileHitScore: number; relHitScore: number; contentHits: number };
        }
      >();
      (reasons || []).forEach((r) => m.set(r.path, r));

      return m;
    }, [reasons]);

    if (!hasAny) {
      return null;
    }

    return (
      <div
        className={classNames(
          'bg-bolt-elements-background-depth-2',
          'border border-bolt-elements-borderColor',
          'shadow-lg rounded-lg relative w-full max-w-chat mx-auto z-prompt',
          'p-1',
        )}
      >
        <div className="flex items-center gap-2 bg-bolt-elements-item-backgroundAccent p-1 rounded-lg text-bolt-elements-item-contentAccent">
          <div className="i-ph:bug-beetle text-base" />
          <div className="text-sm font-medium text-bolt-elements-textPrimary">LLM Debug</div>
          <div className="ml-auto text-xs text-bolt-elements-textSecondary">
            {provider?.name ?? '—'} · {model ?? '—'} · {usageSummary}
          </div>
          <motion.button
            initial={{ width: 0 }}
            animate={{ width: 'auto' }}
            exit={{ width: 0 }}
            transition={{ duration: 0.15, ease: cubicEasingFn }}
            className="p-1 rounded-lg bg-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-artifacts-backgroundHover"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse LLM Debug' : 'Expand LLM Debug'}
          >
            <div className={expanded ? 'i-ph:caret-up-bold' : 'i-ph:caret-down-bold'}></div>
          </motion.button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              className="mt-2"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {usage && (
                <div className="px-2 py-1 text-xs text-bolt-elements-textSecondary">
                  <div>
                    Tokens · input <span className="text-bolt-elements-textPrimary">{usage.inputTokens ?? 0}</span> ·
                    output <span className="text-bolt-elements-textPrimary">{usage.outputTokens ?? 0}</span> · total{' '}
                    <span className="text-bolt-elements-textPrimary">
                      {usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)}
                    </span>
                  </div>
                </div>
              )}

              {codeFiles && codeFiles.length > 0 && (
                <div className="px-2 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-xs font-medium text-bolt-elements-textSecondary">Context files</div>
                    {reasons && reasons.length > 0 && (
                      <button
                        className="ml-auto text-xs px-2 py-1 rounded bg-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-artifacts-backgroundHover"
                        onClick={() => setShowWhy((v) => !v)}
                      >
                        {showWhy ? 'Hide' : 'Why selected'}
                      </button>
                    )}
                  </div>
                  <ul className="list-disc pl-5 text-xs leading-6">
                    {codeFiles.map((f, i) => {
                      const r = reasonMap.get(f);
                      return (
                        <li key={i} className="text-bolt-elements-textPrimary break-all">
                          {f}
                          {showWhy && r && (
                            <span className="text-bolt-elements-textSecondary">
                              {' '}
                              — score:{r.score} pw:{r.reasons?.pathWeight} fn:{r.reasons?.fileHitScore} rp:
                              {r.reasons?.relHitScore} ch:{r.reasons?.contentHits}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {candidates && candidates.length > 0 && (
                <div className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-bolt-elements-textSecondary">Candidate scoring</div>
                    <button
                      className="ml-auto text-xs px-2 py-1 rounded bg-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-artifacts-backgroundHover"
                      onClick={() => setShowScoring((v) => !v)}
                    >
                      {showScoring ? 'Hide' : 'Show'} scoring
                    </button>
                  </div>
                  {showScoring && (
                    <ul className="mt-2 text-xs leading-6">
                      {candidates
                        .slice(0, 30)
                        .sort((a, b) => b.score - a.score)
                        .map((c, i) => (
                          <li key={i} className="text-bolt-elements-textPrimary break-all">
                            <span className="font-medium">{c.score}</span> · {c.path}
                            {c.reasons && (
                              <span className="text-bolt-elements-textSecondary">
                                {' '}
                                — pw:{c.reasons.pathWeight} fn:{c.reasons.fileHitScore} rp:{c.reasons.relHitScore} ch:
                                {c.reasons.contentHits}
                              </span>
                            )}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
