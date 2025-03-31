import { json, type ActionFunction } from '@remix-run/cloudflare';
import { isCloudEnvironment } from '~/lib/environment';
import { execCommand } from '~/lib/serverUtils';
import fs from 'fs/promises';
import path from 'path';

export const action: ActionFunction = async ({ request }) => {
  // If we're in a cloud environment, this operation is not relevant
  if (isCloudEnvironment()) {
    return json({ success: false, error: 'Cannot modify system PATH in cloud environments' }, { status: 400 });
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Only POST requests are allowed' }, { status: 405 });
  }

  try {
    // Check if Homebrew Git exists and isn't in PATH
    let homebrewGitExists = false;

    try {
      const { stdout } = await execCommand('ls /opt/homebrew/bin/git || ls /usr/local/bin/git');
      homebrewGitExists = !!stdout.trim();
    } catch {
      return json({ success: false, error: 'Could not find Homebrew Git installation' }, { status: 400 });
    }

    if (!homebrewGitExists) {
      return json({ success: false, error: 'Homebrew Git installation not found' }, { status: 400 });
    }

    // Determine which shell config file to modify
    let shellConfigFile = '';

    try {
      // Check which shell the user is using
      const { stdout: shellOutput } = await execCommand('echo $SHELL');
      const currentShell = shellOutput.trim();

      // Get user's home directory
      const { stdout: homeOutput } = await execCommand('echo $HOME');
      const homeDir = homeOutput.trim();

      if (currentShell.includes('zsh')) {
        shellConfigFile = path.join(homeDir, '.zshrc');
      } else if (currentShell.includes('bash')) {
        shellConfigFile = path.join(homeDir, '.bash_profile');

        // If .bash_profile doesn't exist, try .bashrc
        try {
          await fs.access(shellConfigFile);
        } catch {
          shellConfigFile = path.join(homeDir, '.bashrc');
        }
      } else {
        // Default to .profile for other shells
        shellConfigFile = path.join(homeDir, '.profile');
      }

      // Check if the file exists
      try {
        await fs.access(shellConfigFile);
      } catch {
        // Create the file if it doesn't exist
        await fs.writeFile(shellConfigFile, '# Shell configuration file\n\n', 'utf-8');
      }
    } catch (error) {
      return json(
        {
          success: false,
          error: `Could not determine shell configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 500 },
      );
    }

    // Add Homebrew to PATH in the shell config file
    try {
      // Check if the path is already in the file
      const { stdout: grepResult } = await execCommand(
        `grep -q "export PATH=\\"/opt/homebrew/bin:\\$PATH\\"" ${shellConfigFile} || echo "not found"`,
      );

      if (grepResult.includes('not found')) {
        // Append the PATH export to the file
        await execCommand(
          `echo '\n# Added by Bolt for Git integration\nexport PATH="/opt/homebrew/bin:$PATH"' >> ${shellConfigFile}`,
        );

        // Also execute it in the current environment
        await execCommand('export PATH="/opt/homebrew/bin:$PATH"');
      }
    } catch (error) {
      return json(
        {
          success: false,
          error: `Failed to update shell configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 500 },
      );
    }

    return json({
      success: true,
      message: 'PATH updated successfully! Please restart your terminal and the Bolt application.',
      shellConfigFile,
    });
  } catch (error) {
    console.error('Error fixing Git PATH:', error);

    return json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 },
    );
  }
};
