# Simple Projects

A clean, minimal project management system for bolt.diy.

## Folder Structure

```
simple/
├── components/          # React components
│   ├── SimpleProjectsList.tsx    # Main projects list view
│   ├── ProjectDetails.tsx        # Project detail view with editing
│   └── TaskList.tsx              # Task management component
├── hooks/              # React hooks
│   └── useSimpleProjects.ts     # Main hook for project operations
├── services/           # External services
│   └── gitService.ts             # Git repository status checking
├── types/              # TypeScript types
│   └── simpleTypes.ts            # All type definitions
├── index.ts            # Clean exports
└── README.md           # This file
```

## Features

- **Project Management**: Create, edit, delete projects with Git URL support
- **Task Management**: Add, edit, delete tasks with priority and status
- **Git Integration**: Check repository status (accessible/inaccessible)
- **Real-time Updates**: Optimistic UI updates with database persistence
- **TypeScript**: Fully typed with clean interfaces
- **Simple Design**: Minimal, debuggable architecture

## Usage

```typescript
import { SimpleProjectsList, useSimpleProjects } from '~/components/projects/simple';

// Main component for the projects route
<SimpleProjectsList />

// Hook for custom components
const { projects, addProject, updateProject, deleteProject } = useSimpleProjects();
```

## Database

Uses IndexedDB for local storage with the following schema:
- Projects stored in 'projects' object store
- Each project has id, name, gitUrl, description, tasks, gitInfo
- Tasks are embedded within projects for simplicity