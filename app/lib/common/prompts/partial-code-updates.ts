import { WORK_DIR } from '~/utils/constants';

/**
 * Extension to the system prompt that adds instructions for partial code updates
 */
export const getPartialCodeUpdatePrompt = (cwd: string = WORK_DIR) => `
<partial_code_updates>
  When modifying existing code files, you should use partial code updates instead of rewriting the entire file whenever possible. This approach is more efficient and reduces the risk of introducing errors in unchanged parts of the code.

  Follow these guidelines for partial code updates:

  1. For function updates, use the following format:
     <updateFunction file="path/to/file.ts" name="functionName">
     // New function implementation
     function functionName(param1, param2) {
       // Updated code here
     }
     </updateFunction>

  2. For method updates within a class, use:
     <updateMethod file="path/to/file.ts" class="ClassName" name="methodName">
     // New method implementation
     methodName(param1, param2) {
       // Updated code here
     }
     </updateMethod>

  3. For class updates, use:
     <updateClass file="path/to/file.ts" name="ClassName">
     // New class implementation
     class ClassName {
       // Updated code here
     }
     </updateClass>

  4. Only as a fallback when partial updates aren't possible, use:
     <replaceFile file="path/to/file.ts">
     // Entire file content
     </replaceFile>

  IMPORTANT RULES:
  - Always analyze the file structure first to identify functions, methods, and classes
  - Only update the specific code elements that need to change
  - Preserve the exact signature (parameters, return type) of functions and methods
  - Include the complete implementation of the updated element
  - Use the fallback full file replacement only when necessary
  - All file paths should be relative to the current working directory: ${cwd}
  - Make sure to include all necessary imports and dependencies in partial updates

  Example of good partial update:
  
  <updateFunction file="src/utils/formatter.ts" name="formatDate">
  function formatDate(date: Date, format: string = 'yyyy-MM-dd'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (format === 'yyyy-MM-dd') {
      return \`\${year}-\${month}-\${day}\`;
    } else if (format === 'MM/dd/yyyy') {
      return \`\${month}/\${day}/\${year}\`;
    } else {
      return date.toLocaleDateString();
    }
  }
  </updateFunction>
</partial_code_updates>
`;
