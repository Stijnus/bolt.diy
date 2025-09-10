import { useChat } from '@ai-sdk/react';
import type { Attachment } from '@ai-sdk/ui-utils';
import { useStore } from '@nanostores/react';
import { useSearchParams } from '@remix-run/react';
import { useAnimate } from 'framer-motion';
import Cookies from 'js-cookie';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { BaseChat } from './BaseChat';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { useMessageParser, usePromptEnhancer, useShortcuts } from '~/lib/hooks';
import { useSettings } from '~/lib/hooks/useSettings';
import { description, useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { logStore } from '~/lib/stores/logs';
import { useMCPStore } from '~/lib/stores/mcp';
import { streamingState } from '~/lib/stores/streaming';
import { supabaseConnection } from '~/lib/stores/supabase';
import { workbenchStore } from '~/lib/stores/workbench';
import type { LlmErrorAlertType } from '~/types/actions';
import { defaultDesignScheme, type DesignScheme } from '~/types/design-scheme';
import type { ProviderInfo } from '~/types/model';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROMPT_COOKIE_KEY, PROVIDER_LIST } from '~/utils/constants';
import { debounce } from '~/utils/debounce';
import { cubicEasingFn } from '~/utils/easings';
import { filesToArtifacts } from '~/utils/fileUtils';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { createSampler } from '~/utils/sampler';
import { getTemplates, selectStarterTemplate } from '~/utils/selectStarterTemplate';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory, importChat, exportChat } = useChatHistory();
  const title = useStore(description);
  useEffect(() => {
    workbenchStore.setReloadedMessages(initialMessages.map((m) => m.id));
  }, [initialMessages]);

  return (
    <>
      {ready && (
        <ChatImpl
          description={title}
          initialMessages={initialMessages}
          exportChat={exportChat}
          storeMessageHistory={storeMessageHistory}
          importChat={importChat}
        />
      )}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          /**
           * @todo Handle more types if we need them. This may require extra color palettes.
           */
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
        autoClose={3000}
      />
    </>
  );
}

const processSampledMessages = createSampler(
  (options: {
    messages: any[];
    initialMessages: any[];
    isLoading: boolean;
    parseMessages: (messages: any[], isLoading: boolean) => void;
    storeMessageHistory: (messages: any[]) => Promise<void>;
  }) => {
    const { messages, initialMessages, isLoading, parseMessages, storeMessageHistory } = options;
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  },
  50,
);

interface ChatProps {
  initialMessages: any[];
  storeMessageHistory: (messages: any[]) => Promise<void>;
  importChat: (description: string, messages: any[]) => Promise<void>;
  exportChat: () => void;
  description?: string;
}

export const ChatImpl = memo(
  ({ description, initialMessages, storeMessageHistory, importChat, exportChat }: ChatProps) => {
    useShortcuts();

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [imageDataList, setImageDataList] = useState<string[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [fakeLoading, setFakeLoading] = useState(false);
    const files = useStore(workbenchStore.files);
    const [designScheme, setDesignScheme] = useState<DesignScheme>(defaultDesignScheme);
    const actionAlert = useStore(workbenchStore.alert);
    const deployAlert = useStore(workbenchStore.deployAlert);
    const supabaseConn = useStore(supabaseConnection);

    const selectedProject = supabaseConn.stats?.projects?.find(
      (project) => project.id === supabaseConn.selectedProjectId,
    );

    const supabaseAlert = useStore(workbenchStore.supabaseAlert);
    const { activeProviders, promptId, autoSelectTemplate, contextOptimizationEnabled } = useSettings();
    const [llmErrorAlert, setLlmErrorAlert] = useState<LlmErrorAlertType | undefined>(undefined);

    const [model, setModel] = useState(() => {
      const savedModel = Cookies.get('selectedModel');
      return savedModel || DEFAULT_MODEL;
    });
    const [provider, setProvider] = useState(() => {
      const savedProvider = Cookies.get('selectedProvider');
      return (PROVIDER_LIST.find((p) => p.name === savedProvider) || DEFAULT_PROVIDER) as ProviderInfo;
    });

    const { showChat } = useStore(chatStore);
    const [animationScope, animate] = useAnimate();
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [chatMode, setChatMode] = useState<'discuss' | 'build'>('build');
    const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
    const mcpSettings = useMCPStore((state) => state.settings);

    // Manual input state management for AI SDK v5
    const [input, setInput] = useState(Cookies.get(PROMPT_COOKIE_KEY) || '');
    const [chatData, setChatData] = useState<any>(undefined);

    const {
      messages,
      status,
      stop,
      sendMessage: sendMessageFromHook,
      setMessages,
      regenerate,
      error,
      addToolResult,
    } = useChat({
      onError: (e) => {
        setFakeLoading(false);
        handleError(e, 'chat');
      },
      onData: (data) => {
        // Normalize streamed custom data to an array and accumulate events
        setChatData((prev: any) => {
          if (Array.isArray(data)) {
            return data;
          }

          const list = Array.isArray(prev) ? prev.slice() : [];

          if (data !== undefined && data !== null) {
            list.push(data);
          }

          return list;
        });
      },
      onFinish: (_message) => {
        setChatData(undefined);
        logger.debug('Finished streaming');
      },
    });

    // Initialize messages with history in AI SDK v5
    useEffect(() => {
      if (initialMessages.length > 0 && messages.length === 0) {
        setMessages(initialMessages as any);
      }
    }, [initialMessages, messages.length, setMessages]);

    // Adapter function to bridge v4/v5 addToolResult API differences
    const addToolResultAdapter = ({ toolCallId, result }: { toolCallId: string; result: any }) => {
      // Call the original addToolResult with the expected v4 signature
      return addToolResult({
        tool: 'unknown', // The tool name isn't available in v5 usage
        toolCallId,
        output: result,
      });
    };

    // Manual input change handler for AI SDK v5
    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    };

    // Derive isLoading from status for backward compatibility
    const isLoading = status === 'streaming' || status === 'submitted';

    useEffect(() => {
      const prompt = searchParams.get('prompt');

      // console.log(prompt, searchParams, model, provider);

      if (prompt) {
        setSearchParams({});
        runAnimation();
        sendMessageFromHook(
          {
            id: `${Date.now()}`,
            role: 'user',
            parts: [
              {
                type: 'text',
                text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${prompt}`,
              },
            ],
          },
          {
            body: {
              apiKeys,
              files,
              promptId,
              contextOptimization: contextOptimizationEnabled,
              chatMode,
              designScheme,
              supabase: {
                isConnected: supabaseConn.isConnected,
                hasSelectedProject: !!selectedProject,
                credentials: {
                  anonKey: supabaseConn.credentials?.anonKey,
                  supabaseUrl: supabaseConn.credentials?.supabaseUrl,
                },
              },
              maxLLMSteps: mcpSettings.maxLLMSteps,
            },
          },
        );
      }
    }, [model, provider, searchParams]);

    const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
    const { parsedMessages, parseMessages } = useMessageParser();

    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    useEffect(() => {
      chatStore.setKey('started', initialMessages.length > 0);
    }, []);

    useEffect(() => {
      processSampledMessages({
        messages,
        initialMessages,
        isLoading,
        parseMessages,
        storeMessageHistory,
      });
    }, [messages, isLoading, parseMessages]);

    const scrollTextArea = () => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    };

    const abort = () => {
      stop();
      chatStore.setKey('aborted', true);
      workbenchStore.abortAllActions();

      logStore.logProvider('Chat response aborted', {
        component: 'Chat',
        action: 'abort',
        model,
        provider: provider.name,
      });
    };

    const handleError = useCallback(
      (error: any, context: 'chat' | 'template' | 'llmcall' = 'chat') => {
        logger.error(`${context} request failed`, error);

        stop();
        setFakeLoading(false);

        let errorInfo = {
          message: 'An unexpected error occurred',
          isRetryable: true,
          statusCode: 500,
          provider: provider.name,
          type: 'unknown' as const,
          retryDelay: 0,
        };

        if (error.message) {
          try {
            const parsed = JSON.parse(error.message);

            if (parsed.error || parsed.message) {
              errorInfo = { ...errorInfo, ...parsed };
            } else {
              errorInfo.message = error.message;
            }
          } catch {
            errorInfo.message = error.message;
          }
        }

        let errorType: LlmErrorAlertType['errorType'] = 'unknown';
        let title = 'Request Failed';

        if (errorInfo.statusCode === 401 || errorInfo.message.toLowerCase().includes('api key')) {
          errorType = 'authentication';
          title = 'Authentication Error';
        } else if (errorInfo.statusCode === 429 || errorInfo.message.toLowerCase().includes('rate limit')) {
          errorType = 'rate_limit';
          title = 'Rate Limit Exceeded';
        } else if (errorInfo.message.toLowerCase().includes('quota')) {
          errorType = 'quota';
          title = 'Quota Exceeded';
        } else if (errorInfo.statusCode >= 500) {
          errorType = 'network';
          title = 'Server Error';
        }

        logStore.logError(`${context} request failed`, error, {
          component: 'Chat',
          action: 'request',
          error: errorInfo.message,
          context,
          retryable: errorInfo.isRetryable,
          errorType,
          provider: provider.name,
        });

        // Create API error alert
        setLlmErrorAlert({
          type: 'error',
          title,
          description: errorInfo.message,
          provider: provider.name,
          errorType,
        });
        setChatData([]);
      },
      [provider.name, stop],
    );

    const clearApiErrorAlert = useCallback(() => {
      setLlmErrorAlert(undefined);
    }, []);

    useEffect(() => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.style.height = 'auto';

        const scrollHeight = textarea.scrollHeight;

        textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
        textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
      }
    }, [input, textareaRef]);

    const runAnimation = async () => {
      if (chatStarted) {
        return;
      }

      await Promise.all([
        animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
        animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
      ]);

      chatStore.setKey('started', true);

      setChatStarted(true);
    };

    // Helper function to create message parts array from text and images
    const createMessageParts = (text: string, images: string[] = []): any[] => {
      // Create an array of properly typed message parts
      const parts: any[] = [
        {
          type: 'text',
          text,
        },
      ];

      // Add image parts if any
      images.forEach((imageData) => {
        // Extract correct MIME type from the data URL
        const mediaType = imageData.split(';')[0].split(':')[1] || 'image/jpeg';

        // Create file part according to AI SDK v5 format
        parts.push({
          type: 'file',
          mediaType,
          url: imageData, // Use the complete data URL
        });
      });

      return parts;
    };

    // Helper function to convert File[] to Attachment[] for AI SDK
    const filesToAttachments = async (files: File[]): Promise<Attachment[] | undefined> => {
      if (files.length === 0) {
        return undefined;
      }

      const attachments = await Promise.all(
        files.map(
          (file) =>
            new Promise<Attachment>((resolve) => {
              const reader = new FileReader();

              reader.onloadend = () => {
                resolve({
                  name: file.name,
                  contentType: file.type,
                  url: reader.result as string,
                });
              };
              reader.readAsDataURL(file);
            }),
        ),
      );

      return attachments;
    };

    const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
      const messageContent = messageInput || input;

      if (!messageContent?.trim()) {
        return;
      }

      if (isLoading) {
        abort();
        return;
      }

      let finalMessageContent = messageContent;

      if (selectedElement) {
        console.log('Selected Element:', selectedElement);

        const elementInfo = `<div class=\"__boltSelectedElement__\" data-element='${JSON.stringify(selectedElement)}'>${JSON.stringify(`${selectedElement.displayText}`)}</div>`;
        finalMessageContent = messageContent + elementInfo;
      }

      runAnimation();

      if (!chatStarted) {
        setFakeLoading(true);

        if (autoSelectTemplate) {
          const { template, title } = await selectStarterTemplate({
            message: finalMessageContent,
            model,
            provider,
          });

          if (template !== 'blank') {
            const temResp = await getTemplates(template, title).catch((e) => {
              if (e.message.includes('rate limit')) {
                toast.warning('Rate limit exceeded. Skipping starter template\n Continuing with blank template');
              } else {
                toast.warning('Failed to import starter template\n Continuing with blank template');
              }

              return null;
            });

            if (temResp) {
              const { assistantMessage, userMessage } = temResp;
              const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

              setMessages([
                {
                  id: `1-${new Date().getTime()}`,
                  role: 'user',
                  parts: createMessageParts(userMessageText, imageDataList),
                },
                {
                  id: `2-${new Date().getTime()}`,
                  role: 'assistant',
                  parts: [{ type: 'text', text: assistantMessage }],
                },
                {
                  id: `3-${new Date().getTime()}`,
                  role: 'user',
                  parts: [
                    { type: 'text', text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userMessage}` },
                  ],
                },
              ]);

              regenerate();
              setInput('');
              Cookies.remove(PROMPT_COOKIE_KEY);

              setUploadedFiles([]);
              setImageDataList([]);

              resetEnhancer();

              textareaRef.current?.blur();
              setFakeLoading(false);

              return;
            }
          }
        }

        // If autoSelectTemplate is disabled or template selection failed, proceed with normal message
        const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

        setMessages([
          {
            id: `${new Date().getTime()}`,
            role: 'user',
            parts: createMessageParts(userMessageText, imageDataList),
          },
        ]);
        regenerate();
        setFakeLoading(false);
        setInput('');
        Cookies.remove(PROMPT_COOKIE_KEY);

        setUploadedFiles([]);
        setImageDataList([]);

        resetEnhancer();

        textareaRef.current?.blur();

        return;
      }

      if (error != null) {
        setMessages(messages.slice(0, -1));
      }

      const modifiedFiles = workbenchStore.getModifiedFiles();

      chatStore.setKey('aborted', false);

      if (modifiedFiles !== undefined) {
        const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
        const messageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userUpdateArtifact}${finalMessageContent}`;

        const attachmentOptions =
          uploadedFiles.length > 0 ? { experimental_attachments: await filesToAttachments(uploadedFiles) } : undefined;

        sendMessageFromHook(
          {
            id: `${Date.now()}`,
            role: 'user',
            parts: [
              {
                type: 'text',
                text: messageText,
              },
            ],
          },
          {
            ...attachmentOptions,
            body: {
              apiKeys,
              files,
              promptId,
              contextOptimization: contextOptimizationEnabled,
              chatMode,
              designScheme,
              supabase: {
                isConnected: supabaseConn.isConnected,
                hasSelectedProject: !!selectedProject,
                credentials: {
                  anonKey: supabaseConn.credentials?.anonKey,
                  supabaseUrl: supabaseConn.credentials?.supabaseUrl,
                },
              },
              maxLLMSteps: mcpSettings.maxLLMSteps,
            },
          },
        );

        workbenchStore.resetAllFileModifications();
      } else {
        const messageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

        const attachmentOptions =
          uploadedFiles.length > 0 ? { experimental_attachments: await filesToAttachments(uploadedFiles) } : undefined;

        sendMessageFromHook(
          {
            id: `${Date.now()}`,
            role: 'user',
            parts: [
              {
                type: 'text',
                text: messageText,
              },
            ],
          },
          {
            ...attachmentOptions,
            body: {
              apiKeys,
              files,
              promptId,
              contextOptimization: contextOptimizationEnabled,
              chatMode,
              designScheme,
              supabase: {
                isConnected: supabaseConn.isConnected,
                hasSelectedProject: !!selectedProject,
                credentials: {
                  anonKey: supabaseConn.credentials?.anonKey,
                  supabaseUrl: supabaseConn.credentials?.supabaseUrl,
                },
              },
              maxLLMSteps: mcpSettings.maxLLMSteps,
            },
          },
        );
      }

      setInput('');
      Cookies.remove(PROMPT_COOKIE_KEY);

      setUploadedFiles([]);
      setImageDataList([]);

      resetEnhancer();

      textareaRef.current?.blur();
    };

    /**
     * Handles the change event for the textarea and updates the input state.
     * @param event - The change event from the textarea.
     */
    const onTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleInputChange(event);
    };

    /**
     * Debounced function to cache the prompt in cookies.
     * Caches the trimmed value of the textarea input after a delay to optimize performance.
     */
    const debouncedCachePrompt = useCallback(
      debounce((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const trimmedValue = event.target.value.trim();
        Cookies.set(PROMPT_COOKIE_KEY, trimmedValue, { expires: 30 });
      }, 1000),
      [],
    );

    useEffect(() => {
      const storedApiKeys = Cookies.get('apiKeys');

      if (storedApiKeys) {
        setApiKeys(JSON.parse(storedApiKeys));
      }
    }, []);

    const handleModelChange = (newModel: string) => {
      setModel(newModel);
      Cookies.set('selectedModel', newModel, { expires: 30 });
    };

    const handleProviderChange = (newProvider: ProviderInfo) => {
      setProvider(newProvider);
      Cookies.set('selectedProvider', newProvider.name, { expires: 30 });
    };

    // Handle quick action buttons dispatched from Markdown (message/implement)
    useEffect(() => {
      const handler = (ev: Event) => {
        const e = ev as CustomEvent<{ type: string; message?: string } | undefined>;
        const detail = e.detail;

        if (!detail || !detail.type) {
          return;
        }

        const send = (text: string) => {
          // Kick off intro animation if needed, then stream like a normal send
          runAnimation();

          const wrapped = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${text}`;

          sendMessageFromHook(
            {
              id: `${Date.now()}`,
              role: 'user',
              parts: [
                {
                  type: 'text',
                  text: wrapped,
                },
              ],
            },
            {
              body: {
                apiKeys,
                files,
                promptId,
                contextOptimization: contextOptimizationEnabled,
                chatMode,
                designScheme,
                supabase: {
                  isConnected: supabaseConn.isConnected,
                  hasSelectedProject: !!selectedProject,
                  credentials: {
                    anonKey: supabaseConn.credentials?.anonKey,
                    supabaseUrl: supabaseConn.credentials?.supabaseUrl,
                  },
                },
                maxLLMSteps: mcpSettings.maxLLMSteps,
              },
            },
          );
        };

        if (detail.type === 'message') {
          const text = (detail.message || '').trim();

          if (!text) {
            return;
          }

          send(text);
        } else if (detail.type === 'implement') {
          // Switch to build mode and optionally send a message
          setChatMode('build');

          const text = (detail.message || '').trim();

          if (text) {
            send(text);
          }
        }
      };

      window.addEventListener('bolt:quick-action', handler as EventListener);

      return () => window.removeEventListener('bolt:quick-action', handler as EventListener);
    }, [
      model,
      provider.name,
      apiKeys,
      files,
      promptId,
      contextOptimizationEnabled,
      chatMode,
      designScheme,
      supabaseConn.isConnected,
      supabaseConn.credentials?.anonKey,
      supabaseConn.credentials?.supabaseUrl,
      selectedProject,
      mcpSettings.maxLLMSteps,
      sendMessageFromHook,
      runAnimation,
      setChatMode,
    ]);

    return (
      <BaseChat
        ref={animationScope}
        textareaRef={textareaRef}
        input={input}
        showChat={showChat}
        chatStarted={chatStarted}
        isStreaming={isLoading || fakeLoading}
        onStreamingChange={(streaming) => {
          streamingState.set(streaming);
        }}
        enhancingPrompt={enhancingPrompt}
        promptEnhanced={promptEnhanced}
        sendMessage={sendMessage}
        model={model}
        setModel={handleModelChange}
        provider={provider}
        setProvider={handleProviderChange}
        providerList={activeProviders}
        handleInputChange={(e) => {
          onTextareaChange(e);
          debouncedCachePrompt(e);
        }}
        handleStop={abort}
        description={description}
        importChat={importChat}
        exportChat={exportChat}
        messages={messages.map((message, i) => {
          if (message.role === 'user') {
            return message;
          }

          return {
            ...message,
            parts:
              message.parts?.map((part) =>
                part.type === 'text' ? { ...part, text: parsedMessages[i] || part.text } : part,
              ) || [],
          };
        })}
        enhancePrompt={() => {
          enhancePrompt(
            input,
            (input) => {
              setInput(input);
              scrollTextArea();
            },
            model,
            provider,
            apiKeys,
          );
        }}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        imageDataList={imageDataList}
        setImageDataList={setImageDataList}
        actionAlert={actionAlert}
        clearAlert={() => workbenchStore.clearAlert()}
        supabaseAlert={supabaseAlert}
        clearSupabaseAlert={() => workbenchStore.clearSupabaseAlert()}
        deployAlert={deployAlert}
        clearDeployAlert={() => workbenchStore.clearDeployAlert()}
        llmErrorAlert={llmErrorAlert}
        clearLlmErrorAlert={clearApiErrorAlert}
        data={chatData}
        chatMode={chatMode}
        setChatMode={setChatMode}
        designScheme={designScheme}
        setDesignScheme={setDesignScheme}
        selectedElement={selectedElement}
        setSelectedElement={setSelectedElement}
        addToolResult={addToolResultAdapter}
      />
    );
  },
);
