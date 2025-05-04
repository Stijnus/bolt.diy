import { describe, it, expect, vi } from 'vitest';
import { generateText } from 'ai';

// Define a type for our test result
type TestResult = {
  text: string;
  reasoning: string;
  sources: Array<{ url: string; title?: string }>;
};

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: 'Test response',
    reasoning: 'This is the reasoning behind the response',
    sources: [{ url: 'https://example.com', title: 'Example Source' }],
  }),
  streamText: vi.fn().mockResolvedValue({
    textStream: new ReadableStream(),
    fullStream: new ReadableStream(),
    toDataStreamResponse: vi.fn().mockReturnValue(new Response()),
    mergeIntoDataStream: vi.fn(),
  }),
  createDataStream: vi.fn().mockReturnValue({
    writeData: vi.fn(),
    writeMessageAnnotation: vi.fn(),
    toDataStreamResponse: vi.fn().mockReturnValue(new Response()),
  }),
  convertToCoreMessages: vi.fn().mockReturnValue([]),
  generateId: vi.fn().mockReturnValue('test-id'),
}));

describe('AI SDK 4.2 Integration', () => {
  it('should return text, reasoning, and sources from generateText', async () => {
    // Cast the result to our test type
    const result = (await generateText({
      model: {} as any,
      messages: [{ role: 'user', content: 'Test message' }],
    })) as unknown as TestResult;

    // Verify the result has the expected properties
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('reasoning');
    expect(result).toHaveProperty('sources');
    expect(result.text).toBe('Test response');
    expect(result.reasoning).toBe('This is the reasoning behind the response');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].url).toBe('https://example.com');
  });
});
