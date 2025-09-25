# Projects Feature Documentation

## Overview

The `@app/components/projects/` directory contains a comprehensive project management system for bolt.diy that enables users to manage Git-based projects, track features, and monitor development progress. This system integrates with Git repositories, WebContainer runtime, and provides advanced analytics and time tracking capabilities.

## What It Does

The Projects feature provides:

1. **Project Management**: Create, manage, and track Git-based development projects
2. **Feature Tracking**: Break down projects into features with status tracking, time estimation, and analytics
3. **Git Integration**: Seamless integration with Git repositories including branch management and switching
4. **Time Tracking**: Built-in timer system for tracking development time across features
5. **Chat Integration**: Associate chat conversations with specific features and projects
6. **Analytics Dashboard**: Comprehensive metrics and visualizations for project performance
7. **WebContainer Integration**: Direct integration with the browser-based development environment

## Architecture Overview

### Core Components

#### 1. ProjectDashboard.tsx (`app/components/projects/ProjectDashboard.tsx:14`)
- **Main container** for the entire projects interface
- Manages project list view and individual project view
- Handles project creation, editing, and deletion
- Integrates with workbench to save current development sessions as projects

#### 2. ProjectView.tsx (`app/components/projects/ProjectView.tsx:26`)
- **Individual project interface** showing project details, features, and branches
- Manages feature creation and status updates
- Handles navigation to chat conversations for features
- Displays project statistics and progress metrics

#### 3. FeatureCard.tsx (`app/components/projects/FeatureCard.tsx:28`)
- **Individual feature display component** with status management
- Provides timer controls for time tracking
- Shows feature details including priority, complexity, tags, and assignee
- Offers "Start Working" functionality that switches Git branches and loads files

#### 4. ProjectChats.tsx (`app/components/projects/ProjectChats.tsx:13`)
- **Chat management interface** for project-associated conversations
- Lists and provides access to feature-specific chat sessions
- Maintains connection between development work and AI conversations

#### 5. AnalyticsDashboard.tsx (`app/components/projects/AnalyticsDashboard.tsx:11`)
- **Analytics and metrics visualization** component
- Tracks completion rates, velocity, time spent, and developer activity
- Provides charts and statistical insights into project progress

### Data Layer

#### Types System (`app/components/projects/types.ts`)
The type system defines comprehensive data structures:

- **Project**: Core project entity with Git URL, features, branches, analytics, and settings
- **Feature**: Individual development tasks with status, time tracking, and analytics
- **Branch**: Git branch information with commit details
- **Team Management**: Team roles, permissions, and collaboration features
- **Analytics**: Comprehensive metrics and performance tracking

#### Persistence Layer (`app/lib/persistence/useProjectHistory.ts`)
Provides complete project management functionality:

- **Project CRUD Operations**: Create, read, update, delete projects
- **Git Integration**: Clone repositories, create branches, switch branches
- **Feature Management**: Add features, update status, time tracking
- **WebContainer Integration**: Load project files into development environment
- **Chat Association**: Link conversations to specific features and projects

## Key Capabilities

### 1. Git Integration
- **Repository Management**: Clone and refresh Git repositories
- **Branch Operations**: Create feature branches, switch between branches
- **File Synchronization**: Load repository files into WebContainer environment
- **Branch Tracking**: Monitor all repository branches with commit information

### 2. Feature Management
- **Feature Creation**: Define features with descriptions, priorities, and estimates
- **Status Tracking**: Pending → In Progress → Completed workflow
- **Time Tracking**: Built-in timer system with estimated vs actual time comparison
- **Analytics**: Priority levels, complexity ratings, tag system, assignee tracking

### 3. Development Workflow Integration
- **"Start Working" Action**: One-click setup that:
  - Switches to the feature branch
  - Loads project files into WebContainer
  - Starts time tracking
  - Updates feature status to "in-progress"
- **Session Management**: Save current WebContainer session as a new project
- **Chat Integration**: Start AI conversations directly from features

### 4. Analytics and Reporting
- **Project Metrics**: Completion rates, total hours, feature counts
- **Velocity Tracking**: 7-day completion trends and performance metrics
- **Time Analysis**: Estimated vs actual time tracking with overrun alerts
- **Developer Activity**: Active contributor tracking and assignment management

### 5. Team Collaboration
- **Role-Based Permissions**: Owner, admin, developer, viewer roles
- **Team Management**: Invite members, manage permissions
- **Activity Tracking**: Monitor team actions and progress
- **Project Sharing**: Collaborate on projects across team members

## How It Works

### Project Lifecycle

1. **Creation**: Add project by providing name and Git URL
2. **Repository Setup**: System clones repository and scans branches
3. **Feature Planning**: Break project into manageable features
4. **Development**: Use "Start Working" to begin feature development
5. **Progress Tracking**: Monitor status, time, and completion metrics
6. **Chat Integration**: Use AI assistance throughout development process

### Git Branch Workflow

```typescript
// Creating a feature creates a corresponding Git branch
const feature = {
  name: "User Authentication",
  branchRef: "feature/user-auth",
  branchFrom: "main"
}

// "Start Working" performs:
// 1. Switch to feature branch
// 2. Load files into WebContainer
// 3. Start time tracking
// 4. Update status to in-progress
```

### WebContainer Integration

The system seamlessly integrates with bolt.diy's WebContainer runtime:

- **File Loading**: Project files are loaded into the browser-based development environment
- **Real-time Sync**: Changes in WebContainer can be tracked and committed
- **Branch Switching**: WebContainer content updates when switching Git branches
- **Session Persistence**: Current work can be saved as a new project

### Data Flow

```
User Action → ProjectDashboard → useProjectHistory → Database/Git Operations → WebContainer → UI Update
```

## File Structure

```
app/components/projects/
├── types.ts                    # Type definitions and interfaces
├── ProjectDashboard.tsx        # Main project interface
├── ProjectView.tsx             # Individual project view
├── ProjectCard.tsx             # Project card component
├── FeatureCard.tsx             # Feature management card
├── ProjectChats.tsx            # Chat integration component
├── AnalyticsDashboard.tsx      # Analytics and metrics
├── AddProjectDialog.tsx        # Project creation dialog
├── NewFeatureDialog.tsx        # Feature creation dialog
├── AssociateChatDialog.tsx     # Chat association dialog
├── EmptyStates.tsx             # Empty state components
├── Breadcrumb.tsx              # Navigation breadcrumb
└── ProjectChatContext.tsx      # Chat context management
```

## Integration Points

### 1. Main Application
- **Route**: `/projects` (`app/routes/projects.tsx`)
- **Navigation**: Accessible from main application menu
- **State Management**: Uses Nanostores for reactive state management

### 2. WebContainer Runtime
- **File Management**: Direct integration with `app/lib/runtime/`
- **Git Operations**: Uses isomorphic-git for browser-based Git operations
- **Development Environment**: Seamless integration with code editor and terminal

### 3. Chat System
- **Chat History**: Integration with `app/lib/persistence/useChatHistory.ts`
- **Context Passing**: Feature and project metadata passed to chat sessions
- **AI Assistance**: Contextual AI help based on current feature and project

### 4. Database Layer
- **Persistence**: Uses IndexedDB through `app/lib/persistence/db.ts`
- **Chat Association**: Links chat conversations to features and projects
- **Analytics Storage**: Tracks metrics and performance data

## Usage Examples

### Creating a Project
```typescript
// Add a new project with Git repository
const project = {
  name: "My Web App",
  gitUrl: "https://github.com/user/my-web-app.git",
  features: [],
  branches: []
}
await addNewProject(project);
```

### Adding a Feature
```typescript
// Create a feature with branch
const feature = {
  name: "User Authentication",
  branchRef: "feature/user-auth",
  branchFrom: "main",
  description: "Implement login and registration",
  priority: "high",
  estimatedHours: 8
}
await addFeature(projectId, feature);
```

### Starting Development
```typescript
// One-click development setup
await startWorkingOnFeature(projectId, featureId);
// This will:
// - Switch Git branch
// - Load files into WebContainer
// - Start time tracking
// - Update feature status
```

## Benefits

1. **Streamlined Workflow**: Eliminates context switching between Git, IDE, and project management
2. **Comprehensive Tracking**: Built-in time tracking, analytics, and progress monitoring
3. **AI Integration**: Seamless connection between development tasks and AI assistance
4. **Team Collaboration**: Role-based permissions and team management capabilities
5. **Browser-Based**: Complete development environment running in the browser
6. **Real-time Sync**: Live updates and synchronization across all project aspects

## Dependencies

- **Git Integration**: isomorphic-git for browser-based Git operations
- **UI Components**: Framer Motion for animations, Lucide React for icons
- **State Management**: Nanostores for reactive state management
- **Database**: IndexedDB for client-side data persistence
- **WebContainer**: StackBlitz WebContainer for browser-based Node.js runtime
- **Navigation**: Remix routing for single-page application navigation

The Projects feature represents a comprehensive project management solution specifically designed for modern web development workflows, providing seamless integration between project planning, Git operations, AI assistance, and browser-based development environments.

---

# Original Project Management Documentation (Legacy)

## Strategic epics (long-term)

Strategic epics define areas in which the product evolves. Usually, these epics don't overlap. They shall allow the core
team to define what they believe is most important and should be worked on with the highest priority.

You can find the [epics as issues](https://github.com/stackblitz-labs/bolt.diy/labels/epic) which are probably never
going to be closed.

What's the benefit / purpose of epics?

1. Prioritization

E. g. we could say "managing files is currently more important that quality". Then, we could thing about which features
would bring "managing files" forward. It may be different features, such as "upload local files", "import from a repo"
or also undo/redo/commit.

In a more-or-less regular meeting dedicated for that, the core team discusses which epics matter most, sketch features
and then check who can work on them. After the meeting, they update the roadmap (at least for the next development turn)
and this way communicate where the focus currently is.

2. Grouping of features

By linking features with epics, we can keep them together and document _why_ we invest work into a particular thing.

## Features (mid-term)

We all know probably a dozen of methodologies following which features are being described (User story, business
function, you name it).

However, we intentionally describe features in a more vague manner. Why? Everybody loves crisp, well-defined
acceptance-criteria, no? Well, every product owner loves it. because he knows what he'll get once it's done.

But: **here is no owner of this product**. Therefore, we grant _maximum flexibility to the developer contributing a feature_ – so that he can bring in his ideas and have most fun implementing it.

The feature therefore tries to describe _what_ should be improved but not in detail _how_.

## PRs as materialized features (short-term)

Once a developer starts working on a feature, a draft-PR _can_ be opened asap to share, describe and discuss, how the feature shall be implemented. But: this is not a must. It just helps to get early feedback and get other developers involved. Sometimes, the developer just wants to get started and then open a PR later.

In a loosely organized project, it may as well happen that multiple PRs are opened for the same feature. This is no real issue: Usually, peoply being passionate about a solution are willing to join forces and get it done together. And if a second developer was just faster getting the same feature realized: Be happy that it's been done, close the PR and look out for the next feature to implement 🤓

## PRs as change log

Once a PR is merged, a squashed commit contains the whole PR description which allows for a good change log.
All authors of commits in the PR are mentioned in the squashed commit message and become contributors 🙌
