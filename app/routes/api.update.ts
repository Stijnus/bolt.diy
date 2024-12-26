import { exec } from 'child_process';
import { promisify } from 'util';
import { json } from '@remix-run/node';
import type { ActionFunction } from '@remix-run/node';

const execAsync = promisify(exec);

export const action: ActionFunction = async () => {
  try {
    // Get current branch
    const { stdout: branchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD');
    const currentBranch = branchOutput.trim();
    console.log('Current branch:', currentBranch);

    // Stash any changes
    await execAsync('git stash');
    console.log('Changes stashed');

    // Fetch latest changes from upstream
    const { stderr: fetchError } = await execAsync('git fetch upstream');

    if (fetchError) {
      console.error('Git fetch error:', fetchError);

      // Try to recover by popping the stash
      await execAsync('git stash pop');

      return json({ error: 'Git fetch failed: ' + fetchError }, { status: 500 });
    }

    console.log('Fetch completed successfully');

    // Configure git pull strategy based on branch
    if (currentBranch === 'main') {
      // On main branch - do a regular pull
      console.log('On main branch, using merge strategy');
      await execAsync('git config pull.rebase false'); // Use merge strategy for main

      // Pull from upstream main with merge
      const { stdout: pullOutput, stderr: pullError } = await execAsync('git pull upstream main');

      if (pullError && !pullError.includes('Already up to date')) {
        console.error('Git pull failed with error:', pullError);

        // Try to recover by popping the stash
        await execAsync('git stash pop');

        return json(
          {
            error: 'Git pull failed',
            details: {
              branch: currentBranch,
              error: pullError,
              output: pullOutput,
            },
          },
          { status: 500 },
        );
      }
    } else {
      // On feature branch - rebase on top of main
      console.log('On feature branch, using rebase strategy');
      await execAsync('git config pull.rebase true'); // Use rebase strategy for features

      // Pull from upstream main with rebase
      const { stdout: pullOutput, stderr: pullError } = await execAsync('git pull upstream main');

      if (pullError && !pullError.includes('Already up to date')) {
        console.error('Git pull failed with error:', pullError);

        // Try to recover by popping the stash
        await execAsync('git stash pop');

        return json(
          {
            error: 'Git pull failed',
            details: {
              branch: currentBranch,
              error: pullError,
              output: pullOutput,
            },
          },
          { status: 500 },
        );
      }
    }

    // Pop stashed changes
    try {
      await execAsync('git stash pop');
      console.log('Stashed changes reapplied');
    } catch (stashError) {
      console.warn('No stashed changes to apply or conflict occurred:', stashError);
    }

    // Install dependencies
    const { stdout: installOutput, stderr: installError } = await execAsync('pnpm install');

    if (installError) {
      console.error('Dependencies installation error:', installError);
      return json({ error: 'Dependencies installation failed: ' + installError }, { status: 500 });
    }

    return json({
      success: true,
      message: 'Update completed successfully',
      details: {
        branch: currentBranch,
        updateType: currentBranch === 'main' ? 'merge' : 'rebase',
        install: installOutput,
      },
    });
  } catch (error) {
    console.error('Update failed:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error,
      },
      { status: 500 },
    );
  }
};
