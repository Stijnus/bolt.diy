import React, { useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Button } from '~/components/ui/Button';
import { Dialog, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';

// import { Textarea } from '~/components/ui/Textarea';
import { Label } from '~/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Save, Loader2, FileText, Sparkles } from 'lucide-react';

// import { PromptLibrary } from '~/lib/common/prompt-library';
import { toast } from 'react-toastify';

interface CustomPromptCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptCreated?: () => void;
}

const TOKEN_USAGE_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

const COMPLEXITY_OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

const PROMPT_TEMPLATES = [
  {
    id: 'code-review',
    name: 'Code Review Assistant',
    description: 'Help review code for best practices, bugs, and improvements',
    content: `You are an expert code reviewer. Your task is to analyze the provided code and provide constructive feedback.

Please review the following code for:

1. **Code Quality & Best Practices**
   - Code readability and maintainability
   - Naming conventions
   - Code structure and organization
   - Documentation and comments

2. **Functionality & Logic**
   - Correctness of the implementation
   - Edge cases handling
   - Error handling
   - Performance considerations

3. **Security Considerations**
   - Potential security vulnerabilities
   - Input validation
   - Data sanitization

4. **Recommendations**
   - Suggested improvements
   - Alternative approaches
   - Best practices to follow

Please provide specific, actionable feedback with examples where appropriate. Be constructive and explain the reasoning behind your suggestions.`,
    features: 'Code Analysis, Best Practices, Bug Detection, Performance Review, Security Audit',
    bestFor: 'Code Reviews, Pull Request Reviews, Quality Assurance',
    tokenUsage: 'medium' as const,
    complexity: 'moderate' as const,
  },
  {
    id: 'bug-fixer',
    name: 'Bug Fix Assistant',
    description: 'Debug and fix code issues efficiently',
    content: `You are an expert debugger and bug fixer. Your task is to identify and fix issues in the provided code.

**Analysis Process:**
1. **Understand the Problem**
   - Review the error message/symptoms
   - Examine the code structure
   - Identify potential root causes

2. **Debug the Issue**
   - Trace the code execution path
   - Check variable values and state
   - Test hypotheses systematically

3. **Implement the Fix**
   - Apply the most appropriate solution
   - Ensure the fix doesn't break existing functionality
   - Add necessary error handling

4. **Verify the Solution**
   - Test the fix thoroughly
   - Consider edge cases
   - Document the changes made

**Guidelines:**
- Explain the root cause clearly
- Provide the corrected code with explanations
- Suggest preventive measures for similar issues
- Consider performance and maintainability implications`,
    features: 'Debugging, Error Analysis, Code Fixes, Root Cause Analysis',
    bestFor: 'Bug Fixes, Error Resolution, Code Debugging',
    tokenUsage: 'medium' as const,
    complexity: 'moderate' as const,
  },
  {
    id: 'refactor',
    name: 'Code Refactoring Assistant',
    description: 'Help improve code structure and maintainability',
    content: `You are a code refactoring expert. Your task is to improve the structure, readability, and maintainability of the provided code while preserving its functionality.

**Refactoring Focus Areas:**

1. **Code Structure**
   - Break down large functions into smaller, focused ones
   - Extract reusable components and utilities
   - Improve class/method organization

2. **Readability & Clarity**
   - Use descriptive variable and function names
   - Add meaningful comments and documentation
   - Simplify complex expressions and logic

3. **Performance Optimizations**
   - Identify and eliminate unnecessary computations
   - Optimize data structures and algorithms
   - Reduce memory usage where possible

4. **Best Practices**
   - Apply SOLID principles
   - Implement proper error handling
   - Use appropriate design patterns

5. **Modern Language Features**
   - Utilize latest language features when beneficial
   - Update deprecated patterns
   - Improve type safety

**Requirements:**
- Maintain exact same functionality
- Improve testability and maintainability
- Provide clear explanations for each change
- Consider backward compatibility`,
    features: 'Code Structure, Performance, Best Practices, Modern Patterns',
    bestFor: 'Code Refactoring, Legacy Code, Code Cleanup',
    tokenUsage: 'high' as const,
    complexity: 'advanced' as const,
  },
  {
    id: 'api-design',
    name: 'API Design Assistant',
    description: 'Help design robust and scalable APIs',
    content: `You are an API design expert specializing in RESTful and modern API development. Your task is to help design, review, or improve API interfaces.

**API Design Principles:**

1. **RESTful Design**
   - Proper HTTP methods (GET, POST, PUT, DELETE, PATCH)
   - Meaningful resource naming and URIs
   - Appropriate status codes and responses

2. **Data Structure & Validation**
   - Clear request/response schemas
   - Input validation and sanitization
   - Error handling and messaging

3. **Security & Authentication**
   - Authentication mechanisms
   - Authorization strategies
   - Rate limiting and abuse prevention

4. **Documentation & Usability**
   - Clear API documentation
   - Consistent response formats
   - Developer-friendly error messages

5. **Performance & Scalability**
   - Efficient data retrieval
   - Caching strategies
   - Pagination and filtering

**Review Checklist:**
- [ ] Resource naming follows REST conventions
- [ ] HTTP methods used appropriately
- [ ] Request/response schemas are well-defined
- [ ] Error handling is comprehensive
- [ ] Authentication/authorization is secure
- [ ] API is versioned appropriately
- [ ] Documentation is complete and accurate

Provide specific recommendations with examples for improvement.`,
    features: 'REST Design, API Security, Documentation, Performance',
    bestFor: 'API Development, Backend Design, System Architecture',
    tokenUsage: 'high' as const,
    complexity: 'advanced' as const,
  },
  {
    id: 'testing',
    name: 'Testing Assistant',
    description: 'Help create comprehensive test suites',
    content: `You are a testing expert. Your task is to help create comprehensive, maintainable test suites for the provided code.

**Testing Strategy:**

1. **Unit Tests**
   - Test individual functions and methods
   - Mock external dependencies
   - Cover edge cases and error conditions

2. **Integration Tests**
   - Test component interactions
   - Verify data flow between modules
   - Test API endpoints and database operations

3. **Test Coverage**
   - Identify untested code paths
   - Ensure critical business logic is covered
   - Maintain high coverage percentages

4. **Test Quality**
   - Write descriptive test names
   - Use appropriate assertions
   - Test both positive and negative scenarios

**Testing Best Practices:**
- Use descriptive test names that explain the behavior being tested
- Follow AAA pattern (Arrange, Act, Assert)
- Test one thing per test case
- Use test doubles for external dependencies
- Test error conditions and edge cases
- Keep tests fast and reliable

**Test Categories to Consider:**
- Happy path scenarios
- Error conditions
- Edge cases
- Performance under load
- Security vulnerabilities
- Data validation

Provide complete test examples with explanations.`,
    features: 'Unit Testing, Integration Testing, Test Coverage, Test Quality',
    bestFor: 'Test Development, Quality Assurance, CI/CD',
    tokenUsage: 'medium' as const,
    complexity: 'moderate' as const,
  },
  {
    id: 'documentation',
    name: 'Documentation Assistant',
    description: 'Help create clear and comprehensive documentation',
    content: `You are a technical documentation expert. Your task is to create clear, comprehensive documentation for code, APIs, or systems.

**Documentation Types:**

1. **Code Documentation**
   - Function/method documentation
   - Class and module descriptions
   - Inline comments and code explanations

2. **API Documentation**
   - Endpoint descriptions and usage
   - Request/response examples
   - Authentication requirements

3. **User Guides**
   - Installation and setup instructions
   - Feature explanations
   - Troubleshooting guides

4. **Architecture Documentation**
   - System overview and design decisions
   - Component relationships
   - Data flow diagrams

**Documentation Standards:**
- Use clear, concise language
- Provide practical examples
- Include code snippets where helpful
- Explain concepts before diving into details
- Use consistent formatting and structure

**Essential Sections:**
- Overview/Purpose
- Prerequisites/Requirements
- Installation/Setup
- Usage Examples
- Configuration Options
- Troubleshooting
- API Reference
- Contributing Guidelines

Ensure documentation is accessible to both beginners and experienced developers.`,
    features: 'Technical Writing, API Docs, User Guides, Code Comments',
    bestFor: 'Documentation, Developer Onboarding, API Publishing',
    tokenUsage: 'low' as const,
    complexity: 'simple' as const,
  },
] as const;

export const CustomPromptCreationDialog = ({ isOpen, onClose, onPromptCreated }: CustomPromptCreationDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<{
    label: string;
    description: string;
    content: string;
    features: string;
    bestFor: string;
    tokenUsage: 'low' | 'medium' | 'high';
    complexity: 'simple' | 'moderate' | 'advanced';
  }>({
    label: '',
    description: '',
    content: '',
    features: '',
    bestFor: '',
    tokenUsage: 'medium',
    complexity: 'moderate',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTemplates, setShowTemplates] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSelectChange = (field: string) => (value: string) => {
    handleInputChange(field, value);
  };

  const handleTemplateSelect = (template: (typeof PROMPT_TEMPLATES)[number]) => {
    setFormData({
      label: template.name,
      description: template.description,
      content: template.content,
      features: template.features,
      bestFor: template.bestFor,
      tokenUsage: template.tokenUsage,
      complexity: template.complexity,
    });
    setErrors({});
    setShowTemplates(false);
    toast.success(`Template "${template.name}" loaded!`);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.label.trim()) {
      newErrors.label = 'Label is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Prompt content is required';
    }

    if (formData.label.length > 50) {
      newErrors.label = 'Label must be less than 50 characters';
    }

    if (formData.description.length > 200) {
      newErrors.description = 'Description must be less than 200 characters';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setIsLoading(true);

    try {
      // Parse comma-separated strings into arrays
      const features = formData.features
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      const bestFor = formData.bestFor
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      const promptData = {
        label: formData.label.trim(),
        description: formData.description.trim(),
        content: formData.content.trim(),
        features,
        bestFor,
        tokenUsage: formData.tokenUsage,
        complexity: formData.complexity,
      };

      /*
       * TODO: Implement createCustomPrompt method in PromptLibrary
       * const newPrompt = PromptLibrary.createCustomPrompt(promptData);
       */
      console.log('Custom prompt data:', promptData);

      // For now, just show a success message
      console.log('Custom prompt would be created here');

      // toast.success(`Custom prompt created successfully!`);
      onPromptCreated?.();
      handleClose();
    } catch (error) {
      console.error('Error creating custom prompt:', error);
      toast.error('An error occurred while creating the prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        label: '',
        description: '',
        content: '',
        features: '',
        bestFor: '',
        tokenUsage: 'medium' as const,
        complexity: 'moderate' as const,
      });
      setErrors({});
      setShowTemplates(false);
      onClose();
    }
  };

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={handleClose}>
      <Dialog showCloseButton={false}>
        <div className="p-6 bg-bolt-elements-background-depth-1 relative z-10 max-h-[80vh] overflow-y-auto overflow-x-visible">
          <DialogTitle className="mb-2">Create Custom Prompt</DialogTitle>
          <DialogDescription className="mb-6">
            Create a custom AI prompt template for your specific workflow needs.
          </DialogDescription>

          <div className="space-y-6">
            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label" className="text-bolt-elements-textPrimary">
                Prompt Name *
              </Label>
              <Input
                id="label"
                placeholder="e.g., Code Review Assistant"
                value={formData.label}
                onChange={(e) => handleInputChange('label', e.target.value)}
                className={errors.label ? 'border-red-500 focus:border-red-500' : ''}
              />
              {errors.label && <p className="text-sm text-red-500">{errors.label}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-bolt-elements-textPrimary">
                Description *
              </Label>
              <textarea
                id="description"
                placeholder="Describe what this prompt does and when to use it..."
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  handleInputChange('description', e.target.value)
                }
                rows={3}
                className={`w-full px-3 py-2 rounded-md border bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary placeholder-bolt-elements-textSecondary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus resize-vertical ${errors.description ? 'border-red-500 focus:border-red-500' : 'border-bolt-elements-borderColor'}`}
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>

            {/* Template Button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-2 text-bolt-elements-textPrimary border-bolt-elements-border hover:bg-bolt-elements-background-depth-2"
              >
                <Sparkles className="w-4 h-4" />
                {showTemplates ? 'Hide Templates' : 'Use Template'}
                <FileText className="w-4 h-4" />
              </Button>
            </div>

            {/* Template Selection */}
            {showTemplates && (
              <div className="space-y-3 p-4 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-bg-depth-2 rounded-md border border-bolt-elements-border">
                <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Choose a Template</h3>
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                  {PROMPT_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="text-left p-3 rounded-md border border-bolt-elements-border bg-bolt-elements-background hover:bg-bolt-elements-background-depth-2 dark:hover:bg-bolt-elements-bg-depth-4 transition-colors group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-bolt-elements-textPrimary group-hover:text-bolt-elements-item-contentAccent">
                            {template.name}
                          </h4>
                          <p className="text-sm text-bolt-elements-textSecondary mt-1">{template.description}</p>
                        </div>
                        <div className="ml-3 flex flex-col items-end text-xs text-bolt-elements-textTertiary">
                          <span className="px-2 py-1 bg-bolt-elements-background-depth-3 dark:bg-bolt-elements-bg-depth-3 rounded">
                            {template.tokenUsage}
                          </span>
                          <span className="px-2 py-1 bg-bolt-elements-background-depth-3 dark:bg-bolt-elements-bg-depth-3 rounded mt-1">
                            {template.complexity}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content" className="text-bolt-elements-textPrimary">
                Prompt Content *
              </Label>
              <textarea
                id="content"
                placeholder="Write your custom prompt content here. Include instructions, context, and examples..."
                value={formData.content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('content', e.target.value)}
                rows={8}
                className={`w-full px-3 py-2 rounded-md border bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary placeholder-bolt-elements-textSecondary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus resize-vertical ${errors.content ? 'border-red-500 focus:border-red-500' : 'border-bolt-elements-borderColor'}`}
              />
              {errors.content && <p className="text-sm text-red-500">{errors.content}</p>}
            </div>

            {/* Features */}
            <div className="space-y-2">
              <Label htmlFor="features" className="text-bolt-elements-textPrimary">
                Features (comma-separated)
              </Label>
              <Input
                id="features"
                placeholder="e.g., Code Analysis, Best Practices, Performance"
                value={formData.features}
                onChange={(e) => handleInputChange('features', e.target.value)}
              />
              <p className="text-xs text-bolt-elements-textSecondary">
                List the key features this prompt provides (optional)
              </p>
            </div>

            {/* Best For */}
            <div className="space-y-2">
              <Label htmlFor="bestFor" className="text-bolt-elements-textPrimary">
                Best For (comma-separated)
              </Label>
              <Input
                id="bestFor"
                placeholder="e.g., React Development, API Design, Testing"
                value={formData.bestFor}
                onChange={(e) => handleInputChange('bestFor', e.target.value)}
              />
              <p className="text-xs text-bolt-elements-textSecondary">
                Describe what types of projects/tasks this prompt works best for (optional)
              </p>
            </div>

            {/* Token Usage */}
            <div className="space-y-2">
              <Label className="text-bolt-elements-textPrimary">Token Usage</Label>
              <Select value={formData.tokenUsage} onValueChange={handleSelectChange('tokenUsage')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select token usage level" />
                </SelectTrigger>
                <SelectContent>
                  {TOKEN_USAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Complexity */}
            <div className="space-y-2">
              <Label className="text-bolt-elements-textPrimary">Complexity</Label>
              <Select value={formData.complexity} onValueChange={handleSelectChange('complexity')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select complexity level" />
                </SelectTrigger>
                <SelectContent>
                  {COMPLEXITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-8">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-purple-500 hover:bg-purple-600 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Prompt
                </>
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
};
