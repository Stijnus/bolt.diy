import { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  Flag,
} from 'lucide-react';
import { Button } from '~/components/ui/Button';
import type { ProjectTask, TaskStatus, TaskPriority, NewTask, UpdateTask } from './simpleTypes';

interface TaskListProps {
  projectId: string;
  tasks: ProjectTask[];
  onAddTask: (task: NewTask) => Promise<void>;
  onUpdateTask: (taskId: string, updates: UpdateTask) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

export function TaskList({ projectId, tasks, onAddTask, onUpdateTask, onDeleteTask }: TaskListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [formData, setFormData] = useState<NewTask>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
  });
  const [editData, setEditData] = useState<UpdateTask>({});

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'todo':
      default:
        return <Circle className="w-4 h-4 text-bolt-elements-status-neutral-text" />;
    }
  };

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case 'high':
        return <Flag className="w-4 h-4 text-bolt-elements-status-error-text" />;
      case 'medium':
        return <Flag className="w-4 h-4 text-bolt-elements-status-warning-text" />;
      case 'low':
        return <Flag className="w-4 h-4 text-bolt-elements-status-neutral-text" />;
    }
  };

  const filteredTasks = tasks.filter(task => filter === 'all' || task.status === filter);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    await onAddTask(formData);
    setFormData({ title: '', description: '', priority: 'medium', dueDate: '' });
    setShowAddForm(false);
  };

  const handleUpdateTask = async (taskId: string, updates: UpdateTask) => {
    await onUpdateTask(taskId, updates);
    setEditingTask(null);
    setEditData({});
  };

  const handleStatusToggle = async (task: ProjectTask) => {
    const nextStatus: TaskStatus =
      task.status === 'todo' ? 'in-progress' :
      task.status === 'in-progress' ? 'done' : 'todo';

    await onUpdateTask(task.id, { status: nextStatus });
  };

  const startEdit = (task: ProjectTask) => {
    setEditingTask(task.id);
    setEditData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
    });
  };

  const taskCounts = {
    all: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    'in-progress': tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-sm">
        <div>
          <h3 className="text-xl font-semibold text-bolt-elements-textPrimary mb-1">Tasks</h3>
          <p className="text-sm text-bolt-elements-textSecondary font-medium">
            {taskCounts.all} tasks ({taskCounts.done} completed)
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          variant="primary"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-bolt-elements-background-depth-3 p-1.5 rounded-xl border border-bolt-elements-borderColor/30 shadow-sm">
        {(['all', 'todo', 'in-progress', 'done'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              filter === status
                ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text shadow-md transform scale-105'
                : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 hover:scale-105'
            }`}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
            <span className="ml-1 text-xs opacity-75">({taskCounts[status]})</span>
          </button>
        ))}
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-bolt-elements-button-primary-background/15 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-bolt-elements-button-primary-text" />
            </div>
            <h4 className="text-lg font-semibold text-bolt-elements-textPrimary">Add New Task</h4>
          </div>
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Task Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200"
                placeholder="Enter task title..."
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200 resize-none"
                placeholder="Optional description..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                  className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-bolt-elements-textSecondary">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-bolt-elements-borderColor/50">
              <Button type="submit" variant="primary" className="shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
              <Button
                type="button"
                onClick={() => setShowAddForm(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl">
            <div className="text-bolt-elements-textSecondary font-medium">
              {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
            </div>
            <p className="text-xs text-bolt-elements-textTertiary mt-1">
              {filter === 'all' ? 'Create your first task to get started' : `Switch to another filter to see more tasks`}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="group bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl p-5 hover:bg-bolt-elements-background-depth-3 hover:border-bolt-elements-borderColorActive/30 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
            >
              {editingTask === task.id ? (
                // Edit Form
                <div className="space-y-4">
                  <input
                    type="text"
                    value={editData.title || ''}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200 font-medium"
                  />
                  <textarea
                    value={editData.description || ''}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200 resize-none"
                    rows={3}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                      value={editData.priority || task.priority}
                      onChange={(e) => setEditData({ ...editData, priority: e.target.value as TaskPriority })}
                      className="px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                    <input
                      type="date"
                      value={editData.dueDate || ''}
                      onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                      className="px-4 py-3 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary focus:border-bolt-elements-button-primary-text focus:ring-2 focus:ring-bolt-elements-button-primary-background/20 transition-all duration-200"
                    />
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-bolt-elements-borderColor/50">
                    <Button
                      onClick={() => handleUpdateTask(task.id, editData)}
                      variant="primary"
                      className="shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      Save Changes
                    </Button>
                    <Button
                      onClick={() => setEditingTask(null)}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // Task Display
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => handleStatusToggle(task)}
                    className="mt-1 hover:scale-110 transition-transform duration-200 hover:bg-bolt-elements-background-depth-1 p-1 rounded-full"
                  >
                    {getStatusIcon(task.status)}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className={`font-semibold text-lg ${
                        task.status === 'done'
                          ? 'line-through text-bolt-elements-textTertiary'
                          : 'text-bolt-elements-textPrimary group-hover:text-bolt-elements-button-primary-text'
                      } transition-colors duration-200`}>
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor/30">
                        {getPriorityIcon(task.priority)}
                        <span className="text-xs font-medium capitalize text-bolt-elements-textSecondary">{task.priority}</span>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-sm text-bolt-elements-textSecondary mb-3 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-bolt-elements-textTertiary">
                      <span className="font-medium">Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                      {task.dueDate && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-bolt-elements-background-depth-1 rounded-md">
                          <Calendar className="w-3 h-3" />
                          <span className="font-medium">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      onClick={() => startEdit(task)}
                      variant="secondary"
                      size="sm"
                      className="shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => onDeleteTask(task.id)}
                      variant="destructive"
                      size="sm"
                      className="shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}