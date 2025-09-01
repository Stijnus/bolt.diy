import React from 'react';

interface FreeModelRecommendationsProps {
  isVisible: boolean;
  onClose: () => void;
  providerName: string;
}

export const FreeModelRecommendations: React.FC<FreeModelRecommendationsProps> = ({
  isVisible,
  onClose,
  providerName,
}) => {
  if (!isVisible) {
    return null;
  }

  const recommendations = [
    {
      title: 'Best Practices for Free Models',
      items: [
        'Use for simple tasks like code review or basic questions',
        'Avoid complex multi-step coding tasks',
        'Test with small code snippets first',
        'Have backup paid models ready to switch to',
      ],
    },
    {
      title: 'When to Switch to Paid Models',
      items: [
        'Complex application development',
        'Large codebase modifications',
        'Performance-critical features',
        'When you need consistent, high-quality responses',
      ],
    },
    {
      title: 'Troubleshooting Free Model Issues',
      items: [
        'Try refreshing the model list',
        'Switch to a different free model',
        'Check OpenRouter status page for outages',
        'Consider upgrading to paid tier for better reliability',
      ],
    },
  ];

  const alternativeModels = [
    { name: 'Claude 3.5 Sonnet', provider: 'OpenRouter', reason: 'Best overall performance' },
    { name: 'GPT-4o', provider: 'OpenRouter', reason: 'Excellent code generation' },
    { name: 'DeepSeek Coder V2', provider: 'OpenRouter', reason: 'Great for coding tasks' },
    { name: 'Gemini 2.0 Flash', provider: 'Google', reason: 'Fast and reliable' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
            <span className="i-ph:warning-circle text-orange-400" />
            Free Model Recommendations
          </h3>
          <button
            onClick={onClose}
            className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
          >
            <span className="i-ph:x text-lg" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Warning Alert */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="i-ph:warning text-orange-400 text-xl flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-300 mb-2">Free Model Limitations</h4>
                <p className="text-sm text-bolt-elements-textSecondary">
                  Free models on {providerName} may experience slower response times, rate limiting, and inconsistent
                  performance compared to paid models. They're suitable for simple tasks but may struggle with complex
                  coding scenarios.
                </p>
              </div>
            </div>
          </div>

          {/* Recommendations Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {recommendations.map((section, index) => (
              <div key={index} className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h4 className="font-medium text-bolt-elements-textPrimary mb-3 flex items-center gap-2">
                  <span className="i-ph:lightbulb text-blue-400" />
                  {section.title}
                </h4>
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="text-sm text-bolt-elements-textSecondary flex items-start gap-2">
                      <span className="i-ph:dot text-xs text-bolt-elements-textTertiary mt-1 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Alternative Models */}
          <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
            <h4 className="font-medium text-bolt-elements-textPrimary mb-3 flex items-center gap-2">
              <span className="i-ph:star text-green-400" />
              Recommended Paid Alternatives
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              {alternativeModels.map((model, index) => (
                <div
                  key={index}
                  className="bg-bolt-elements-background-depth-2 rounded p-3 border border-bolt-elements-borderColor"
                >
                  <div className="font-medium text-bolt-elements-textPrimary text-sm">{model.name}</div>
                  <div className="text-xs text-bolt-elements-textTertiary">{model.provider}</div>
                  <div className="text-xs text-green-400 mt-1">{model.reason}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-bolt-elements-borderColor">
            <button
              onClick={onClose}
              className="flex-1 bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary px-4 py-2 rounded-md transition-colors text-sm font-medium"
            >
              Continue with Free Model
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 hover:text-orange-200 px-4 py-2 rounded-md transition-colors text-sm font-medium border border-orange-500/30"
            >
              Switch to Paid Model
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
