# Vite 7 Upgrade Plan

## Overview
Vite 7 introduces breaking changes in the plugin ecosystem and internal architecture. This document outlines the comprehensive upgrade strategy to migrate from Vite 5.4.15 to Vite 7.x.

## Status: 📋 PLANNED (Not Started)
- **Current Version**: Vite 5.4.15
- **Target Version**: Vite 7.x
- **Complexity**: HIGH - Plugin ecosystem incompatibility
- **Estimated Effort**: 2-3 weeks dedicated development
- **Prerequisites**: Complete safe dependency updates first

## Why This Requires Dedicated Effort

During initial upgrade attempt, we encountered critical plugin incompatibility:
```
Error: cssPlugins.get(...).transform.call is not a function
    at UnoCSS plugin integration
```

This indicates fundamental changes in Vite's plugin API that affect:
- UnoCSS integration (core styling system)
- Plugin communication and lifecycle
- Build pipeline and optimization
- Development server middleware

## Current Vite 5 Implementation

### Build Configuration (`vite.config.ts`)
- Remix integration with cloudflare-dev-proxy
- UnoCSS for utility-first styling
- Node.js polyfills for browser compatibility
- TypeScript path resolution
- Custom Chrome 129 compatibility plugin
- Sass/SCSS preprocessing with modern API
- Environment variable handling

### Electron Configuration (`vite-electron.config.ts`)
- Separate build config for Electron renderer
- React-DOM server import fixes for Electron
- Optimized CSS modules for production
- Git info and package.json integration

### Plugin Ecosystem
- `@vitejs/plugin-react@4.3.4` - React support
- `unocss/vite` - Utility-first CSS framework
- `vite-plugin-node-polyfills@0.22.0` - Node.js compatibility
- `vite-plugin-optimize-css-modules@1.1.0` - CSS optimization
- `vite-tsconfig-paths@4.3.2` - TypeScript paths
- Custom Chrome 129 workaround plugin

## Breaking Changes in Vite 7

### 1. Plugin API Architecture Changes
**Issue**: Internal plugin communication system redesigned
- `cssPlugins.get(...).transform.call` no longer available
- Plugin hooks and lifecycle events changed
- Inter-plugin communication mechanism updated

### 2. UnoCSS Compatibility Crisis
**Critical Issue**: UnoCSS not compatible with Vite 7
- UnoCSS relies on internal Vite APIs that changed
- No current UnoCSS version supports Vite 7
- Alternative CSS solutions may be required

### 3. Build Pipeline Updates
**Changes**: Internal build and optimization processes
- New bundling strategies
- Updated asset processing
- Modified development server architecture

### 4. Plugin Registration Changes
**Impact**: How plugins are loaded and initialized
- Plugin configuration format changes
- Plugin order and dependency resolution
- Development vs production plugin behavior

### 5. Environment Variable Handling
**Updates**: Environment variable processing and exposure
- Different variable prefix handling
- Build-time vs runtime variable resolution
- Security and sanitization changes

## Migration Strategy

### Phase 1: Ecosystem Research
**Branch**: `feature/vite-7-research`

**Tasks:**
1. Create research branch from main
2. Research UnoCSS Vite 7 compatibility status
3. Investigate alternative CSS solutions if needed
4. Document all plugin compatibility requirements

**Validation:**
- Clear understanding of plugin ecosystem status
- Alternative solutions identified if needed

### Phase 2: Core Vite Upgrade
**Branch**: `feature/vite-7-upgrade`

**Tasks:**
5. Update Vite core package (vite@7.x)
6. Update @vitejs/plugin-react to Vite 7 compatible version
7. Update official Vite plugins
8. Document initial compilation errors

**Validation:**
- Basic Vite 7 setup functional
- Core plugins working

### Phase 3: Plugin Ecosystem Migration
**Focus**: Update or replace incompatible plugins

**Tasks:**
9. Fix or replace UnoCSS plugin for Vite 7
10. Update vite-plugin-node-polyfills for v7
11. Update vite-plugin-optimize-css-modules for v7
12. Update vite-tsconfig-paths for v7

**Validation:**
- All essential plugins working
- Styling system functional (UnoCSS or alternative)

### Phase 4: Framework Integration
**Focus**: Remix and Electron compatibility

**Tasks:**
13. Update Remix Vite plugin to v7 compatible version
14. Fix Sass/SCSS preprocessing configuration
15. Test Electron Vite configuration with v7
16. Update build target and rollup options for v7

**Validation:**
- Remix integration working
- Electron builds successful

### Phase 5: Development Experience
**Focus**: Dev server and tooling

**Tasks:**
17. Test Chrome 129 compatibility plugin with Vite 7
18. Update environment variable handling for v7
19. Update development server configuration
20. Test build optimization and bundling

**Validation:**
- Development server running correctly
- All environment variables available

### Phase 6: Deployment Testing
**Focus**: Production builds and deployment

**Tasks:**
21. Verify Cloudflare Pages deployment compatibility
22. Test WebContainer asset serving with Vite 7
23. Run comprehensive build testing (dev, prod, electron)
24. Performance testing and optimization

**Validation:**
- All deployment targets working
- Performance maintained or improved

### Phase 7: Documentation & Finalization
**Tasks:**
25. Document Vite 7 upgrade changes and plugin migrations
26. Update build documentation and developer setup
27. Create rollback procedures if needed

## Critical Decisions Required

### UnoCSS Compatibility Issue
**Current Status**: UnoCSS not compatible with Vite 7

**Option 1: Wait for UnoCSS Update**
- Pros: Keep current CSS system intact
- Cons: Indefinite timeline, may never be updated
- Risk: High - no guaranteed compatibility

**Option 2: Switch to Tailwind CSS**
- Pros: Native Vite 7 support, similar utility approach
- Cons: Need to migrate all UnoCSS classes
- Risk: Medium - well-supported migration path

**Option 3: Custom CSS Solution**
- Pros: Full control, no external dependencies
- Cons: Loss of utility-first benefits, more maintenance
- Risk: High - significant development effort

**Recommended Approach**: Research Tailwind CSS migration first

## CSS Migration Strategy (If UnoCSS Incompatible)

### Current UnoCSS Usage Analysis
**Files to Audit:**
- `uno.config.ts` - UnoCSS configuration
- `app/styles/` - Global styles and SCSS
- All component files using utility classes
- Theme and variable definitions

### Tailwind CSS Migration Plan
1. **Install Tailwind**: `npm install -D tailwindcss`
2. **Configuration**: Create `tailwind.config.js`
3. **Class Migration**: Map UnoCSS classes to Tailwind equivalents
4. **Theme Migration**: Port custom theme and colors
5. **Build Integration**: Update Vite config for Tailwind

### Utility Class Mapping Examples
```scss
// UnoCSS → Tailwind CSS
.bg-bolt-elements-background-depth-1 → .bg-gray-900
.text-bolt-elements-textPrimary → .text-white
.border-bolt-elements-borderColor → .border-gray-700
```

## Technical Implementation Details

### Critical Files to Update

#### Build Configuration
- `vite.config.ts` - Main Vite configuration (major changes)
- `vite-electron.config.ts` - Electron build config
- `package.json` - Plugin version updates

#### Plugin Configurations
- `uno.config.ts` - May need replacement with `tailwind.config.js`
- `tsconfig.json` - TypeScript path resolution
- Plugin-specific configuration files

#### Styling System
- `app/styles/` - Global styles and themes
- All component `.scss` files
- Utility class usage throughout components

### Chrome 129 Compatibility Plugin
**Current Implementation:**
```typescript
function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      // Custom middleware for Chrome 129 workaround
    },
  };
}
```

**Vite 7 Updates Required:**
- Plugin API compatibility check
- Middleware registration changes
- Server configuration updates

### Environment Variable Configuration
**Current Setup:**
```typescript
envPrefix: [
  'VITE_',
  'OPENAI_LIKE_API_BASE_URL',
  'OLLAMA_API_BASE_URL',
  'LMSTUDIO_API_BASE_URL',
  'TOGETHER_API_BASE_URL',
],
```

**Potential Vite 7 Changes:**
- Environment variable exposure mechanism
- Build-time variable resolution
- Security and sanitization updates

## Testing Strategy

### Development Testing
- Development server startup and hot reload
- TypeScript compilation and type checking
- CSS hot reloading and styling
- Environment variable availability

### Build Testing
- Production build success
- Asset optimization and bundling
- Bundle size analysis and comparison
- Source map generation and accuracy

### Integration Testing
- Remix integration and routing
- WebContainer asset serving
- Electron renderer process
- Cloudflare Pages deployment

### Performance Testing
- Build time comparison (Vite 5 vs 7)
- Bundle size changes
- Runtime performance impacts
- Development server speed

## Risk Assessment

### Critical Risks
- **UnoCSS Incompatibility**: Core styling system affected
- **Plugin Ecosystem**: Multiple plugins may be incompatible
- **Build Pipeline**: Fundamental changes affecting deployment
- **Remix Integration**: Framework compatibility issues

### High Risks
- **CSS Migration**: If UnoCSS needs replacement
- **Development Experience**: Plugin configuration complexity
- **Electron Builds**: Desktop app build process
- **Performance Regressions**: Build time or runtime impact

### Medium Risks
- **Environment Variables**: Configuration and exposure changes
- **Asset Processing**: Image and static asset handling
- **Chrome 129 Plugin**: Custom plugin compatibility
- **TypeScript Integration**: Path resolution and compilation

## Success Criteria

### Must Have
- ✅ Development server runs without errors
- ✅ Production build successful for all targets
- ✅ All styling systems functional (UnoCSS or replacement)
- ✅ Remix integration maintained
- ✅ Electron builds working

### Should Have
- ✅ Performance parity or improvement over Vite 5
- ✅ All plugins updated to compatible versions
- ✅ CSS system migration complete (if required)
- ✅ Deployment process unchanged
- ✅ Developer experience maintained

### Nice to Have
- ✅ Leverage new Vite 7 features for improvements
- ✅ Better build optimization and performance
- ✅ Enhanced development experience
- ✅ Reduced bundle size or build time

## Rollback Plan

### Immediate Rollback Strategy
1. **Branch Protection**: Keep Vite 5 configuration in main branch
2. **Configuration Backup**: Preserve all working plugin configs
3. **Quick Revert**: Ability to return to Vite 5 immediately
4. **CSS Backup**: If UnoCSS migration attempted, keep original classes

### Alternative Approach
1. **Parallel Development**: Run Vite 5 and 7 configurations in parallel
2. **Feature Flags**: Toggle between build systems
3. **Gradual Migration**: Migrate components one by one

## Timeline Estimate

- **Week 1**: Research phase, ecosystem analysis, UnoCSS decision
- **Week 2**: Core Vite upgrade, plugin migrations, CSS system work
- **Week 3**: Integration testing, performance optimization, documentation

## Dependencies and Prerequisites

### Must Complete First
- ✅ Safe dependency updates merged and stable
- ✅ UnoCSS vs Tailwind decision made
- ✅ Plugin ecosystem compatibility research complete

### External Dependencies
- Vite 7 stable release availability
- UnoCSS Vite 7 compatibility (or migration to Tailwind)
- All plugin Vite 7 compatible versions
- Remix Vite plugin v7 support

### Development Requirements
- Comprehensive backup of current working build
- Testing environment for all build targets
- CSS migration tools (if UnoCSS → Tailwind)
- Performance monitoring and comparison tools

---

**Prepared**: January 2025
**Next Review**: After UnoCSS Vite 7 compatibility research
**Owner**: Build/DevOps team
**Priority**: Medium (build system optimization)