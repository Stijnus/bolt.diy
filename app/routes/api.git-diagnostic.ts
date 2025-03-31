import { json, type LoaderFunction } from '@remix-run/cloudflare';
import { isCloudEnvironment } from '~/lib/environment';
import { diagnoseGitIssues } from '~/lib/serverUtils';

export const loader: LoaderFunction = async ({ request: _ }) => {
  // If we're in a cloud environment, Git availability is not relevant
  if (isCloudEnvironment()) {
    return json({
      inCloud: true,
      possibleSolutions: [
        'Git operations are not available in cloud environments.',
        'To use Git, run Bolt locally on your machine.',
      ],
    });
  }

  try {
    // First run the normal Git diagnostics
    const diagnostics = await diagnoseGitIssues();

    // If Git is not detected, try with our ultimate fallback method
    if (!diagnostics.isGitInstalled) {
      try {
        // Try with direct sync method as absolute last resort
        const { execSync } = await import('child_process');

        try {
          // Get current working directory
          let workingDir;

          try {
            workingDir = execSync('pwd', { encoding: 'utf8' }).trim();
          } catch {
            // Use default working dir if we can't get it
            workingDir = process.cwd();
          }

          // Try direct homebrew Git path that we know works
          const stdout = execSync('/opt/homebrew/bin/git --version', {
            encoding: 'utf8',
            cwd: workingDir,
          });

          if (stdout && stdout.trim().toLowerCase().includes('git version')) {
            diagnostics.gitVersion = stdout.trim();
            diagnostics.isGitInstalled = true;

            // Also try to check if it's a Git repo
            try {
              execSync('/opt/homebrew/bin/git rev-parse --is-inside-work-tree', {
                encoding: 'utf8',
                cwd: workingDir,
              });
              diagnostics.isGitRepo = true;

              // Check for origin remote
              try {
                const remotesOutput = execSync('/opt/homebrew/bin/git remote -v', {
                  encoding: 'utf8',
                  cwd: workingDir,
                });
                diagnostics.hasOriginRemote = remotesOutput.includes('origin');
              } catch {
                // Not critical if we can't check remotes
              }
            } catch {
              // Not a Git repo
              diagnostics.isGitRepo = false;
            }

            // Add the solution message about PATH
            diagnostics.possibleSolutions = [
              'Git is installed but there seems to be a PATH issue. The application is using a direct execution method as a fallback.',
              'For a permanent fix, add the Git directory to your PATH environment variable.',
              'On macOS: Add "export PATH="/opt/homebrew/bin:$PATH"" to your ~/.zshrc or ~/.bash_profile',
              'Then restart your terminal and the application.',
            ];
          }
        } catch (error) {
          console.error('Direct Git exec error:', error);

          // If this fails, stick with the original diagnostics
        }
      } catch (importError) {
        console.error('Error importing child_process:', importError);

        // Continue with original diagnostics
      }
    }

    return json({
      inCloud: false,
      ...diagnostics,
    });
  } catch (error) {
    console.error('Error running Git diagnostics:', error);

    return json({
      inCloud: false,
      isGitInstalled: false,
      isGitRepo: false,
      hasOriginRemote: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during Git diagnostics',
      possibleSolutions: [
        'Verify Git is installed correctly: git --version',
        'Make sure Git is in your system PATH',
        'If this is not a Git repository: git init',
        'Add GitHub as remote: git remote add origin https://github.com/stackblitz-labs/bolt.diy.git',
        'Restart Bolt after making changes',
      ],
    });
  }
};
