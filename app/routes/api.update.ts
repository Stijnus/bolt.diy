import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Execute git pull
    const { stdout: pullOutput, stderr: pullError } = await execAsync('git pull upstream main');

    if (pullError) {
      console.error('Git pull error:', pullError);
      return NextResponse.json({ error: 'Git pull failed' }, { status: 500 });
    }

    // Install dependencies
    const { stdout: installOutput, stderr: installError } = await execAsync('pnpm install');

    if (installError) {
      console.error('Dependencies installation error:', installError);
      return NextResponse.json({ error: 'Dependencies installation failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Update completed successfully',
      details: {
        pull: pullOutput,
        install: installOutput,
      },
    });
  } catch (error) {
    console.error('Update failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 },
    );
  }
}
