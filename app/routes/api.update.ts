import { exec } from 'child_process';
import { promisify } from 'util';
import { json } from '@remix-run/node';
import type { ActionFunction } from '@remix-run/node';

const execAsync = promisify(exec);

export const action: ActionFunction = async () => {
  try {
    // Execute git pull
    const { stdout: pullOutput, stderr: pullError } = await execAsync('git pull upstream main');

    if (pullError) {
      console.error('Git pull error:', pullError);
      return json({ error: 'Git pull failed' }, { status: 500 });
    }

    // Install dependencies
    const { stdout: installOutput, stderr: installError } = await execAsync('pnpm install');

    if (installError) {
      console.error('Dependencies installation error:', installError);
      return json({ error: 'Dependencies installation failed' }, { status: 500 });
    }

    return json({
      success: true,
      message: 'Update completed successfully',
      details: {
        pull: pullOutput,
        install: installOutput,
      },
    });
  } catch (error) {
    console.error('Update failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error occurred' }, { status: 500 });
  }
};
