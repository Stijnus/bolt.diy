# Theme-Safe Styling Guide

## Overview

This guide provides comprehensive guidelines for using theme variables consistently across the Bolt application to ensure proper theme switching, prevent white background leaks, and maintain visual consistency.

## Main Theme Variables Structure

The Bolt application uses CSS custom properties (variables) organized by theme context. All theme variables are defined in `variables.scss`.

### Core Structure
```
--bolt-elements-{component}-{purpose}-{variant}
```

Where:
- `component`: The UI component (e.g., `text`, `border`, `button`)
- `purpose`: The purpose/role (e.g., `Primary`, `Secondary`, `BorderColor`)
- `variant`: Optional state variation (e.g., `Hover`, `Active`, `Error`)

## Essential Theme Variables

### Text Colors
- `--bolt-elements-textPrimary`: Main text color
- `--bolt-elements-textSecondary`: Secondary text and labels
- `--bolt-elements-textTertiary`: Subtle text, hints, and descriptions

### Background Colors
- `--bolt-elements-bg-depth-1`: Main background (cards, panels)
- `--bolt-elements-bg-depth-2`: Subtle background variations
- `--bolt-elements-bg-depth-3`: Alt background for contrast
- `--bolt-elements-bg-depth-4`: Subtle accent background

### Border and Interactive Elements
- `--bolt-elements-borderColor`: Default borders
- `--bolt-elements-borderColorActive`: Active focus borders
- `--bolt-elements-focus`: Focus indicators

### Component-Specific Variables

#### Editor
- `--bolt-elements-editor-selection-backgroundColorFocused`: Editor selection colors
- `--bolt-elements-editor-activeLineBackgroundColor`: Active line highlighting
- `--bolt-elements-editor-gutter-textColor`: Line number colors

#### Messages/Chat
- `--bolt-elements-messages-background`: Message bubble backgrounds
- `--bolt-elements-messages-linkColor`: Link colors in messages
- `--bolt-elements-messages-inlineCode-background`: Code inline backgrounds

#### Buttons
- `--bolt-elements-button-primary-background`: Primary button colors
- `--bolt-elements-button-secondary-background`: Secondary button colors
- `--bolt-elements-button-danger-background`: Danger/delete button colors

## Usage Patterns

### ✅ Correct Usage Examples

```scss
// Good: Using theme variables
.my-component {
  color: var(--bolt-elements-textPrimary);
  background: var(--bolt-elements-bg-depth-1);
  border: 1px solid var(--bolt-elements-borderColor);
}

// Good: With opacity modifications
.text-secondary {
  color: var(--bolt-elements-textSecondary);
  opacity: 0.8; // Only if truly necessary
}

// Good: With fallback for customization
.highlight {
  background: var(--bolt-elements-editor-activeLineBackgroundColor, rgba(50, 53, 63, 0.05));
}
```

### ❌ Avoid These Patterns

```scss
// Bad: Hardcoded hex colors
.error-text {
  color: #dc3545; // DON'T DO THIS
}

// Bad: Hardcoded RGB/RGBA
.success-message {
  background: rgba(25, 135, 84, 0.9); // DON'T DO THIS unless terminal/editor specific
}

// Bad: Non-theme aware values
.warning-border {
  border-color: #ffc107; // DON'T DO THIS
}
```

## Implementation Checklist

Before committing changes:

1. [ ] Search for hardcoded colors: `#[0-9a-fA-F]{3,6}`
2. [ ] Verify all new colors use theme variables
3. [ ] Test both light and dark themes
4. [ ] Confirm no regressions in visual appearance
5. [ ] Update this documentation if new patterns emerge

## Terminal Colors

Terminal colors are intentionally hardcoded as they represent standard terminal color schemes and should not be replaced with theme variables:

- `--bolt-terminal-black` through `--bolt-terminal-white`
- `--bolt-terminal-brightBlack` through `--bolt-terminal-brightWhite`
- Terminal selection colors (`--bolt-terminal-selection-background`)

⚠️ **Important:** Do NOT replace these with theme variables as they represent standard terminal color schemes.

## Exceptions and Special Cases

### Acceptable Hardcoded Colors

While theme variables should be used as the primary approach, some hardcoded colors are acceptable:

1. **Terminal/Editor Colors**: `#cd3131`, `#00bc00`, etc. (standard terminal schemes)
2. **Theme-Specific Overrides**: Explicit theme colors like `#237893` for light mode editor gutters
3. **Brand Colors**: Logo and branding colors
4. **Scrollbar Colors**: Transparent overlays like `rgba(100, 100, 100, 0.3)` (though these could be themed)
5. **Browser-specific**: Colors required by browser standards or accessibility guidelines

### When to Add New Theme Variables

Add new theme variables when:
- A color is used in multiple components
- The color changes with theme switching (has both light and dark variants)
- The color serves as a semantic role (border, text, background)
- The color is used in more than 2-3 locations

### When to Keep Hardcoded Colors
- Single-use colors in isolated components
- Colors that match external standards (terminal schemes, browser defaults)
- Brand-specific colors that don't change with theme
- Colors from design system overrides that are intentionally theme-agnostic

## Future Improvements

- [ ] Audit scrollbar colors for theme consistency
- [ ] Standardize matching bracket colors
- [ ] Consider consolidating color opacity values
- [ ] Review and potentially replace terminal color fallbacks
- [ ] Convert scrollbar colors to theme variables
- [ ] Add more component-specific theme variables as needed
- [ ] Consider automatic color contrast validation

## Quick Start Reference

### Most Used Variables

```scss
// Core backgrounds
--bolt-elements-bg-depth-1       // Main app background
--bolt-elements-bg-depth-2       // Cards, panels, sidebars
--bolt-elements-textPrimary      // Main text
--bolt-elements-textSecondary    // Labels, descriptions
--bolt-elements-borderColor      // Standard borders
--bolt-elements-borderColorActive // Focus states
```

### Most Used UnoCSS Classes

```tsx
bg - bolt - elements - background - depth - 1; // Primary background
bg - bolt - elements - background - depth - 2; // Secondary background (recommended for dropdowns)
bg - bolt - elements - background - depth - 3; // Tertiary background (hover states)
text - bolt - elements - textPrimary; // Main text
text - bolt - elements - textSecondary; // Secondary text
border - bolt - elements - borderColor; // Standard border
theme - safe - button; // Theme-safe button
```

⚠️ **Important:** Don't use `bg-bolt-elements-bg-depth-*` - these classes don't exist!

### Common Patterns

```tsx
// Theme-safe container
<div className="bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">

// Interactive element
<div className="hover:bg-bolt-elements-item-backgroundActive cursor-pointer">

// Form input
<input className="bg-transparent border-bolt-elements-borderColor focus:border-bolt-elements-borderColorActive">
```

## The Problem

Browser defaults and CSS resets often introduce white backgrounds that break dark themes:

- Default `button` backgrounds
- Component library overrides (like Badge `subtle` variant)
- Framer Motion components without explicit backgrounds
- Input elements with default styling
- **Dropdown menus using incorrect CSS variable names** (common cause of white backgrounds)

## Solution: Theme-Safe Utility Classes

## Known Issue: White tiles behind icon buttons (root cause + fixes)

### Symptoms

- Rounded white/gray squares behind Lucide icons in dark mode (e.g., timer, chat, refresh, delete, close X, breadcrumb link)
- Modals showing light backgrounds despite dark theme

### Root causes

1. Button and motion elements using browser default background (not explicitly transparent)
2. A shared `.icon-button` style set a light background by default
3. Close button in Dialog had no explicit transparent background
4. Breadcrumb anchor/button wrappers not explicitly transparent
5. Dialog overlay/content hardcoded to white instead of theme tokens
6. SVG defaults can carry fill/background in some contexts if not reset

### Fix patterns (what we applied)

- Global resets in `app/styles/index.scss`:
  - Force native `button { background-color: transparent !important; appearance: none; }`
  - Ensure Lucide icons never paint backgrounds: `svg.lucide { background-color: transparent; fill: none; }`
- Component-level explicit backgrounds:
  - Added `bg-transparent` to icon buttons in ProjectCard, FeatureCard, Dialog close, Breadcrumbs
  - Changed `.icon-button` default to `background-color: transparent` and only apply hover via theme token
- Modal theming:
  - Switched overlay/content to `.modal-overlay` / `.modal-content` using theme variables

### Affected components (examples)

- Project icon actions: `app/components/projects/ProjectCard.tsx`
- Feature icon actions: `app/components/projects/FeatureCard.tsx`
- Dialog close button: `app/components/ui/Dialog.tsx` and `app/components/ui/CloseButton.tsx`
- Breadcrumb link: `app/components/ui/Breadcrumbs.tsx`
- Shared style: `app/styles/components/modal.scss` (.icon-button)

### Safe-by-default recipes

- For any clickable icon: always include `bg-transparent` on the clickable wrapper
- Prefer tokenized hover backgrounds: `hover:bg-bolt-elements-item-backgroundActive`
- In shared CSS, keep defaults transparent; add visual states only on hover/active
- Never hardcode `bg-white`/`bg-gray-*` for elements that must adapt to theme

### Quick checklist before shipping

- [ ] All icon buttons/links have `bg-transparent`
- [ ] No `.icon-button` default background; hover uses theme token
- [ ] Dialog overlay/content use `--bolt-elements-modal-*` tokens
- [ ] Global button reset + `svg.lucide` reset present in `app/styles/index.scss`
- [ ] Breadcrumbs anchors/buttons are transparent

---

### Available Classes

#### `.theme-safe-button`

Use for any button that should blend with the theme:

```tsx
<button className="theme-safe-button">
  <Icon className="w-4 h-4" />
  Click me
</button>
```

#### `.theme-safe-card`

For card containers that need reliable theming:

```tsx
<div className="theme-safe-card p-4">Card content</div>
```

#### `.theme-safe-badge`

For badges that should never show white backgrounds:

```tsx
<div className="theme-safe-badge">Badge text</div>
```

## ShadCN UI Components Integration

### Overview

Your application uses ShadCN UI components with custom theme variables. All ShadCN components have been updated to work seamlessly with your `bolt-elements` theme system.

**Available ShadCN Components:**

- **Form Components**: Button, Input, Textarea, Select, Checkbox, RadioGroup
- **Layout Components**: Card, Dialog, Sheet, Popover, HoverCard, Avatar
- **Navigation**: Tabs, DropdownMenu, Accordion
- **Feedback**: Alert, Badge, Skeleton, AlertDialog
- **All components support**: Custom theming, accessibility, and responsive design

### Available ShadCN Components

#### Core Form Components

```tsx
// ✅ Button with theme variables
<Button className="bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text">
  Primary Action
</Button>

<Button variant="secondary" className="bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text border-bolt-elements-borderColor">
  Secondary Action
</Button>

// ✅ Input with theme styling
<Input
  className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive"
  placeholder="Enter text..."
/>

// ✅ Textarea with theme styling
<Textarea
  className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive min-h-[100px]"
  placeholder="Enter long text..."
/>

// ✅ Select with theme styling
<Select>
  <SelectTrigger className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:border-bolt-elements-borderColorActive">
    <SelectValue placeholder="Select option..." />
  </SelectTrigger>
  <SelectContent className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">
    <SelectItem value="option1" className="text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive">
      Option 1
    </SelectItem>
  </SelectContent>
</Select>
```

#### Layout & Container Components

```tsx
// ✅ Card with theme styling
<Card className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">
  <CardHeader>
    <CardTitle className="text-bolt-elements-textPrimary">Card Title</CardTitle>
    <CardDescription className="text-bolt-elements-textSecondary">Card description</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-bolt-elements-textPrimary">Card content</p>
  </CardContent>
</Card>

// ✅ Dialog/Modal with theme styling
<Dialog>
  <DialogTrigger asChild>
    <Button className="bg-bolt-elements-button-primary-background">Open Dialog</Button>
  </DialogTrigger>
  <DialogContent className="bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor">
    <DialogHeader>
      <DialogTitle className="text-bolt-elements-textPrimary">Dialog Title</DialogTitle>
      <DialogDescription className="text-bolt-elements-textSecondary">Dialog description</DialogDescription>
    </DialogHeader>
  </DialogContent>
</Dialog>

// ✅ Sheet/Sidebar with theme styling
<Sheet>
  <SheetTrigger asChild>
    <Button className="bg-bolt-elements-button-secondary-background">Open Sidebar</Button>
  </SheetTrigger>
  <SheetContent className="bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor">
    <SheetHeader>
      <SheetTitle className="text-bolt-elements-textPrimary">Sidebar Title</SheetTitle>
      <SheetDescription className="text-bolt-elements-textSecondary">Sidebar content</SheetDescription>
    </SheetHeader>
  </SheetContent>
</Sheet>
```

#### Navigation Components

```tsx
// ✅ Tabs with theme styling
<Tabs defaultValue="tab1" className="w-full">
  <TabsList className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">
    <TabsTrigger
      value="tab1"
      className="text-bolt-elements-textSecondary data-[state=active]:text-bolt-elements-textPrimary data-[state=active]:bg-bolt-elements-background-depth-1"
    >
      Tab 1
    </TabsTrigger>
    <TabsTrigger
      value="tab2"
      className="text-bolt-elements-textSecondary data-[state=active]:text-bolt-elements-textPrimary data-[state=active]:bg-bolt-elements-background-depth-1"
    >
      Tab 2
    </TabsTrigger>
  </TabsList>
  <TabsContent value="tab1" className="text-bolt-elements-textPrimary">
    Tab content 1
  </TabsContent>
</Tabs>

// ✅ Dropdown Menu with theme styling
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary">
      Open Menu
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">
    <DropdownMenuItem className="text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive">
      Menu Item 1
    </DropdownMenuItem>
    <DropdownMenuItem className="text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive">
      Menu Item 2
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

#### Feedback Components

```tsx
// ✅ Alert with theme styling
<Alert className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">
  <AlertCircle className="h-4 w-4 text-bolt-elements-icon-error" />
  <AlertTitle className="text-bolt-elements-textPrimary">Alert Title</AlertTitle>
  <AlertDescription className="text-bolt-elements-textSecondary">Alert description</AlertDescription>
</Alert>

// ✅ Badge with theme styling
<Badge className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">
  Status Badge
</Badge>

// ✅ Skeleton with theme styling
<Skeleton className="bg-bolt-elements-background-depth-3 h-4 w-32" />
```

#### Advanced Components

```tsx
// ✅ Accordion with theme styling
<Accordion type="single" collapsible className="w-full">
  <AccordionItem value="item-1" className="border-bolt-elements-borderColor">
    <AccordionTrigger className="text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary">
      Accordion Item 1
    </AccordionTrigger>
    <AccordionContent className="text-bolt-elements-textSecondary">
      Accordion content 1
    </AccordionContent>
  </AccordionItem>
</Accordion>

// ✅ Radio Group with theme styling
<RadioGroup className="space-y-2">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option1" className="border-bolt-elements-borderColor text-bolt-elements-item-contentAccent" />
    <Label className="text-bolt-elements-textPrimary">Option 1</Label>
  </div>
</RadioGroup>

// ✅ Popover with theme styling
<Popover>
  <PopoverTrigger asChild>
    <Button className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary">
      Open Popover
    </Button>
  </PopoverTrigger>
  <PopoverContent className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">
    <p className="text-bolt-elements-textPrimary">Popover content</p>
  </PopoverContent>
</Popover>

// ✅ Hover Card with theme styling
<HoverCard>
  <HoverCardTrigger asChild>
    <Button className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary">
      Hover me
    </Button>
  </HoverCardTrigger>
  <HoverCardContent className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">
    <p className="text-bolt-elements-textPrimary">Hover card content</p>
  </HoverCardContent>
</HoverCard>

// ✅ Avatar with theme styling
<Avatar className="border-bolt-elements-borderColor">
  <AvatarImage src="/avatar.jpg" alt="Avatar" />
  <AvatarFallback className="bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary">
    AB
  </AvatarFallback>
</Avatar>
```

### ShadCN Component Customization Patterns

#### Override Default Styles

```tsx
// Override ShadCN default styles with your theme
<Button className="!bg-bolt-elements-button-primary-background !hover:bg-bolt-elements-button-primary-backgroundHover !text-bolt-elements-button-primary-text">
  Custom Themed Button
</Button>

// Combine ShadCN variants with theme overrides
<Card className="border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 [&>div]:border-bolt-elements-borderColor">
  <CardContent className="text-bolt-elements-textPrimary">
    Custom themed card content
  </CardContent>
</Card>
```

#### Theme-Aware Component Props

```tsx
// Use theme variables in component props
const themeClasses = {
  input: "bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary",
  button: "bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover",
  card: "bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor"
};

// Apply theme classes
<Input className={themeClasses.input} />
<Button className={themeClasses.button}>Action</Button>
<Card className={themeClasses.card}>Content</Card>
```

### ShadCN Component Best Practices

#### 1. Always Override Backgrounds

```tsx
// ✅ Always specify background colors for ShadCN components
<Card className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">
<Button className="bg-bolt-elements-button-primary-background">
<DialogContent className="bg-bolt-elements-background-depth-1">
```

#### 2. Use Theme Variables for Colors

```tsx
// ✅ Use CSS variables for consistency
className = 'text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor';

// ❌ Avoid hardcoded colors
className = 'text-gray-900 bg-white border-gray-300';
```

#### 3. Handle Focus States

```tsx
// ✅ Include focus states for accessibility
<Input className="focus:border-bolt-elements-borderColorActive focus:ring-bolt-elements-borderColorActive" />
<Button className="focus:ring-2 focus:ring-bolt-elements-borderColorActive" />
```

#### 4. Responsive Design

```tsx
// ✅ Use responsive classes
<Card className="w-full md:w-1/2 lg:w-1/3">
<DialogContent className="max-w-md mx-auto">
```

#### 5. Animation Integration

```tsx
// ✅ Combine with Framer Motion
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
  <Card className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">Animated Card</Card>
</motion.div>
```

## Component-Specific Guidelines

### Dropdown Menus

**Updated with ShadCN DropdownMenu:** Your application now uses ShadCN DropdownMenu components with proper theme integration.

#### ShadCN DropdownMenu Usage

```tsx
// ✅ Use ShadCN DropdownMenu with theme variables
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary">
      Open Menu
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">
    <DropdownMenuItem className="text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive">
      Menu Item
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Common Issue:** White backgrounds in dropdown components due to incorrect CSS variable naming.

❌ **Don't use:** Incorrect CSS variable names

```tsx
// WRONG - These CSS variables don't exist as UnoCSS classes
className = 'bg-bolt-elements-bg-depth-1'; // ❌ Missing "background" in name
className = 'bg-bolt-elements-bg-depth-2'; // ❌ Missing "background" in name
```

✅ **Do use:** Correct CSS variable names

```tsx
// CORRECT - These map to actual CSS variables
className = 'bg-bolt-elements-background-depth-1'; // ✅ Primary background
className = 'bg-bolt-elements-background-depth-2'; // ✅ Secondary background (recommended for dropdowns)
className = 'bg-bolt-elements-background-depth-3'; // ✅ Tertiary background (for hover states)
```

**Complete dropdown pattern:**

```tsx
// Dropdown trigger button
<button className={classNames(
  'flex items-center gap-2 rounded-lg px-3 py-1.5',
  'text-sm text-bolt-elements-textPrimary',
  'bg-bolt-elements-background-depth-2',
  'border border-bolt-elements-borderColor',
  'hover:bg-bolt-elements-item-backgroundActive'
)}>

// Dropdown content
<DropdownMenu.Content className={classNames(
  'min-w-[200px] rounded-lg shadow-lg py-1',
  'bg-bolt-elements-background-depth-2',
  'border border-bolt-elements-borderColor'
)}>

// Dropdown items
<DropdownMenu.Item className={classNames(
  'flex items-center px-4 py-2.5 text-sm cursor-pointer',
  'text-bolt-elements-textPrimary',
  'hover:bg-bolt-elements-item-backgroundActive'
)}>
```

### Buttons

❌ **Don't:**

```tsx
<button className="p-2 rounded"> // May get white background
<Button variant="default">      // May show white in some themes
```

✅ **Do:**

```tsx
<button className="theme-safe-button p-2 rounded">
<Button variant="ghost" className="!bg-transparent">
```

### Badges

❌ **Don't:**

```tsx
<Badge variant="subtle">Text</Badge> // OLD: Used bg-white/50
```

✅ **Do:**

```tsx
<Badge variant="subtle">Text</Badge> // NOW: Uses theme-safe backgrounds
```

### Motion Components

❌ **Don't:**

```tsx
<motion.button onClick={handler}>  // No explicit background
```

✅ **Do:**

```tsx
<motion.button className="theme-safe-button" onClick={handler}>
```

### ShadCN UI Components

✅ **Do use ShadCN components** with your custom theme variables:

```tsx
// ShadCN Button with theme variables
<Button className="bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text">
  Primary Action
</Button>

// ShadCN Input with theme styling
<Input
  className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive"
  placeholder="Enter text..."
/>

// ShadCN Card with theme-safe styling
<Card className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor">
  <CardHeader>
    <CardTitle className="text-bolt-elements-textPrimary">Card Title</CardTitle>
    <CardDescription className="text-bolt-elements-textSecondary">Card description</CardDescription>
  </CardHeader>
</Card>
```

## CSS Variable Usage

Always prefer CSS variables over hardcoded colors:

✅ **Theme-aware:**

```scss
.my-component {
  background-color: var(--bolt-elements-bg-depth-1);
  color: var(--bolt-elements-textPrimary);
  border-color: var(--bolt-elements-borderColor);
}
```

❌ **Theme-breaking:**

```scss
.my-component {
  background-color: white;
  color: black;
  border-color: #ccc;
}
```

## Complete CSS Variables Reference

### Core Backgrounds & Layout

- `--bolt-elements-bg-depth-1` - Primary backgrounds (main app background)
- `--bolt-elements-bg-depth-2` - Secondary backgrounds (cards, panels)
- `--bolt-elements-bg-depth-3` - Tertiary backgrounds (nested elements)
- `--bolt-elements-bg-depth-4` - Quaternary backgrounds (deep nesting)
- `--bolt-elements-background-depth-1` - Alias for bg-depth-1

### Text Hierarchy

- `--bolt-elements-textPrimary` - Main text content
- `--bolt-elements-textSecondary` - Muted text (labels, descriptions)
- `--bolt-elements-textTertiary` - Subtle text (hints, timestamps)

### Interactive Elements

- `--bolt-elements-item-backgroundDefault` - Default item backgrounds
- `--bolt-elements-item-backgroundActive` - Active/hover item backgrounds
- `--bolt-elements-item-backgroundAccent` - Accent/highlight backgrounds
- `--bolt-elements-item-backgroundDanger` - Error/warning backgrounds
- `--bolt-elements-item-contentDefault` - Default item text/icons
- `--bolt-elements-item-contentActive` - Active item text/icons
- `--bolt-elements-item-contentAccent` - Accent item text/icons
- `--bolt-elements-item-contentDanger` - Danger item text/icons

### Buttons (3 Variants)

- `--bolt-elements-button-primary-background` - Primary button background
- `--bolt-elements-button-primary-backgroundHover` - Primary button hover
- `--bolt-elements-button-primary-text` - Primary button text
- `--bolt-elements-button-secondary-background` - Secondary button background
- `--bolt-elements-button-secondary-backgroundHover` - Secondary button hover
- `--bolt-elements-button-secondary-text` - Secondary button text
- `--bolt-elements-button-danger-background` - Danger button background
- `--bolt-elements-button-danger-backgroundHover` - Danger button hover
- `--bolt-elements-button-danger-text` - Danger button text

### Code & Syntax

- `--bolt-elements-code-background` - Code block backgrounds
- `--bolt-elements-code-text` - Code text color
- `--bolt-elements-actions-background` - Action panel backgrounds
- `--bolt-elements-actions-code-background` - Action code backgrounds

### Messages & Chat

- `--bolt-elements-messages-background` - Message bubble backgrounds
- `--bolt-elements-messages-linkColor` - Link colors in messages
- `--bolt-elements-messages-code-background` - Message code backgrounds
- `--bolt-elements-messages-inlineCode-background` - Inline code backgrounds
- `--bolt-elements-messages-inlineCode-text` - Inline code text

### Artifacts & Content

- `--bolt-elements-artifacts-background` - Artifact backgrounds
- `--bolt-elements-artifacts-backgroundHover` - Artifact hover states
- `--bolt-elements-artifacts-borderColor` - Artifact borders
- `--bolt-elements-artifacts-inlineCode-background` - Artifact inline code
- `--bolt-elements-artifacts-inlineCode-text` - Artifact inline code text

### UI Components

- `--bolt-elements-borderColor` - Standard borders
- `--bolt-elements-borderColorActive` - Focus/active borders
- `--bolt-elements-dividerColor` - Divider lines
- `--bolt-elements-prompt-background` - Prompt/input backgrounds

### Icons & Indicators

- `--bolt-elements-icon-success` - Success state icons
- `--bolt-elements-icon-error` - Error state icons
- `--bolt-elements-icon-primary` - Primary icons
- `--bolt-elements-icon-secondary` - Secondary icons
- `--bolt-elements-icon-tertiary` - Tertiary icons

### Specialized Components

- `--bolt-elements-sidebar-dropdownShadow` - Sidebar shadows
- `--bolt-elements-sidebar-buttonBackgroundDefault` - Sidebar button default
- `--bolt-elements-sidebar-buttonBackgroundHover` - Sidebar button hover
- `--bolt-elements-sidebar-buttonText` - Sidebar button text
- `--bolt-elements-preview-addressBar-background` - Address bar background
- `--bolt-elements-preview-addressBar-backgroundHover` - Address bar hover
- `--bolt-elements-preview-addressBar-backgroundActive` - Address bar active
- `--bolt-elements-preview-addressBar-text` - Address bar text
- `--bolt-elements-preview-addressBar-textActive` - Address bar active text
- `--bolt-elements-terminals-background` - Terminal backgrounds
- `--bolt-elements-terminals-buttonBackground` - Terminal button backgrounds
- `--bolt-elements-cta-background` - Call-to-action backgrounds
- `--bolt-elements-cta-text` - Call-to-action text

### Loading & Progress

- `--bolt-elements-loader-background` - Loader track background
- `--bolt-elements-loader-progress` - Loader progress color

## Color Primitives & Alpha Variants

### Base Colors (Available in UnoCSS)

- `white` - Pure white (#FFFFFF)
- `gray-50` through `gray-950` - Complete gray scale
- `accent-50` through `accent-950` - Theme accent colors
- `green-50` through `green-950` - Success colors
- `red-50` through `red-950` - Error/danger colors
- `orange-50` through `orange-950` - Warning colors

### Alpha Variants

Use alpha transparency with any base color:

```tsx
// Alpha variants (1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100)
bg - white / 10; // 10% white overlay
bg - gray - 900 / 80; // 80% gray overlay
bg - accent - 500 / 20; // 20% accent overlay
```

### Common Alpha Patterns

```tsx
// Subtle overlays
bg - white / 5; // Very subtle light overlay (dark theme)
bg - black / 10; // Subtle dark overlay (light theme)

// Hover states
hover: bg - white / 10; // Light hover effect
hover: bg - black / 5; // Dark hover effect

// Active states
active: bg - accent - 500 / 20; // Accent active state
```

## Testing for White Background Leaks

1. **Switch to dark theme** in the app
2. **Look for any white elements** that stand out
3. **Check browser dev tools** for:
   - `background-color: white`
   - `background-color: #fff`
   - Missing background declarations on buttons

## Troubleshooting Dropdown White Backgrounds

### Step 1: Identify the Issue

If you see white backgrounds in dropdown menus:

1. Open browser dev tools
2. Inspect the problematic dropdown element
3. Look for CSS classes like `bg-bolt-elements-bg-depth-*`
4. Check if the background-color is defaulting to white/transparent

### Step 2: Check CSS Variable Names

**Common mistake:** Using shortened variable names that don't exist as UnoCSS classes.

```bash
# Search for problematic patterns in your codebase
grep -r "bg-bolt-elements-bg-depth" app/components/
```

### Step 3: Fix the Variable Names

Replace incorrect variable names:

| ❌ Incorrect                  | ✅ Correct                            |
| ----------------------------- | ------------------------------------- |
| `bg-bolt-elements-bg-depth-1` | `bg-bolt-elements-background-depth-1` |
| `bg-bolt-elements-bg-depth-2` | `bg-bolt-elements-background-depth-2` |
| `bg-bolt-elements-bg-depth-3` | `bg-bolt-elements-background-depth-3` |

### Step 4: Verify the Fix

1. Refresh the page
2. Switch between light and dark themes
3. Confirm dropdown backgrounds adapt correctly

## Quick Fixes

If you find white backgrounds:

1. **For buttons:** Add `theme-safe-button` class
2. **For custom elements:** Use `!bg-transparent` or proper CSS variables
3. **For component libraries:** Override with `!important` and CSS variables
4. **For motion components:** Add explicit `background-color: transparent`

## Prevention Checklist

Before committing new UI components:

- [ ] No hardcoded white/black colors
- [ ] Buttons use `theme-safe-button` or explicit `bg-transparent`
- [ ] All backgrounds use CSS variables
- [ ] **Dropdowns use correct `bg-bolt-elements-background-depth-*` naming**
- [ ] **No `bg-bolt-elements-bg-depth-*` classes (these don't exist)**
- [ ] Tested in both light and dark themes
- [ ] Motion components have explicit background colors
- [ ] Dropdown menus tested in both light and dark themes
- [ ] **ShadCN Components use theme variables**
- [ ] **ShadCN components have explicit background colors**
- [ ] **ShadCN focus states use `bolt-elements-borderColorActive`**
- [ ] **ShadCN text uses `bolt-elements-textPrimary/Secondary`**

## ShadCN Component Migration Guide

### From HTML Elements to ShadCN Components

#### Input Fields

```tsx
// Before: HTML input
<input
  type="text"
  className="w-full px-3 py-2 rounded-lg border bg-white text-black focus:border-blue-500"
  placeholder="Enter text..."
/>

// After: ShadCN Input
<Input
  className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive"
  placeholder="Enter text..."
/>
```

#### Text Areas

```tsx
// Before: HTML textarea
<textarea
  className="w-full px-3 py-2 rounded-lg border bg-white text-black focus:border-blue-500"
  rows={4}
  placeholder="Enter text..."
/>

// After: ShadCN Textarea
<Textarea
  className="bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive min-h-[100px]"
  placeholder="Enter text..."
/>
```

#### Buttons

```tsx
// Before: HTML/Custom button
<button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
  Click me
</button>

// After: ShadCN Button
<Button className="bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text">
  Click me
</Button>
```

### Theme Integration Patterns

#### Consistent Component Styling

```tsx
// Create reusable theme classes
const themeClasses = {
  form: {
    input: "bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive",
    textarea: "bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive min-h-[100px]",
    select: "bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:border-bolt-elements-borderColorActive"
  },
  layout: {
    card: "bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor",
    dialog: "bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor",
    popover: "bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor"
  }
};

// Use consistently
<Input className={themeClasses.form.input} />
<Card className={themeClasses.layout.card}>
  <Textarea className={themeClasses.form.textarea} />
</Card>
```

#### Component Variants

```tsx
// Define theme-aware variants
const buttonVariants = {
  primary: "bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text",
  secondary: "bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text border-bolt-elements-borderColor",
  danger: "bg-bolt-elements-button-danger-background hover:bg-bolt-elements-button-danger-backgroundHover text-bolt-elements-button-danger-text"
};

// Use variants
<Button className={buttonVariants.primary}>Primary Action</Button>
<Button className={buttonVariants.secondary}>Secondary Action</Button>
<Button className={buttonVariants.danger}>Delete</Button>
```

### Component-Specific Theme Overrides

#### Dialog Components

```tsx
<Dialog>
  <DialogContent className="bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor">
    <DialogHeader>
      <DialogTitle className="text-bolt-elements-textPrimary">Modal Title</DialogTitle>
      <DialogDescription className="text-bolt-elements-textSecondary">Modal description</DialogDescription>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

#### Sheet/Sidebar Components

```tsx
<Sheet>
  <SheetContent className="bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor">
    <SheetHeader>
      <SheetTitle className="text-bolt-elements-textPrimary">Sidebar Title</SheetTitle>
      <SheetDescription className="text-bolt-elements-textSecondary">Sidebar content</SheetDescription>
    </SheetHeader>
  </SheetContent>
</Sheet>
```

### Accessibility & Focus Management

#### Focus States

```tsx
// Always include proper focus states for accessibility
<Input
  className="
    bg-bolt-elements-background-depth-2
    border-bolt-elements-borderColor
    text-bolt-elements-textPrimary
    placeholder:text-bolt-elements-textTertiary
    focus:border-bolt-elements-borderColorActive
    focus:ring-2
    focus:ring-bolt-elements-borderColorActive/20
    focus:outline-none
  "
/>
```

#### Screen Reader Support

```tsx
// Ensure proper ARIA labels and descriptions
<Input
  aria-label="Search input"
  aria-describedby="search-help"
/>
<div id="search-help" className="sr-only">
  Search through available options
</div>
```

### Performance Considerations

#### Bundle Size

```tsx
// Import only what you need
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';

// Avoid importing entire libraries
// ❌ import * as UI from '~/components/ui';
// ✅ import { Button, Input } from '~/components/ui';
```

#### Theme Variable Usage

```tsx
// Use CSS variables for runtime theme switching
const dynamicTheme = {
  light: {
    bg: 'bg-white',
    text: 'text-gray-900',
    border: 'border-gray-300',
  },
  dark: {
    bg: 'bg-gray-900',
    text: 'text-white',
    border: 'border-gray-700',
  },
};

// Use with ShadCN components
<Card className={`${dynamicTheme[theme].bg} ${dynamicTheme[theme].border}`}>
  <p className={dynamicTheme[theme].text}>Content</p>
</Card>;
```

## UnoCSS Theme Integration

### Bolt Theme Classes

Use these UnoCSS classes instead of hardcoded colors:

```tsx
// ✅ Theme-aware styling
<div className="bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary border-bolt-elements-borderColor">
  <button className="bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text">
    Primary Action
  </button>
</div>

// ❌ Avoid hardcoded colors
<div className="bg-white text-black border-gray-300">
  <button className="bg-blue-500 hover:bg-blue-600 text-white">
    Primary Action
  </button>
</div>
```

### Common UnoCSS Patterns

#### Interactive Elements

```tsx
// List items with proper hover states
<div className="bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive">
  Item Content
</div>

// Focus states for accessibility
<button className="focus:ring-2 focus:ring-bolt-elements-borderColorActive focus:outline-none">
  Focusable Button
</button>
```

#### Cards and Panels

```tsx
// Theme-safe card with proper borders
<div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-4">
  <h3 className="text-bolt-elements-textPrimary">Card Title</h3>
  <p className="text-bolt-elements-textSecondary">Card description</p>
</div>
```

#### Form Elements

```tsx
// Input with theme-aware styling
<input
  className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive"
  placeholder="Enter text..."
/>

// Checkbox styling
<input type="checkbox" className="accent-bolt-elements-item-contentAccent" />
```

## Additional Utility Classes

### Modern Scrollbars

```tsx
// Apply to containers with scrolling
<div className="modern-scrollbar h-64 overflow-auto">
  {/* Scrollable content */}
</div>

// Inverted scrollbars (darker theme)
<div className="modern-scrollbar-invert h-64 overflow-auto">
  {/* Content */}
</div>
```

### Icon Button Pattern

```tsx
// Consistent icon button styling
<button className="icon-button">
  <Icon className="w-4 h-4" />
</button>
```

## Icon Libraries & Usage

### Available Icon Libraries

#### 1. Bolt Custom Icons (`i-bolt:`)

Custom SVG icons for frameworks, logos, and app-specific icons:

```tsx
// Framework logos
<i-bolt:react className="w-6 h-6" />
<i-bolt:vue className="w-6 h-6" />
<i-bolt:angular className="w-6 h-6" />
<i-bolt:svelte className="w-6 h-6" />

// App-specific icons
<i-bolt:chat className="w-5 h-5" />
<i-bolt:mcp className="w-5 h-5" />
<i-bolt:stars className="w-5 h-5" />

// Technology logos
<i-bolt:typescript className="w-6 h-6" />
<i-bolt:vite className="w-6 h-6" />
<i-bolt:netlify className="w-6 h-6" />
```

**Available Bolt Icons:**
`angular`, `astro`, `chat`, `expo-brand`, `expo`, `logo-text`, `logo`, `mcp`, `nativescript`, `netlify`, `nextjs`, `nuxt`, `qwik`, `react`, `remix`, `remotion`, `shadcn`, `slidev`, `solidjs`, `stars`, `svelte`, `typescript`, `vite`, `vue`

#### 2. Lucide Icons (React Components)

Primary icon library using Lucide React components:

```tsx
import { Heart, User, Settings, Star, CheckCircle, XCircle } from 'lucide-react';

// Basic usage
<Heart className="w-5 h-5 text-bolt-elements-textPrimary" />
<User className="w-5 h-5 text-bolt-elements-textSecondary" />
<Settings className="w-4 h-4 text-bolt-elements-icon-primary" />

// With stroke width variations
<Star className="w-5 h-5" strokeWidth={1} />  // Thin
<Star className="w-5 h-5" strokeWidth={2} />  // Regular (default)
<Star className="w-5 h-5" strokeWidth={3} />  // Thick
```

### Icon Styling Best Practices

#### Theme-Aware Icons

```tsx
import { User, Gear, Heart } from 'lucide-react';

// ✅ Theme-aware icon colors
<User className="w-5 h-5 text-bolt-elements-textPrimary" />
<Gear className="w-5 h-5 text-bolt-elements-textSecondary" />
<Heart className="w-5 h-5 text-bolt-elements-icon-success" />

// ❌ Avoid hardcoded colors
<User className="w-5 h-5 text-gray-900" />  // Breaks in dark theme
<Gear className="w-5 h-5 text-black" />     // Invisible in dark theme
```

#### Interactive Icons

```tsx
import { Heart, Star } from 'lucide-react';

// Icon buttons with proper hover states
<button className="icon-button">
  <Heart className="w-4 h-4" />
</button>

// Hover effects
<div className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors">
  <Star className="w-4 h-4" />
</div>
```

#### Icon Sizing Consistency

```tsx
import { User } from 'lucide-react';

// Standard sizes (use consistently)
<User className="w-4 h-4" />     // Small icons
<User className="w-5 h-5" />     // Medium icons (default)
<User className="w-6 h-6" />     // Large icons

// Stroke width variations for emphasis
<User className="w-5 h-5" strokeWidth={1} />   // Thin/subtle
<User className="w-5 h-5" strokeWidth={2} />   // Regular (default)
<User className="w-5 h-5" strokeWidth={3} />   // Thick/bold
```

### Common Icon Patterns

#### Status Indicators

```tsx
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

// Success states
<div className="flex items-center gap-2">
  <CheckCircle className="w-4 h-4 text-bolt-elements-icon-success" />
  <span className="text-bolt-elements-textSecondary">Operation successful</span>
</div>

// Error states
<div className="flex items-center gap-2">
  <XCircle className="w-4 h-4 text-bolt-elements-icon-error" />
  <span className="text-bolt-elements-textSecondary">Operation failed</span>
</div>

// Loading states
<div className="flex items-center gap-2">
  <Loader2 className="w-4 h-4 animate-spin text-bolt-elements-textSecondary" />
  <span className="text-bolt-elements-textSecondary">Loading...</span>
</div>
```

#### Navigation & Actions

```tsx
import { Home, Pencil, Trash2 } from 'lucide-react';

// Navigation items
<button className="flex items-center gap-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary">
  <Home className="w-4 h-4" />
  Home
</button>

// Action buttons
<button className="icon-button">
  <Pencil className="w-4 h-4" />
</button>

<button className="icon-button">
  <Trash2 className="w-4 h-4" />
</button>
```

### Icon Library Priority

1. **Bolt Icons First**: Use `i-bolt:` for app-specific, framework, and logo icons
2. **Lucide Icons**: Primary icon library for all general UI icons (recommended for consistency)
3. **UnoCSS Icons**: Limited use for special cases (sizes auto-optimized)

### Keyboard Display

```tsx
// For showing keyboard shortcuts
<kbd className="kdb">Ctrl+K</kbd>
```

## Component-Specific Patterns

### Buttons

```tsx
// Primary button
<button className="bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text px-4 py-2 rounded-md transition-theme">
  Primary
</button>

// Secondary button
<button className="bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text px-4 py-2 rounded-md transition-theme border border-bolt-elements-borderColor">
  Secondary
</button>

// Danger button
<button className="bg-bolt-elements-button-danger-background hover:bg-bolt-elements-button-danger-backgroundHover text-bolt-elements-button-danger-text px-4 py-2 rounded-md transition-theme">
  Delete
</button>
```

### Status Indicators

```tsx
// Success status
<div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-bolt-elements-icon-success"></div>
  <span className="text-bolt-elements-textSecondary">Operation completed</span>
</div>

// Error status
<div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-bolt-elements-icon-error"></div>
  <span className="text-bolt-elements-textSecondary">Operation failed</span>
</div>
```

### Loading States

```tsx
// Loading spinner
<div className="flex items-center gap-2">
  <div className="w-4 h-4 border-2 border-bolt-elements-loader-background border-t-bolt-elements-loader-progress rounded-full animate-spin"></div>
  <span className="text-bolt-elements-textSecondary">Loading...</span>
</div>
```

## Emergency Override Pattern

If you must override stubborn white backgrounds:

```tsx
className={classNames(
  "theme-safe-button", // Preferred method
  "!bg-transparent",   // Force override if needed
  someCondition && "!bg-purple-500/20" // Conditional states
)}
```

Remember: `!important` should be used sparingly and only when overriding third-party components or browser defaults.
