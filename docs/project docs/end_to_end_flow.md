# End-to-End Flow: User Prompt → LLM Response

## 1. User types and sends
- **UI**:  
  - `ChatBox.tsx` → textarea + send button  
- **Handler**:  
  - `BaseChat.tsx` → `handleSendMessage`  
    - Clears UI state  
    - Forwards to chat logic  

---

## 2. Client appends message and starts streaming request
- **Component**:  
  - `Chat.client.tsx`  
  - Uses `useChat` hook + `append` / `setMessages` helpers to insert user message  
- **API call**:  
  - Sends **streaming request** → `/api/chat`  
  - JSON body includes:  
    - `messages`, `files`, `promptId`, `contextOptimization`,  
      `chatMode`, `designScheme`, `supabase` info, etc.  

---

## 3. Server entry point: `/api/chat`
- **Route handler**:  
  - `api.chat.ts` → core function: `chatAction`  
  - Creates:  
    - `dataStream` (`createDataStream`)  
    - `SwitchableStream` (for streaming + recovery)  

---

## 4. Preprocessing on server
- **Tool invocations**:  
  - `MCPService.getInstance()` → `mcpService.processToolInvocations`  
- **Images**:  
  - `processUploadedImages` → writes into project files (with snapshotting if needed)  
- **Context optimization** (optional):  
  - `createSummary` → summarizes chat history  
  - `selectContext` → picks relevant code files  

---

## 5. Main LLM call: `streamText`
- **Called with**:  
  - processed messages, `apiKeys`, `providerSettings`, files, summary, `messageSliceId`, `chatMode`, `designScheme`, etc.  
- **Responsibilities**:  
  - Builds system prompt via `getSystemPrompt` / `discussPrompt`  
  - Applies **prompt-library modifications**  
  - Enforces **token limits**  
  - Constructs provider model instance  
  - Calls into **LLM streaming** (`_streamText` / `generateText` in `stream-text.ts`)  
  - Adjusts sampling params for reasoning models  

---

## 6. Streaming server → client
- `streamText` returns:  
  - `fullStream`  
  - `mergeIntoDataStream`  
- **API flow**:  
  - `result.mergeIntoDataStream(dataStream)` in `api.chat.ts`  
  - Sends **SSE / chunked text responses**:  
    - progress annotations  
    - message annotations (`chatSummary`, `codeContext`)  
    - assistant text chunks  
- **Implementation files**:  
  - `switchable-stream.ts`  
  - `createDataStream`  

---

## 7. Client receives streamed response and renders
- **Hook**:  
  - `useChat` (`Chat.client.tsx`) via `@ai-sdk/react`  
  - Uses `parseMessages` / `useMessageParser`  
  - Updates messages incrementally  
- **Rendering**:  
  - `Messages.client.tsx` → message list  
  - `AssistantMessage.tsx` → assistant UI (fork/rewind actions can trigger new server flows)  

---

## 8. Ancillary flows / other endpoints
- **Direct LLM call**:  
  - `api.llmcall.ts` → `llmCallAction` (reuses `streamText`)  
- **Prompt enhancer**:  
  - `api.enhancer.ts` → enhancer system prompt for improved prompt text  
- **Helpers**:  
  - `create-summary.ts`  
  - `select-context.ts`  

---

## Quick Map: Main Files & Symbols
**Client (UI & Send)**  
- `ChatBox.tsx`  
- `BaseChat.tsx` — `handleSendMessage`  
- `Chat.client.tsx` — `useChat`, `append`  
- `Messages.client.tsx`  
- `AssistantMessage.tsx`  

**Server (Request Handling & Streaming)**  
- `api.chat.ts` — `chatAction`, `processUploadedImages`  
- `stream-text.ts` — `streamText`  
- `create-summary.ts` — `createSummary`  
- `select-context.ts` — `selectContext`  
- `mcpService.ts` — `MCPService`  
- `switchable-stream.ts`  
- `prompts.ts` — `getSystemPrompt`, `CONTINUE_PROMPT`  
- `api.llmcall.ts` — `llmCallAction`  
- `api.enhancer.ts`  
