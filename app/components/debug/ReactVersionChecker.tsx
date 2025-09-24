import React from 'react';

interface ReactVersionCheckerProps {
  showDetails?: boolean;
}

export const ReactVersionChecker: React.FC<ReactVersionCheckerProps> = ({ showDetails = false }) => {
  const reactVersion = React.version;
  const isReact19 = reactVersion.startsWith('19.');

  // Log React version information to console for verification
  React.useEffect(() => {
    console.log('🔍 React Version Verification:', {
      version: reactVersion,
      isReact19,
      expected: '19.x.x',
      status: isReact19 ? 'SUCCESS ✅' : 'FAILED ❌',
    });
  }, [reactVersion, isReact19]);

  if (!showDetails) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md p-3 text-xs font-mono shadow-lg"
      style={{ minWidth: '200px' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${isReact19 ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="font-semibold">React Version Check</span>
      </div>

      <div className="space-y-1">
        <div>
          <span className="text-bolt-elements-textSecondary">Version: </span>
          <span className={isReact19 ? 'text-green-400' : 'text-red-400'}>{reactVersion}</span>
        </div>

        <div>
          <span className="text-bolt-elements-textSecondary">Status: </span>
          <span className={isReact19 ? 'text-green-400' : 'text-red-400'}>
            {isReact19 ? 'React 19 ✓' : 'Not React 19 ✗'}
          </span>
        </div>

        <div className="text-xs text-bolt-elements-textSecondary mt-2">Expected: 19.x.x</div>
      </div>
    </div>
  );
};

export default ReactVersionChecker;
