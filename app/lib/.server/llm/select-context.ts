import type { UIMessage } from '@ai-sdk/ui-utils';
import { generateText, type GenerateTextResult } from 'ai';
import ignore from 'ignore';
import { IGNORE_PATTERNS, type FileMap } from './constants';
import { createFilesContext, extractCurrentContext, extractPropertiesFromMessage, simplifyBoltActions } from './utils';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { IProviderSetting } from '~/types/model';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';

// Common patterns to ignore, similar to .gitignore

const ig = ignore().add(IGNORE_PATTERNS);
const logger = createScopedLogger('select-context');

// Extract file paths from build/deploy error summaries (DeployAlert "Build error summary")
function parseBuildSummaryFiles(text: string): string[] {
  try {
    const lines = text.split(/\r?\n/);
    const results = new Set<string>();

    const fileLike =
      /^(?:\s*[-•]?\s*)?([^\s].*\.(?:tsx|ts|jsx|js|css|scss|json|md|mdx|html|vue|svelte|astro))(?::\d+(?::\d+)?)?/i;

    for (const line of lines) {
      const m = line.match(fileLike);

      if (m) {
        let p = m[1].trim();

        // Normalize backslashes and remove leading ./
        p = p.replace(/\\/g, '/').replace(/^\.\//, '');

        // Only accept src/* or app/* or top-level files
        if (/^(src|app)\//.test(p) || /^[^/]+\.(?:tsx|ts|jsx|js|css|scss|json|md|mdx|html)$/i.test(p)) {
          results.add(p);
        }
      }

      // Parse summary table lines like: "3  src/components/Foo.tsx:12"
      const tableMatch = line.match(/\b([\w./-]+\.(?:tsx|ts|jsx|js))(?::\d+)?\b/);

      if (tableMatch) {
        let p = tableMatch[1].replace(/^\.\//, '');
        p = p.replace(/\\/g, '/');

        if (/^(src|app)\//.test(p) || /^[^/]+\.(?:tsx|ts|jsx|js)$/i.test(p)) {
          results.add(p);
        }
      }
    }

    return Array.from(results);
  } catch {
    return [];
  }
}

export async function selectContext(props: {
  messages: UIMessage[];
  env?: Env;
  apiKeys?: Record<string, string>;
  files: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  summary: string;
  onFinish?: (resp: GenerateTextResult<Record<string, any>, never>) => void;
  onDebug?: (data: {
    candidates: Array<{
      path: string;
      score: number;
      reasons: { pathWeight: number; fileHitScore: number; relHitScore: number; contentHits: number };
    }>;
  }) => void;
  onSelected?: (data: {
    reasons: Array<{
      path: string;
      score: number;
      reasons: { pathWeight: number; fileHitScore: number; relHitScore: number; contentHits: number };
    }>;
  }) => void;
}) {
  const { messages, env: serverEnv, apiKeys, files, providerSettings, summary, onFinish } = props;

  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;

  const processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return {
        ...message,
        parts: message.parts?.map((part) => (part.type === 'text' ? { ...part, text: content } : part)) || [],
      };
    } else if (message.role == 'assistant') {
      const textContent = message.parts?.find((part) => part.type === 'text')?.text || '';

      let content = simplifyBoltActions(textContent);

      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');

      return {
        ...message,
        parts: message.parts?.map((part) => (part.type === 'text' ? { ...part, text: content } : part)) || [],
      };
    }

    return message;
  });

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);

  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw new Error(`No models found for provider ${provider.name}`);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      // Fallback to first model
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }

  const { codeContext } = extractCurrentContext(processedMessages);

  let filePaths = getFilePaths(files || {});
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  let context = '';

  const currrentFiles: string[] = [];
  const contextFiles: FileMap = {};

  if (codeContext?.type === 'codeContext') {
    const codeContextFiles: string[] = codeContext.files;
    Object.keys(files || {}).forEach((path) => {
      let relativePath = path;

      if (path.startsWith('/home/project/')) {
        relativePath = path.replace('/home/project/', '');
      }

      if (codeContextFiles.includes(relativePath)) {
        contextFiles[relativePath] = files[path];
        currrentFiles.push(relativePath);
      }
    });
    context = createFilesContext(contextFiles);
  }

  // Augment context with files referenced in DeployAlert build error summaries (if present in last user message)
  const __lastUserForSummary = processedMessages.filter((x) => x.role === 'user').pop();

  const __lastUserText = __lastUserForSummary?.parts
    ? __lastUserForSummary.parts.find((p) => p.type === 'text')?.text || ''
    : '';

  const deploySummaryFiles = __lastUserText ? parseBuildSummaryFiles(__lastUserText) : [];

  for (const relPath of deploySummaryFiles) {
    const fullPath = relPath.startsWith('/home/project/') ? relPath : `/home/project/${relPath}`;

    if (files[fullPath]) {
      contextFiles[relPath] = files[fullPath];
    }
  }

  if (deploySummaryFiles.length) {
    context = createFilesContext(contextFiles);
  }

  // If context optimization is disabled, skip LLM selection and return current contextFiles as-is
  if (props.contextOptimization === false) {
    return contextFiles;
  }

  const summaryText = `Here is the summary of the chat till now: ${summary}`;

  const extractTextContent = (message: UIMessage) =>
    message.parts ? message.parts.find((part) => part.type === 'text')?.text || '' : '';

  const lastUserMessage = processedMessages.filter((x) => x.role == 'user').pop();

  if (!lastUserMessage) {
    throw new Error('No user message found');
  }

  // Phase 2: rank and limit candidate files before asking the model
  const keywordize = (t: string) => {
    const tokens = (t || '')
      .toLowerCase()
      .replace(/[^a-z0-9_./-]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    return Array.from(new Set(tokens)).slice(0, 80); // cap to keep it light
  };

  const userText = extractTextContent(lastUserMessage);
  const allKeywords = Array.from(new Set([...keywordize(userText), ...keywordize(summaryText)]));

  const pathWeight = (rel: string) => {
    let w = 0;

    if (rel.startsWith('app/lib/.server/llm')) {
      w += 6;
    }

    if (rel.startsWith('app/components/')) {
      w += 4;
    }

    if (rel.startsWith('app/routes/')) {
      w += 3;
    }

    if (rel.startsWith('app/lib/')) {
      w += 3;
    }

    if (rel.startsWith('app/utils/')) {
      w += 2;
    }

    if (rel.startsWith('app/types/')) {
      w += 2;
    }

    if (/\.(tsx|ts|jsx|js|css|scss|md|mdx)$/i.test(rel)) {
      w += 1;
    }

    if (/(\.test\.|\.spec\.|\/__tests__\/)/i.test(rel)) {
      w -= 2;
    }

    return w;
  };

  const computeScore = (fullPath: string) => {
    const rel = fullPath.replace('/home/project/', '');
    const base = rel.split('/').pop() || rel;

    const pw = pathWeight(rel);

    let fileHitScore = 0;
    let relHitScore = 0;
    let exactPathScore = 0;

    for (const kw of allKeywords) {
      if (!kw) {
        continue;
      }

      if (base.includes(kw)) {
        fileHitScore += 3;
      }

      if (rel.includes(kw)) {
        relHitScore += 1;
      }

      if (kw.includes('.') && kw === rel) {
        exactPathScore += 20;
      } // exact file path mention
    }

    let contentHits = 0;

    const dirent = files[fullPath];

    if (dirent && dirent.type === 'file' && !dirent.isBinary) {
      const sample = dirent.content.slice(0, 2000).toLowerCase();

      for (const kw of allKeywords) {
        if (contentHits >= 10) {
          break;
        }

        if (kw.length >= 3 && sample.includes(kw)) {
          contentHits += 1;
        }
      }
    }

    const score = pw + fileHitScore + relHitScore + exactPathScore + contentHits;

    return { score, reasons: { pathWeight: pw, fileHitScore, relHitScore, contentHits }, rel };
  };

  // Rank and cap candidates
  filePaths = filePaths.sort((a, b) => computeScore(b).score - computeScore(a).score).slice(0, 200);

  // Emit candidate details (top 30) for debugging if requested
  if (props.onDebug) {
    try {
      const details = filePaths
        .map((fullPath) => {
          const { score, reasons, rel } = computeScore(fullPath);
          return { path: rel, score, reasons };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      props.onDebug({ candidates: details });
    } catch {
      // ignore debug emission errors
    }
  }

  // select files from the list of code file from the project that might be useful for the current request from the user
  const resp = await generateText({
    system: `
        You are a software engineer. You are working on a project. You have access to the following files:

        AVAILABLE FILES PATHS
        ---
        ${filePaths.map((path) => `- ${path}`).join('\n')}
        ---

        You have following code loaded in the context buffer that you can refer to:

        CURRENT CONTEXT BUFFER
        ---
        ${context}
        ---

        Now, you are given a task. You need to select the files that are relevant to the task from the list of files above.

        RESPONSE FORMAT:
        your response should be in following format:
---
<updateContextBuffer>
    <includeFile path="path/to/file"/>
    <excludeFile path="path/to/file"/>
</updateContextBuffer>
---
        * Your should start with <updateContextBuffer> and end with </updateContextBuffer>.
        * You can include multiple <includeFile> and <excludeFile> tags in the response.
        * You should not include any other text in the response.
        * You should not include any file that is not in the list of files above.
        * You should not include any file that is already in the context buffer.
        * If no changes are needed, you can leave the response empty updateContextBuffer tag.
        `,
    prompt: `
        ${summaryText}

        Users Question: ${extractTextContent(lastUserMessage)}

        update the context buffer with the files that are relevant to the task from the list of files above.

        CRITICAL RULES:
        * Only include relevant files in the context buffer.
        * context buffer should not include any file that is not in the list of files above.
        * context buffer is extremlly expensive, so only include files that are absolutely necessary.
        * If no changes are needed, you can leave the response empty updateContextBuffer tag.
        * Only 5 files can be placed in the context buffer at a time.
        * if the buffer is full, you need to exclude files that is not needed and include files that is relevent.

        `,
    model: provider.getModelInstance({
      model: currentModel,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
  });

  const response = resp.text;
  const updateContextBuffer = response.match(/<updateContextBuffer>([\s\S]*?)<\/updateContextBuffer>/);

  if (!updateContextBuffer) {
    throw new Error('Invalid response. Please follow the response format');
  }

  const includeFiles =
    updateContextBuffer[1]
      .match(/<includeFile path="(.*?)"/gm)
      ?.map((x) => x.replace('<includeFile path="', '').replace('"', '')) || [];
  const excludeFiles =
    updateContextBuffer[1]
      .match(/<excludeFile path="(.*?)"/gm)
      ?.map((x) => x.replace('<excludeFile path="', '').replace('"', '')) || [];

  const filteredFiles: FileMap = {};
  excludeFiles.forEach((path) => {
    delete contextFiles[path];
  });
  includeFiles.forEach((path) => {
    let fullPath = path;

    if (!path.startsWith('/home/project/')) {
      fullPath = `/home/project/${path}`;
    }

    if (!filePaths.includes(fullPath)) {
      logger.error(`File ${path} is not in the list of files above.`);
      return;

      // throw new Error(`File ${path} is not in the list of files above.`);
    }

    if (currrentFiles.includes(path)) {
      return;
    }

    filteredFiles[path] = files[fullPath];

    // Ensure files referenced in the build/deploy summary are included, unless explicitly excluded
    for (const relPath of deploySummaryFiles) {
      if (currrentFiles.includes(relPath)) {
        continue;
      } // already in buffer

      if (excludeFiles.includes(relPath)) {
        continue;
      } // user/model explicitly excluded

      if (filteredFiles[relPath]) {
        continue;
      } // already added

      const fullPath = relPath.startsWith('/home/project/') ? relPath : `/home/project/${relPath}`;

      if (files[fullPath]) {
        filteredFiles[relPath] = files[fullPath];
      }
    }
  });

  if (onFinish) {
    onFinish(resp);
  }

  const totalFiles = Object.keys(filteredFiles).length;
  logger.info(`Total files: ${totalFiles}`);

  if (totalFiles == 0) {
    throw new Error(`Bolt failed to select files`);
  }

  // Emit reasons for selected files for UI (Phase 4.1)
  if (props.onSelected) {
    try {
      const selectedReasons = Object.keys(filteredFiles).map((rel) => {
        const full = rel.startsWith('/home/project/') ? rel : `/home/project/${rel}`;
        const { score, reasons } = computeScore(full);

        return { path: rel, score, reasons };
      });
      props.onSelected({ reasons: selectedReasons });
    } catch {}
  }

  return filteredFiles;

  // generateText({
}

export function getFilePaths(files: FileMap) {
  let filePaths = Object.keys(files);
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  return filePaths;
}
