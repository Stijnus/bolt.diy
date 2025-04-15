import { lockedFilesAtom } from '~/lib/stores/workbench';
import { path } from '~/utils/path';

/**
 * FileLockAdvisor provides utilities to enhance LLM awareness of locked files
 * by generating contextual information and managing LLM interactions with locked files.
 */
export class FileLockAdvisor {
  /**
   * Generate a message about locked files for the LLM to include in system prompts
   */
  static generateLockedFilesMessage(): string {
    const lockedFiles = Array.from(lockedFilesAtom.get());

    if (lockedFiles.length === 0) {
      return '';
    }

    // Format paths to be user-friendly
    const formattedPaths = lockedFiles.map((path) => `- \`${path}\``).join('\n');

    return `
IMPORTANT: The following files are currently locked and protected from modifications:
${formattedPaths}

Please do not attempt to modify these files. If changes to these files are needed, 
please inform the user that they need to unlock the files first.
`;
  }

  /**
   * Add locked files information to the system prompt
   */
  static enhanceSystemPrompt(basePrompt: string): string {
    const lockedFilesMsg = this.generateLockedFilesMessage();

    if (!lockedFilesMsg) {
      return basePrompt;
    }

    return `${basePrompt}\n\n${lockedFilesMsg}`;
  }

  /**
   * Check if a file action would conflict with locked files
   */
  static checkActionForLockConflicts(fileActions: { filePath: string }[]): string[] {
    const lockedFiles = lockedFilesAtom.get();
    const lockedPaths = fileActions.map((a) => a.filePath).filter((path) => lockedFiles.has(path));

    return lockedPaths;
  }

  /**
   * Format a user-friendly message about locked files
   */
  static formatLockedFilesUserMessage(): string {
    const lockedFiles = Array.from(lockedFilesAtom.get());

    if (lockedFiles.length === 0) {
      return '';
    }

    // Format with just filenames to be more concise
    const fileNames = lockedFiles.map((filePath) => path.basename(filePath));

    if (fileNames.length === 1) {
      return `Note: The file "${fileNames[0]}" is locked and cannot be modified by AI.`;
    } else {
      const fileList = fileNames.map((name) => `"${name}"`).join(', ');
      return `Note: The following files are locked and cannot be modified by AI: ${fileList}`;
    }
  }

  /**
   * Prepare context object with locked files information for LLM
   */
  static prepareContext(): Record<string, any> {
    const lockedFiles = Array.from(lockedFilesAtom.get());
    return {
      lockedFiles,
      hasLockedFiles: lockedFiles.length > 0,
      lockedFilesCount: lockedFiles.length,
    };
  }
}
