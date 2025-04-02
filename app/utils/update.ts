interface UpdateStageTimings {
  fetch: number;
  pull: number;
  install: number;
  build: number;
  complete: number;
}

export const DEFAULT_STAGE_TIMINGS: UpdateStageTimings = {
  fetch: 20,
  pull: 40,
  install: 70,
  build: 90,
  complete: 100,
};

export function getEstimatedProgress(stage: string, timings: UpdateStageTimings = DEFAULT_STAGE_TIMINGS): number {
  return timings[stage as keyof UpdateStageTimings] || 0;
}

export function getTroubleshootingSteps(error: string): string[] {
  if (error.includes('Git is not available')) {
    return [
      '1. Install Git from https://git-scm.com/',
      '2. Verify installation by running `git --version` in terminal',
      '3. Restart the application',
    ];
  }

  return [
    '1. Check your internet connection',
    '2. Verify repository access permissions',
    '3. Contact support if issue persists',
  ];
}
