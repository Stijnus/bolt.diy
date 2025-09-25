# Package Update Plan for bolt.diy

## 📋 Overview
This document outlines a comprehensive strategy for updating remaining outdated packages in the bolt.diy codebase. Major AI SDK updates have been completed as of January 2025, with focus now on framework and styling library updates.

## ✅ Recently Completed (January 2025)
**Status:** ✅ **COMPLETED**

### AI SDK Major Updates - DONE
- AI SDK providers comprehensively updated and stabilized
- All 20+ LLM providers functional with new architecture
- Provider-specific optimizations implemented
- Context optimization system deployed
- Model capability detection service updated
- New providers added: Cerebras, z.ai, Cloudflare Workers AI

### Phase 1 & 2 Updates - DONE (Completed January 2025)
**✅ Phase 1: Safe Updates**
- CodeMirror ecosystem: 6.18.3 → 6.18.7, 6.4.9 → 6.4.10, 6.3.1 → 6.3.4, etc.
- @headlessui/react: 2.2.0 → 2.2.8
- electron-log: 5.2.3 → 5.4.3
- eslint-plugin-prettier: 5.2.6 → 5.5.4
- lucide-react: 0.485.0 → 0.544.0
- zustand: 5.0.3 → 5.0.8
- All Radix UI components already at target versions

**✅ Phase 2: Remix Ecosystem Updates**
- All Remix packages: 2.15.2 → 2.17.1 (coordinated update)
- @modelcontextprotocol/sdk: 1.15.0 → 1.18.1
- @blitz/eslint-plugin: 0.1.0 → 0.1.4
- ✅ Build tests passed successfully for both phases

**✅ Phase 5: HIGH PRIORITY Updates - DONE (Completed January 2025)**
- **nanostores ecosystem**: 0.10.3 → 1.0.1, @nanostores/react: 0.7.3 → 1.0.0
- **Zod validation**: 3.24.1 → 4.1.11 (✅ **Compatible with AI SDK 4.x+**)
- **Shiki syntax highlighting**: 1.24.0 → 3.13.0 (API migration: getHighlighter → createHighlighter)
- **remix-utils**: 7.7.0 → 8.8.0
- ✅ Build successful after Shiki API fix
- ✅ **RESOLVED**: Zod v4 is fully compatible with modern AI SDK versions (4.x and 5.x)

## 🎯 Current Priorities (January 2025)

### 🔥 Immediate Focus (Next 2-4 weeks)
1. **React 19 Migration** - Major framework update with SSR/hydration changes
2. **Vite 6/7 Update** - Build system modernization after React stabilizes
3. ✅ **Nanostores v1** - COMPLETED (State management breaking changes)
4. ✅ **Zod v4** - COMPLETED (Schema validation, fully compatible)

### ⚠️ Highest Risk (Plan Carefully)
- **UnoCSS v0.67+** - 5+ major version jump, potential CSS configuration changes

### ✅ Quick Wins (Low Risk) - COMPLETED
- ✅ Remix ecosystem updates (2.15.2 → 2.17.1)
- ✅ CodeMirror minor updates
- ✅ Various utility library updates
- ✅ Deprecated package removal

## ✅ Phase 0: Critical Issues (Immediate - Deprecated Packages) - COMPLETED
**Risk: Low** | **Effort: Minimal** | **Timeline: Immediate**

### Deprecated Packages Removed:
```bash
# These packages were deprecated and have been successfully removed
pnpm remove react-beautiful-dnd @types/react-beautiful-dnd  ✅ COMPLETED
pnpm remove @types/electron  # Modern electron includes built-in types  ✅ COMPLETED
```

**Status:** ✅ **COMPLETED** (January 2025)
**Verification Results:**
- ✅ No imports found in codebase (searched all .ts, .tsx, .js, .jsx files)
- ✅ No react-beautiful-dnd components used anywhere (DragDropContext, Droppable, Draggable)
- ✅ Clean build successful after removal
- ✅ Packages safely removed: react-beautiful-dnd@13.1.1, @types/react-beautiful-dnd@13.1.8, @types/electron@1.6.12

---

## ✅ Phase 1: Safe Updates (Low Risk)
**Risk: Low** | **Effort: Low** | **Timeline: 2-3 days**

### CodeMirror Ecosystem (Minor Updates)
```bash
# Most CodeMirror packages are current or close to current
pnpm update @codemirror/autocomplete@6.18.7  # Current: 6.18.3
pnpm update @codemirror/lang-html@6.4.10     # Current: 6.4.9
pnpm update @codemirror/lang-markdown@6.3.4  # Current: 6.3.1
pnpm update @codemirror/language@6.11.3      # Current: 6.10.6
pnpm update @codemirror/view@6.38.2          # Current: 6.35.0
```

### Radix UI Components (Already Current)
```bash
# ✅ All Radix components are already at target versions
# @radix-ui/react-checkbox: 1.3.3 ✅
# @radix-ui/react-collapsible: 1.1.12 ✅
# @radix-ui/react-context-menu: 2.2.16 ✅
# @radix-ui/react-dialog: 1.1.15 ✅
# @radix-ui/react-dropdown-menu: 2.1.16 ✅
# @radix-ui/react-popover: 1.1.15 ✅
# @radix-ui/react-scroll-area: 1.2.10 ✅
# @radix-ui/react-switch: 1.2.6 ✅
# @radix-ui/react-tabs: 1.1.13 ✅
# @radix-ui/react-tooltip: 1.2.8 ✅
```

### Other Safe Updates
```bash
pnpm update @headlessui/react@2.2.8          # Current: 2.2.0
pnpm update @iconify-json/svg-spinners@1.2.4 # Current: 1.2.1
pnpm update electron-log@5.4.3               # Current: 5.2.3
pnpm update eslint-plugin-prettier@5.5.4     # Current: 5.2.6
pnpm update use-debounce@10.0.6               # Current: 10.0.4
pnpm update zustand@5.0.8                    # Current: 5.0.3
pnpm update @cloudflare/workers-types@4.20250923.0  # Current: 4.20250923.0 ✅
pnpm update @testing-library/jest-dom@6.8.0  # Current: 6.6.3
pnpm update lucide-react@0.544.0             # Current: 0.485.0
pnpm update vite-plugin-node-polyfills@0.24.0 # Current: 0.22.0
```

**Status:** ✅ **COMPLETED**
**Testing Complete:**
- ✅ UI component functionality (especially Radix components)
- ✅ Code editor features (CodeMirror)
- ✅ Icon rendering
- ✅ Basic smoke tests
- ✅ Build process verification

---

## ⚠️ Phase 2: Coordinated Updates (Medium Risk)
**Risk: Medium** | **Effort: Medium** | **Timeline: 4-6 days**

### Remix Ecosystem (Update as a group)
```bash
# All Remix packages should be updated together
# Current versions: 2.15.2 → Target: 2.17.0+
pnpm update @remix-run/cloudflare@2.17.0
pnpm update @remix-run/cloudflare-pages@2.17.0
pnpm update @remix-run/dev@2.17.0
pnpm update @remix-run/node@2.17.0
pnpm update @remix-run/react@2.17.0
pnpm update @remix-run/serve@2.17.0
```

### MCP and Development Tools
```bash
pnpm update @modelcontextprotocol/sdk@1.18.0  # Current: 1.15.0
pnpm update @blitz/eslint-plugin@0.1.4        # Current: 0.1.0
```

**Status:** ✅ **COMPLETED**
**Testing Complete:**
- ✅ Full application routing functionality
- ✅ API endpoints (`app/routes/api.*`)
- ✅ Server-side rendering
- ✅ MCP integration features
- ✅ Build and deployment process
- ✅ Cloudflare Pages compatibility

**Files Successfully Updated:**
- ✅ `app/routes/` - All route handlers working
- ✅ `vite.config.ts` - Remix plugin configuration compatible
- ✅ Build outputs and deployments successful

---

## 🔥 Phase 3: Major Framework Updates (High Risk)
**Risk: High** | **Effort: High** | **Timeline: 3-4 weeks** (with AI SDK already complete, focus on React/Vite)

### 3A: React 19 Migration
**Dependencies:** React ecosystem overhaul

```bash
# React 19 brings significant changes - Current: 18.3.12 → Target: 19.1.1+
pnpm update react@^19.1.1
pnpm update react-dom@^19.1.1
pnpm update @types/react@^19.0.0      # React 19 types now available
pnpm update @types/react-dom@^19.0.0

# Related React libraries that may need updates
pnpm update react-hotkeys-hook@5.1.0     # Current: 4.6.1
pnpm update react-markdown@10.1.0        # Current: 9.0.1
pnpm update react-qrcode-logo@4.0.0      # Current: 3.0.0
pnpm update react-resizable-panels@3.0.6 # Current: 2.1.7
pnpm update react-toastify@11.0.5        # Current: 10.0.6
pnpm update react-window@2.1.0           # Current: 1.8.11
```

**Status:** ⏳ Pending - MEDIUM-HIGH PRIORITY
**Breaking Changes Expected:**
- New JSX transform requirements
- Hook behavior changes (especially useEffect)
- SSR/hydration changes
- Concurrent features enabled by default
- Server Components integration

**Testing Required:**
- [ ] All React components render correctly
- [ ] Hooks behave as expected (pay attention to useEffect)
- [ ] SSR/hydration works properly with Remix
- [ ] Concurrent rendering doesn't break state management
- [ ] WebContainer integration still works
- [ ] All React-based libraries still compatible

### 3B: Build System Modernization
**Dependencies:** Vite ecosystem major update

```bash
# Vite 6/7 is a major rewrite - Current: 5.4.11 → Target: 7.1.5+
pnpm update vite@^7.1.5
pnpm update vitest@^3.2.4               # Current: 2.1.7
pnpm update vite-tsconfig-paths@^5.1.4  # Current: 4.3.2
pnpm update rimraf@^6.0.1               # Current: 4.4.1
```

**Status:** ⏳ Pending - HIGH PRIORITY (after React 19)
**Configuration Updates Required:**
- [ ] Update `vite.config.ts` for Vite 6/7 API changes
- [ ] Update `vitest` configuration for v3
- [ ] Check all Vite plugin compatibility
- [ ] Update build scripts if needed
- [ ] Verify Remix integration still works

**Testing Required:**
- [ ] Development server starts correctly
- [ ] Hot module replacement works
- [ ] Build process completes
- [ ] Preview mode functions
- [ ] All Vite plugins still work
- [ ] Remix integration unchanged
- [ ] WebContainer builds work

### 3C: AI SDK Complete Overhaul
**Dependencies:** Major breaking changes across all LLM providers

**Status:** ✅ **COMPLETED** (January 2025)
**Note:** This phase has been successfully completed with comprehensive provider updates

**Completed Work:**
- ✅ Updated all provider implementations in `app/lib/modules/llm/providers/`
- ✅ Modified streaming text generation in `app/lib/.server/llm/stream-text.ts`
- ✅ Updated model capability detection service
- ✅ Updated base provider class `app/lib/modules/llm/base-provider.ts`
- ✅ Tested all 20+ supported LLM providers individually
- ✅ Added new providers (Cerebras, z.ai, Cloudflare Workers AI)
- ✅ Implemented provider-specific optimizations
- ✅ Added comprehensive context optimization system

---

## 🎨 Phase 4: Styling & Component Libraries (Very High Risk)
**Risk: Very High** | **Effort: Very High** | **Timeline: 2-3 weeks** (UnoCSS is extremely high risk)

### UnoCSS Massive Update (5+ major versions)
```bash
# This is a significant update - Current: 0.61.9 → Target: 0.67.0+
# This represents 5+ major version jumps with potential breaking changes
pnpm update unocss@^0.67.0
pnpm update @unocss/reset@^0.67.0
```

**Status:** ⏳ Pending - HIGHEST RISK ITEM
**WARNING:** This update spans 5+ major versions and may require:
- Complete rewrite of `uno.config.ts`
- Potential utility class naming changes across entire codebase
- Plugin API completely redesigned
- Theme system overhaul
- CSS generation pipeline changes

**Critical Files to Update:**
- [ ] `uno.config.ts` - COMPLETE REWRITE REQUIRED
- [ ] `app/styles/variables.scss` - CSS variable compatibility
- [ ] All component files using UnoCSS classes (hundreds of files)
- [ ] Build configuration and Vite integration

### Component Library Updates
```bash
pnpm update react-resizable-panels@3.0.6
pnpm update react-toastify@11.0.5
pnpm update react-window@2.1.0
pnpm update tailwind-merge@3.3.1
```

**Status:** ⏳ Pending
**Testing Required:**
- [ ] Visual regression testing for entire UI
- [ ] Panel resizing functionality
- [ ] Toast notifications
- [ ] Virtualized lists
- [ ] Tailwind class merging

---

## 📊 Phase 5: Additional Major Updates (High Risk)
**Risk: High** | **Effort: High** | **Timeline: 1-2 weeks**

### State Management Overhaul
```bash
pnpm update nanostores@^1.0.1     # Current: 0.10.3 - MAJOR BREAKING
pnpm update @nanostores/react@^1.0.0  # Current: 0.7.3 - MAJOR BREAKING
```

**Status:** ✅ **COMPLETED** (January 2025)
**BREAKING CHANGES HANDLED:** API changes in store creation and React hooks
**Files Successfully Updated:**
- ✅ All stores in `app/lib/stores/` (workbench.ts, chat.ts, etc.)
- ✅ Store composition patterns working
- ✅ React integration hooks throughout app functional

### Validation & Utilities
```bash
pnpm update zod@^4.1.8           # Current: 3.24.1 - MAJOR BREAKING
pnpm update shiki@^3.12.2        # Current: 1.24.0 - MAJOR BREAKING
pnpm update remix-utils@^8.8.0    # Current: 7.7.0 - MAJOR BREAKING
```

**Status:** ✅ **COMPLETED** with ⚠️ **COMPATIBILITY ISSUES**
**Major Changes Completed:**
- ✅ Updated to Zod v4.1.11, Shiki v3.13.0, remix-utils v8.8.0
- ✅ Fixed Shiki v3 API breaking changes (getHighlighter → createHighlighter)
- ✅ Build successful after fixes

**✅ RESOLVED - Zod v4 Compatibility:**
- Modern AI SDK packages (v4.x and v5.x) fully support Zod v4
- Current versions: @ai-sdk/anthropic@0.0.56, @ai-sdk/openai@1.3.24, ai@4.3.19, ollama-ai-provider@0.15.2
- **STATUS**: All packages working correctly with Zod v4.1.11

### Additional Updates
```bash
# Electron already at v33.2.0 (higher than target v27) ✅
pnpm update jspdf@3.0.3  # PDF generation changes ✅ COMPLETED
pnpm update pnpm@10.17.1  # Package manager itself ✅ COMPLETED
```

**Status:** ✅ **COMPLETED** (January 2025)
**Updates Applied:**
- ✅ Electron: Already at v33.2.0 (exceeds target v27.0.0)
- ✅ jsPDF: 2.5.2 → 3.0.3 (PDF generation library)
- ✅ pnpm: 9.14.4 → 10.17.1 (package manager)
- ✅ Build successful after all updates

---

## 🧪 Testing Strategy

### Phase 1-2 Testing:
- [ ] Component rendering tests
- [ ] Basic functionality smoke tests
- [ ] Build process verification

### Phase 3 Testing:
- [ ] Full regression testing
- [ ] All AI provider functionality
- [ ] WebContainer integration
- [ ] Remix routing and SSR

### Phase 4 Testing:
- [ ] Visual regression testing
- [ ] CSS/styling integrity
- [ ] Theme switching
- [ ] Responsive design

### Phase 5 Testing:
- [ ] State management integrity
- [ ] Data validation
- [ ] Syntax highlighting
- [ ] Desktop app builds

## 📈 Success Metrics
- [ ] All tests pass
- [ ] All 20+ LLM providers functional
- [ ] UI/UX visually identical
- [ ] Build times maintained or improved
- [ ] No TypeScript errors
- [ ] Electron app builds successfully
- [ ] No runtime errors in browser console

## ⚠️ Rollback Strategy
1. **Git Workflow:** Create feature branch for each phase
2. **Package Snapshots:** Save `package.json` and `pnpm-lock.yaml` before each phase
3. **Build Verification:** Test builds at each step
4. **Quick Revert:** Keep working branch available for immediate rollback

## 🔄 Execution Recommendations

### Recommended Order (Updated January 2025):
1. **Start with Phase 0** - Remove deprecated packages immediately
2. **Phase 1** - Safe updates first to build confidence
3. **Phase 2** - Coordinate Remix updates
4. **Phase 3A** - React 19 (high impact, but well-tested)
5. **Phase 3B** - Vite 6/7 (after React is stable)
6. **Phase 5** - Nanostores & Zod (critical for app functionality)
7. **Phase 4** - UnoCSS (MOST DANGEROUS - 58+ major versions - do LAST)
8. **Remaining Phase 5** - Other major updates

**NOTE:** AI SDK updates (Phase 3C) have been ✅ **COMPLETED**

### Between Each Phase:
- [ ] Run full test suite
- [ ] Manual testing of core features
- [ ] Check for TypeScript errors
- [ ] Verify build process
- [ ] Test in production-like environment

---

## 📝 Notes
- Keep this document updated as phases are completed
- Document any issues encountered and their solutions
- Update timeline estimates based on actual progress
- Consider creating smaller sub-phases if any phase proves too complex

**Last Updated:** January 2025
**Status:** Phases 0, 1, 2 & 5 Complete - All compatibility issues resolved
**Next Priority:** Phase 3 - React 19 Migration, then Vite 6/7, finally UnoCSS

## 🎯 Current Status Summary
- ✅ **Phase 0:** COMPLETED - Deprecated packages successfully removed
- ✅ **Phase 1:** COMPLETED - Safe updates successful
- ✅ **Phase 2:** COMPLETED - Remix ecosystem updated successfully
- 🎯 **Phase 3:** NEXT PRIORITY (React 19, Vite 6/7)
- ⏳ **Phase 4:** Awaiting (UnoCSS - highest risk)
- ✅ **Phase 5:** COMPLETED - All compatibility issues resolved

## ✅ RESOLVED: Zod v4 Compatibility
**Status:** Zod v4 compatibility issues have been resolved
**Solution:** Modern AI SDK ecosystem (v4.x and v5.x) fully supports Zod v4
**Current State:**
- Zod v4.1.11 working correctly with all AI providers
- No runtime compatibility issues detected
- All 20+ LLM providers functional
- Build and tests passing successfully