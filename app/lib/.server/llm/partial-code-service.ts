import { createScopedLogger } from '~/utils/logger';
import {
  CodeElementType,
  detectFileType,
  extractCodeElements,
  updateClass,
  updateFunction,
  updateMethod,
} from './partial-code-updater';
import { type FileMap } from './constants';

const logger = createScopedLogger('partial-code-service');

/**
 * Types of code update operations
 */
export enum UpdateOperationType {
  UpdateFunction = 'updateFunction',
  UpdateMethod = 'updateMethod',
  UpdateClass = 'updateClass',
  ReplaceFile = 'replaceFile', // Fallback for when partial updates aren't possible
}

/**
 * Represents a code update operation
 */
export interface CodeUpdateOperation {
  type: UpdateOperationType;
  filePath: string;
  targetName: string; // Function/method/class name
  parentName?: string; // For methods, the class they belong to
  newImplementation: string;
}

/**
 * Parse an AI response to extract code update operations
 */
export function parseCodeUpdateOperations(aiResponse: string): CodeUpdateOperation[] {
  const operations: CodeUpdateOperation[] = [];

  // Look for update function tags
  const updateFunctionRegex = /<updateFunction\s+file="([^"]+)"\s+name="([^"]+)">([\s\S]*?)<\/updateFunction>/g;
  let match;

  while ((match = updateFunctionRegex.exec(aiResponse)) !== null) {
    const [, filePath, functionName, newImplementation] = match;

    operations.push({
      type: UpdateOperationType.UpdateFunction,
      filePath,
      targetName: functionName,
      newImplementation,
    });
  }

  // Look for update method tags
  const updateMethodRegex =
    /<updateMethod\s+file="([^"]+)"\s+class="([^"]+)"\s+name="([^"]+)">([\s\S]*?)<\/updateMethod>/g;

  while ((match = updateMethodRegex.exec(aiResponse)) !== null) {
    const [, filePath, className, methodName, newImplementation] = match;

    operations.push({
      type: UpdateOperationType.UpdateMethod,
      filePath,
      targetName: methodName,
      parentName: className,
      newImplementation,
    });
  }

  // Look for update class tags
  const updateClassRegex = /<updateClass\s+file="([^"]+)"\s+name="([^"]+)">([\s\S]*?)<\/updateClass>/g;

  while ((match = updateClassRegex.exec(aiResponse)) !== null) {
    const [, filePath, className, newImplementation] = match;

    operations.push({
      type: UpdateOperationType.UpdateClass,
      filePath,
      targetName: className,
      newImplementation,
    });
  }

  // Look for replace file tags (fallback)
  const replaceFileRegex = /<replaceFile\s+file="([^"]+)">([\s\S]*?)<\/replaceFile>/g;

  while ((match = replaceFileRegex.exec(aiResponse)) !== null) {
    const [, filePath, newImplementation] = match;

    operations.push({
      type: UpdateOperationType.ReplaceFile,
      filePath,
      targetName: '', // Not applicable for file replacement
      newImplementation,
    });
  }

  return operations;
}

/**
 * Apply code update operations to files
 */
export function applyCodeUpdateOperations(operations: CodeUpdateOperation[], files: FileMap): FileMap {
  const updatedFiles: FileMap = { ...files };

  for (const operation of operations) {
    const { filePath, type, targetName, parentName, newImplementation } = operation;

    // Get the file content
    const file = updatedFiles[filePath];

    if (!file || file.type !== 'file') {
      logger.error(`File ${filePath} not found or is not a file`);
      continue;
    }

    const fileContent = (file as any).content || '';

    // Apply the operation based on its type
    let updatedContent = fileContent;

    try {
      switch (type) {
        case UpdateOperationType.UpdateFunction:
          updatedContent = updateFunction(fileContent, targetName, newImplementation, detectFileType(filePath));
          break;

        case UpdateOperationType.UpdateMethod:
          if (!parentName) {
            logger.error(`Parent class name is required for updating method ${targetName}`);
            continue;
          }

          updatedContent = updateMethod(
            fileContent,
            parentName,
            targetName,
            newImplementation,
            detectFileType(filePath),
          );
          break;

        case UpdateOperationType.UpdateClass:
          updatedContent = updateClass(fileContent, targetName, newImplementation, detectFileType(filePath));
          break;

        case UpdateOperationType.ReplaceFile:
          // Just replace the entire file content
          updatedContent = newImplementation;
          break;

        default:
          logger.error(`Unknown operation type: ${type}`);
          continue;
      }

      // Update the file content
      updatedFiles[filePath] = {
        ...file,
        content: updatedContent,
      };

      logger.info(`Successfully applied ${type} operation to ${filePath}`);
    } catch (error) {
      logger.error(`Error applying ${type} operation to ${filePath}:`, error);
    }
  }

  return updatedFiles;
}

/**
 * Analyze a file and extract its code structure
 */
export function analyzeFileStructure(filePath: string, fileContent: string) {
  try {
    const options = detectFileType(filePath);
    const elements = extractCodeElements(fileContent, options);

    // Group elements by type
    const functions = elements.filter((el) => el.type === CodeElementType.Function);
    const classes = elements.filter((el) => el.type === CodeElementType.Class);
    const methods = elements.filter((el) => el.type === CodeElementType.Method);

    return {
      filePath,
      functions: functions.map((f) => ({ name: f.name })),
      classes: classes.map((c) => ({ name: c.name })),
      methods: methods.map((m) => ({ name: m.name, parentName: m.parentName })),
    };
  } catch (error) {
    logger.error(`Error analyzing file structure for ${filePath}:`, error);
    return {
      filePath,
      functions: [],
      classes: [],
      methods: [],
    };
  }
}
