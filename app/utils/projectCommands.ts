import type { UIMessage } from 'ai';
import { generateId } from './fileUtils';

export interface ProjectCommands {
  type: string;
  setupCommand?: string;
  startCommand?: string;
  followupMessage: string;
}

interface FileContent {
  content: string;
  path: string;
}

// Helper function to make any command non-interactive
function makeNonInteractive(command: string): string {
  // Set environment variables for non-interactive mode
  const envVars = 'export CI=true DEBIAN_FRONTEND=noninteractive FORCE_COLOR=0';

  // Common interactive packages and their non-interactive flags
  const interactivePackages = [
    { pattern: /npx\s+([^@\s]+@?[^\s]*)\s+init/g, replacement: 'npx $1 init --defaults --yes' },
    { pattern: /npx\s+create-([^\s]+)/g, replacement: 'npx --yes create-$1 --template default' },
    { pattern: /npx\s+([^@\s]+@?[^\s]*)\s+add/g, replacement: 'npx --yes $1 add --defaults --yes' },
    { pattern: /npm\s+install(?!\s+--)/g, replacement: 'npm install' },
    { pattern: /yarn\s+add(?!\s+--)/g, replacement: 'yarn add --non-interactive' },
    { pattern: /pnpm\s+add(?!\s+--)/g, replacement: 'pnpm add --yes' },
  ];

  let processedCommand = command;

  // Apply replacements for known interactive patterns
  interactivePackages.forEach(({ pattern, replacement }) => {
    processedCommand = processedCommand.replace(pattern, replacement);
  });

  return `${envVars} && ${processedCommand}`;
}

export async function detectProjectCommands(files: FileContent[]): Promise<ProjectCommands> {
  const hasFile = (name: string) => files.some((f) => f.path.endsWith(name));

  if (hasFile('package.json')) {
    const packageJsonFile = files.find((f) => f.path.endsWith('package.json'));

    if (!packageJsonFile) {
      return { type: '', setupCommand: '', followupMessage: '' };
    }

    const setupCommand = makeNonInteractive('npm install');

    return {
      type: 'Node.js',
      setupCommand,
      followupMessage: 'Installing dependencies from package.json.',
    };
  }

  if (hasFile('index.html')) {
    return {
      type: 'Static',
      startCommand: 'npx --yes serve',
      followupMessage: '',
    };
  }

  return { type: '', setupCommand: '', followupMessage: '' };
}

export function createCommandsMessage(commands: ProjectCommands): UIMessage | null {
  if (!commands.setupCommand && !commands.startCommand) {
    return null;
  }

  let commandString = '';

  if (commands.setupCommand) {
    commandString += `
<boltAction type="shell">${commands.setupCommand}</boltAction>`;
  }

  if (commands.startCommand) {
    commandString += `
<boltAction type="start">${commands.startCommand}</boltAction>
`;
  }

  const text = `${commands.followupMessage ? `\n\n${commands.followupMessage}` : ''}
<boltArtifact id="project-setup" title="Project Setup">
${commandString}
</boltArtifact>`;

  return {
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text,
      },
    ],
    id: generateId(),
  };
}

export function escapeBoltArtifactTags(input: string) {
  // Regular expression to match boltArtifact tags and their content
  const regex = /(<boltArtifact[^>]*>)([\s\S]*?)(<\/boltArtifact>)/g;

  return input.replace(regex, (match, openTag, content, closeTag) => {
    // Escape the opening tag
    const escapedOpenTag = openTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Escape the closing tag
    const escapedCloseTag = closeTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Return the escaped version
    return `${escapedOpenTag}${content}${escapedCloseTag}`;
  });
}

export function escapeBoltAActionTags(input: string) {
  // Regular expression to match boltArtifact tags and their content
  const regex = /(<boltAction[^>]*>)([\s\S]*?)(<\/boltAction>)/g;

  return input.replace(regex, (match, openTag, content, closeTag) => {
    // Escape the opening tag
    const escapedOpenTag = openTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Escape the closing tag
    const escapedCloseTag = closeTag.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Return the escaped version
    return `${escapedOpenTag}${content}${escapedCloseTag}`;
  });
}

export function escapeBoltTags(input: string) {
  return escapeBoltArtifactTags(escapeBoltAActionTags(input));
}

// We have this seperate function to simplify the restore snapshot process in to one single artifact.
export function createCommandActionsString(commands: ProjectCommands): string {
  if (!commands.setupCommand && !commands.startCommand) {
    // Return empty string if no commands
    return '';
  }

  let commandString = '';

  if (commands.setupCommand) {
    commandString += `
<boltAction type="shell">${commands.setupCommand}</boltAction>`;
  }

  if (commands.startCommand) {
    commandString += `
<boltAction type="start">${commands.startCommand}</boltAction>
`;
  }

  return commandString;
}
