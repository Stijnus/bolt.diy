import { createScopedLogger } from '~/utils/logger';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { diff_match_patch } from 'diff-match-patch';

const logger = createScopedLogger('partial-code-updater');

/**
 * Types of code elements that can be extracted and modified
 */
export enum CodeElementType {
  Function = 'function',
  Method = 'method',
  Class = 'class',
  Interface = 'interface',
  Type = 'type',
  Variable = 'variable',
  Import = 'import',
  Export = 'export',
  Unknown = 'unknown',
}

/**
 * Represents a code element that can be extracted and modified
 */
export interface CodeElement {
  type: CodeElementType;
  name: string;
  content: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  parentName?: string; // For methods, the class they belong to
}

/**
 * Options for parsing code
 */
export interface ParseOptions {
  typescript?: boolean;
  jsx?: boolean;
}

/**
 * Options for applying code updates
 */
export interface UpdateOptions {
  validateSyntax?: boolean;
  createBackup?: boolean;
}

/**
 * Parse code and extract all code elements
 */
export function extractCodeElements(code: string, options: ParseOptions = {}): CodeElement[] {
  const elements: CodeElement[] = [];

  try {
    // Determine parser plugins based on options and file extension
    const plugins: parser.ParserPlugin[] = [];

    if (options.typescript) {
      plugins.push('typescript');
    }

    if (options.jsx) {
      plugins.push('jsx');
    }

    // Add commonly needed plugins
    plugins.push('classProperties');
    plugins.push('decorators-legacy');

    // Parse the code
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins,
    });

    // Extract line numbers for each node
    const lines = code.split('\n');

    // Traverse the AST to find code elements
    traverse(ast, {
      FunctionDeclaration(path) {
        const node = path.node;

        if (node.id && node.id.name) {
          const name = node.id.name;
          const { start, end } = node.loc || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };

          // Extract the function content from the original code
          const startLine = start.line;
          const endLine = end.line;
          const content = lines.slice(startLine - 1, endLine).join('\n');

          elements.push({
            type: CodeElementType.Function,
            name,
            content,
            startLine,
            endLine,
            startColumn: start.column,
            endColumn: end.column,
          });
        }
      },

      ClassDeclaration(path) {
        const node = path.node;

        if (node.id && node.id.name) {
          const name = node.id.name;
          const { start, end } = node.loc || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };

          // Extract the class content from the original code
          const startLine = start.line;
          const endLine = end.line;
          const content = lines.slice(startLine - 1, endLine).join('\n');

          elements.push({
            type: CodeElementType.Class,
            name,
            content,
            startLine,
            endLine,
            startColumn: start.column,
            endColumn: end.column,
          });

          // Extract class methods
          node.body.body.forEach((member) => {
            if (t.isClassMethod(member) && member.key && t.isIdentifier(member.key)) {
              const methodName = member.key.name;
              const { start: methodStart, end: methodEnd } = member.loc || {
                start: { line: 0, column: 0 },
                end: { line: 0, column: 0 },
              };

              const methodStartLine = methodStart.line;
              const methodEndLine = methodEnd.line;
              const methodContent = lines.slice(methodStartLine - 1, methodEndLine).join('\n');

              elements.push({
                type: CodeElementType.Method,
                name: methodName,
                content: methodContent,
                startLine: methodStartLine,
                endLine: methodEndLine,
                startColumn: methodStart.column,
                endColumn: methodEnd.column,
                parentName: name,
              });
            }
          });
        }
      },

      VariableDeclaration(path) {
        path.node.declarations.forEach((declaration) => {
          if (t.isIdentifier(declaration.id)) {
            const name = declaration.id.name;
            const { start, end } = path.node.loc || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };

            // Extract the variable content from the original code
            const startLine = start.line;
            const endLine = end.line;
            const content = lines.slice(startLine - 1, endLine).join('\n');

            // Check if it's an arrow function
            if (
              declaration.init &&
              (t.isArrowFunctionExpression(declaration.init) || t.isFunctionExpression(declaration.init))
            ) {
              elements.push({
                type: CodeElementType.Function,
                name,
                content,
                startLine,
                endLine,
                startColumn: start.column,
                endColumn: end.column,
              });
            } else {
              elements.push({
                type: CodeElementType.Variable,
                name,
                content,
                startLine,
                endLine,
                startColumn: start.column,
                endColumn: end.column,
              });
            }
          }
        });
      },
    });

    return elements;
  } catch (error) {
    logger.error('Error parsing code:', error);
    return [];
  }
}

/**
 * Find a specific code element by name and type
 */
export function findCodeElement(
  code: string,
  name: string,
  type: CodeElementType,
  options: ParseOptions = {},
): CodeElement | null {
  const elements = extractCodeElements(code, options);
  return elements.find((element) => element.name === name && element.type === type) || null;
}

/**
 * Replace a specific code element in the source code
 */
export function replaceCodeElement(sourceCode: string, element: CodeElement, newImplementation: string): string {
  const lines = sourceCode.split('\n');

  // Replace the element with the new implementation
  const beforeLines = lines.slice(0, element.startLine - 1);
  const afterLines = lines.slice(element.endLine);

  return [...beforeLines, newImplementation, ...afterLines].join('\n');
}

/**
 * Generate a diff between original and modified code
 */
export function generateDiff(originalCode: string, modifiedCode: string): string {
  const dmp = new diff_match_patch();
  const diff = dmp.diff_main(originalCode, modifiedCode);
  dmp.diff_cleanupSemantic(diff);

  return dmp.diff_prettyHtml(diff);
}

/**
 * Apply a diff patch to original code
 */
export function applyDiff(originalCode: string, patch: string): string {
  const dmp = new diff_match_patch();
  const patches = dmp.patch_fromText(patch);

  // We only need the result, not the applied patches info
  const [result] = dmp.patch_apply(patches, originalCode);

  return result;
}

/**
 * Update a specific function in a file
 */
export function updateFunction(
  sourceCode: string,
  functionName: string,
  newImplementation: string,
  options: ParseOptions = {},
): string {
  const element = findCodeElement(sourceCode, functionName, CodeElementType.Function, options);

  if (!element) {
    logger.error(`Function ${functionName} not found in the source code`);
    return sourceCode;
  }

  return replaceCodeElement(sourceCode, element, newImplementation);
}

/**
 * Update a specific method in a class
 */
export function updateMethod(
  sourceCode: string,
  className: string,
  methodName: string,
  newImplementation: string,
  options: ParseOptions = {},
): string {
  const elements = extractCodeElements(sourceCode, options);
  const method = elements.find(
    (element) =>
      element.type === CodeElementType.Method && element.name === methodName && element.parentName === className,
  );

  if (!method) {
    logger.error(`Method ${methodName} in class ${className} not found in the source code`);
    return sourceCode;
  }

  return replaceCodeElement(sourceCode, method, newImplementation);
}

/**
 * Update a specific class in a file
 */
export function updateClass(
  sourceCode: string,
  className: string,
  newImplementation: string,
  options: ParseOptions = {},
): string {
  const element = findCodeElement(sourceCode, className, CodeElementType.Class, options);

  if (!element) {
    logger.error(`Class ${className} not found in the source code`);
    return sourceCode;
  }

  return replaceCodeElement(sourceCode, element, newImplementation);
}

/**
 * Detect file type from file path
 */
export function detectFileType(filePath: string): ParseOptions {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';

  const options: ParseOptions = {
    typescript: false,
    jsx: false,
  };

  switch (extension) {
    case 'ts':
      options.typescript = true;
      break;
    case 'tsx':
      options.typescript = true;
      options.jsx = true;
      break;
    case 'jsx':
      options.jsx = true;
      break;
    default:
      // Default to JavaScript
      break;
  }

  return options;
}
