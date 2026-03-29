import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Task, Subtask } from '../types';

type Tab = 'list' | 'gantt';

interface TaskFormData {
  title: string;
  notes: string;
  startDate: string;
  endDate: string;
  assignee: string;
  completed: boolean;
  dependsOn: string[];
}

interface SubtaskFormData {
  title: string;
  notes: string;
  startDate: string;
  endDate: string;
  assignee: string;
  completed: boolean;
}

const emptyTaskForm: TaskFormData = {
  title: '', notes: '', startDate: '', endDate: '', assignee: '', completed: false, dependsOn: [],
};
const emptySubtaskForm: SubtaskFormData = {
  title: '', notes: '', startDate: '', endDate: '', assignee: '', completed: false,
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function dayDiff(laterDate: string, earlierDate: string): number {
  const later = new Date(laterDate + 'T00:00:00');
  const earlier = new Date(earlierDate + 'T00:00:00');
  return Math.round((later.getTime() - earlier.getTime()) / 86400000);
}

export default function Tasks() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<Tab>('list');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [taskModal, setTaskModal] = useState<{ open: boolean; editTask?: Task }>({ open: false });
  const [subtaskModal, setSubtaskModal] = useState<{ open: boolean; taskId: string; editSubtask?: Subtask }>({ open: false, taskId: '' });
  const [taskForm, setTaskForm] = useState<TaskFormData>(emptyTaskForm);
  const [subtaskForm, setSubtaskForm] = useState<SubtaskFormData>(emptySubtaskForm);

  const toggleExpand = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openNewTask = () => {
    setTaskForm(emptyTaskForm);
    setTaskModal({ open: true });
  };

  const openEditTask = (task: Task) => {
    setTaskForm({
      title: task.title,
      notes: task.notes,
      startDate: task.startDate ?? '',
      endDate: task.endDate ?? '',
      assignee: task.assignee ?? '',
      completed: task.completed,
      dependsOn: task.dependsOn ?? [],
    });
    setTaskModal({ open: true, editTask: task });
  };

  const saveTask = () => {
    if (!taskForm.title.trim()) return;

    if (taskModal.editTask) {
      const oldTask = taskModal.editTask;
      const oldEnd = oldTask.endDate;
      const newEnd = taskForm.endDate;

      // Check if end date was pushed out → cascade to dependents
      if (oldEnd && newEnd && newEnd > oldEnd) {
        const shift = dayDiff(newEnd, oldEnd);
        const dependents = state.tasks.filter(
          t => t.id !== oldTask.id && (t.dependsOn ?? []).includes(oldTask.id) && t.startDate
        );
        if (dependents.length > 0) {
          const names = dependents.map(t => `"${t.title}"`).join(', ');
          const proceed = confirm(
            `Postponing "${oldTask.title}" by ${shift} day(s) will also shift:\n${names}\nby ${shift} day(s). Proceed?`
          );
          if (proceed) {
            dependents.forEach(t => {
              dispatch({
                type: 'UPDATE_TASK',
                payload: {
                  ...t,
                  startDate: t.startDate ? addDays(t.startDate, shift) : t.startDate,
                  endDate: t.endDate ? addDays(t.endDate, shift) : t.endDate,
                },
              });
            });
          }
        }
      }

      dispatch({ type: 'UPDATE_TASK', payload: { ...oldTask, ...taskForm } });
    } else {
      dispatch({ type: 'ADD_TASK', payload: { ...taskForm, subtasks: [], dependsOn: taskForm.dependsOn } });
    }
    setTaskModal({ open: false });
  };

  const deleteTask = (id: string) => {
    if (confirm('Delete task?')) dispatch({ type: 'DELETE_TASK', payload: id });
  };

  const openNewSubtask = (taskId: string) => {
    setSubtaskForm(emptySubtaskForm);
    setSubtaskModal({ open: true, taskId });
  };

  const openEditSubtask = (taskId: string, subtask: Subtask) => {
    setSubtaskForm({
      title: subtask.title, notes: subtask.notes,
      startDate: subtask.startDate ?? '', endDate: subtask.endDate ?? '',
      assignee: subtask.assignee ?? '', completed: subtask.completed,
    });
    setSubtaskModal({ open: true, taskId, editSubtask: subtask });
  };

  const saveSubtask = () => {
    if (!subtaskForm.title.trim()) return;
    if (subtaskModal.editSubtask) {
      dispatch({ type: 'UPDATE_SUBTASK', payload: { taskId: subtaskModal.taskId, subtask: { ...subtaskModal.editSubtask, ...subtaskForm } } });
    } else {
      dispatch({ type: 'ADD_SUBTASK', payload: { taskId: subtaskModal.taskId, subtask: { ...subtaskForm, parentId: subtaskModal.taskId, dependsOn: [] } } });
    }
    setSubtaskModal({ open: false, taskId: '' });
  };

  const deleteSubtask = (taskId: string, subtaskId: string) => {
    if (confirm('Delete subtask?')) dispatch({ type: 'DELETE_SUBTASK', payload: { taskId, subtaskId } });
  };

  const toggleTaskComplete = (task: Task) => {
    dispatch({ type: 'UPDATE_TASK', payload: { ...task, completed: !task.completed } });
  };

  const toggleSubtaskComplete = (taskId: string, subtask: Subtask) => {
    dispatch({ type: 'UPDATE_SUBTASK', payload: { taskId, subtask: { ...subtask, completed: !subtask.completed } } });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-white border-b flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Tasks</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('list')} className={`px-3 py-1 rounded text-sm ${tab === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>List</button>
          <button onClick={() => setTab('gantt')} className={`px-3 py-1 rounded text-sm ${tab === 'gantt' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Gantt</button>
        </div>
        <button onClick={openNewTask} className="ml-auto bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+ Add Task</button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === 'list' ? (
          <div className="space-y-3">
            {state.tasks.length === 0 && <p className="text-gray-400 text-center py-8">No tasks yet. Create one!</p>}
            {state.tasks.map(task => (
              <div key={task.id} className="bg-white rounded-lg shadow-sm border">
                <div className="flex items-center p-4 gap-2 flex-wrap">
                  <button onClick={() => toggleTaskComplete(task)} className={`w-5 h-5 rounded border-2 flex-shrink-0 ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`} title="Toggle complete">
                    {task.completed && <svg viewBox="0 0 20 20" fill="white" className="w-full h-full"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</span>
                    {task.assignee && <span className="ml-2 text-xs text-gray-500">👤 {task.assignee}</span>}
                    {task.startDate && <span className="ml-2 text-xs text-gray-500">📅 {task.startDate}{task.endDate ? ` → ${task.endDate}` : ''}</span>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openNewSubtask(task.id)} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">+ Subtask</button>
                    <button onClick={() => openEditTask(task)} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded">Edit</button>
                    <button onClick={() => deleteTask(task.id)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded">Delete</button>
                    {task.subtasks.length > 0 && (
                      <button onClick={() => toggleExpand(task.id)} className="text-gray-400 hover:text-gray-600 ml-1">
                        {expandedTasks.has(task.id) ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                </div>
                {expandedTasks.has(task.id) && task.subtasks.length > 0 && (
                  <div className="border-t ml-8">
                    {task.subtasks.map(sub => (
                      <div key={sub.id} className="flex items-center p-3 gap-3 border-b last:border-b-0 bg-gray-50">
                        <button onClick={() => toggleSubtaskComplete(task.id, sub)} className={`w-4 h-4 rounded border-2 flex-shrink-0 ${sub.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`} title="Toggle complete">
                          {sub.completed && <svg viewBox="0 0 20 20" fill="white" className="w-full h-full"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                        </button>
                        <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{sub.title}</span>
                        {sub.assignee && <span className="text-xs text-gray-500">👤 {sub.assignee}</span>}
                        {sub.startDate && <span className="text-xs text-gray-500">📅 {sub.startDate}</span>}
                        <button onClick={() => openEditSubtask(task.id, sub)} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded">Edit</button>
                        <button onClick={() => deleteSubtask(task.id, sub.id)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded">Del</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <GanttChart tasks={state.tasks} />
        )}
      </div>

      {/* Task Modal */}
      {taskModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl max-h-screen overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{taskModal.editTask ? 'Edit Task' : 'New Task'}</h2>
            <div className="space-y-3">
              <input placeholder="Title *" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              <textarea placeholder="Notes" value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-blue-400" />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Start date</label>
                  <input
                    type="date"
                    value={taskForm.startDate}
                    onChange={e => {
                      const startDate = e.target.value;
                      setTaskForm(f => ({
                        ...f,
                        startDate,
                        // default end date to start date when end date is not yet set
                        endDate: f.endDate || startDate,
                      }));
                    }}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">End date</label>
                  <input
                    type="date"
                    value={taskForm.endDate}
                    min={taskForm.startDate}
                    onChange={e => setTaskForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <input placeholder="Assignee" value={taskForm.assignee} onChange={e => setTaskForm(f => ({ ...f, assignee: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={taskForm.completed} onChange={e => setTaskForm(f => ({ ...f, completed: e.target.checked }))} /> Completed</label>

              {/* Dependency selection */}
              {state.tasks.filter(t => t.id !== taskModal.editTask?.id).length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Depends on:</label>
                  <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                    {state.tasks
                      .filter(t => t.id !== taskModal.editTask?.id)
                      .map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={taskForm.dependsOn.includes(t.id)}
                            onChange={e => setTaskForm(f => ({
                              ...f,
                              dependsOn: e.target.checked
                                ? [...f.dependsOn, t.id]
                                : f.dependsOn.filter(id => id !== t.id),
                            }))}
                          />
                          <span className={t.completed ? 'line-through text-gray-400' : ''}>{t.title}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setTaskModal({ open: false })} className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
              <button onClick={saveTask} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Subtask Modal */}
      {subtaskModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-lg font-bold mb-4">{subtaskModal.editSubtask ? 'Edit Subtask' : 'New Subtask'}</h2>
            <div className="space-y-3">
              <input placeholder="Title *" value={subtaskForm.title} onChange={e => setSubtaskForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              <textarea placeholder="Notes" value={subtaskForm.notes} onChange={e => setSubtaskForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-blue-400" />
              <div className="flex gap-2">
                <input type="date" value={subtaskForm.startDate} onChange={e => setSubtaskForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))} className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                <input type="date" value={subtaskForm.endDate} min={subtaskForm.startDate} onChange={e => setSubtaskForm(f => ({ ...f, endDate: e.target.value }))} className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <input placeholder="Assignee" value={subtaskForm.assignee} onChange={e => setSubtaskForm(f => ({ ...f, assignee: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={subtaskForm.completed} onChange={e => setSubtaskForm(f => ({ ...f, completed: e.target.checked }))} /> Completed</label>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setSubtaskModal({ open: false, taskId: '' })} className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
              <button onClick={saveSubtask} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GanttChart({ tasks }: { tasks: Task[] }) {
  const tasksWithDates = tasks.filter(t => t.startDate && t.endDate);
  if (tasksWithDates.length === 0) {
    return <div className="text-center text-gray-400 py-16">No tasks with start and end dates to display in Gantt chart.</div>;
  }

  const parsedDates = tasksWithDates.map(t => ({
    start: new Date(t.startDate! + 'T00:00:00'),
    end: new Date(t.endDate! + 'T00:00:00'),
  }));
  const minDate = new Date(Math.min(...parsedDates.map(d => d.start.getTime())));
  const maxDate = new Date(Math.max(...parsedDates.map(d => d.end.getTime())));
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 1);
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

  const rowHeight = 36;
  const labelWidth = 200;
  const dayWidth = Math.max(20, Math.min(40, 800 / totalDays));
  const chartWidth = labelWidth + totalDays * dayWidth;
  const chartHeight = (tasksWithDates.length + 0.5) * rowHeight + 30;

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const months: { label: string; x: number; width: number }[] = [];
  let cur = new Date(minDate);
  while (cur <= maxDate) {
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const clampedStart = cur < minDate ? minDate : cur;
    const clampedEnd = monthEnd > maxDate ? maxDate : monthEnd;
    const dayOffset = Math.ceil((clampedStart.getTime() - minDate.getTime()) / 86400000);
    const dayCount = Math.ceil((clampedEnd.getTime() - clampedStart.getTime()) / 86400000) + 1;
    months.push({
      label: `${cur.toLocaleString('default', { month: 'short' })} ${cur.getFullYear()}`,
      x: labelWidth + dayOffset * dayWidth,
      width: dayCount * dayWidth,
    });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  // Build position map for dependency arrows
  const taskIndexMap = new Map(tasksWithDates.map((t, i) => [t.id, i]));

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-auto">
      <svg width={chartWidth} height={chartHeight} className="font-sans text-xs">
        <defs>
          <marker id="dep-arrow" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto">
            <polygon points="0 0, 6 2.5, 0 5" fill="#6B7280" />
          </marker>
        </defs>

        {months.map((m, i) => (
          <g key={i}>
            <rect x={m.x} y={0} width={m.width} height={20} fill={i % 2 === 0 ? '#F3F4F6' : '#E5E7EB'} />
            <text x={m.x + m.width / 2} y={14} textAnchor="middle" fontSize={10} fill="#374151">{m.label}</text>
          </g>
        ))}
        {Array.from({ length: totalDays }).map((_, i) => (
          <line key={i} x1={labelWidth + i * dayWidth} y1={20} x2={labelWidth + i * dayWidth} y2={chartHeight} stroke="#E5E7EB" strokeWidth={0.5} />
        ))}

        {/* Task bars */}
        {tasksWithDates.map((task, i) => {
          const y = 20 + i * rowHeight;
          const { start, end } = parsedDates[i];
          const startDay = Math.ceil((start.getTime() - minDate.getTime()) / 86400000);
          const duration = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
          const barX = labelWidth + startDay * dayWidth;
          const barWidth = duration * dayWidth;
          const color = colors[i % colors.length];

          return (
            <g key={task.id}>
              <rect x={0} y={y} width={labelWidth} height={rowHeight} fill={i % 2 === 0 ? '#FAFAFA' : '#FFFFFF'} />
              <text x={8} y={y + rowHeight / 2 + 4} fontSize={11} fill={task.completed ? '#9CA3AF' : '#1F2937'}>
                {task.title.length > 22 ? task.title.slice(0, 22) + '…' : task.title}
              </text>
              <rect x={barX} y={y + 6} width={Math.max(barWidth, 4)} height={rowHeight - 12} rx={3} fill={color} opacity={task.completed ? 0.4 : 0.8} />
              {barWidth > 40 && (
                <text x={barX + 4} y={y + rowHeight / 2 + 4} fontSize={9} fill="white">
                  {task.assignee || ''}
                </text>
              )}
            </g>
          );
        })}

        {/* Dependency arrows (finish-to-start) */}
        {tasksWithDates.map((task, toIdx) =>
          (task.dependsOn ?? []).map(depId => {
            const fromIdx = taskIndexMap.get(depId);
            if (fromIdx === undefined) return null;

            const { end: fromEnd } = parsedDates[fromIdx];
            const { start: toStart } = parsedDates[toIdx];

            const fromEndDay = Math.ceil((fromEnd.getTime() - minDate.getTime()) / 86400000) + 1;
            const toStartDay = Math.ceil((toStart.getTime() - minDate.getTime()) / 86400000);

            const x1 = labelWidth + fromEndDay * dayWidth;
            const x2 = labelWidth + toStartDay * dayWidth;
            const y1 = 20 + fromIdx * rowHeight + rowHeight / 2;
            const y2 = 20 + toIdx * rowHeight + rowHeight / 2;
            const midX = x1 + Math.max(8, (x2 - x1) / 2);

            return (
              <polyline
                key={`dep-${depId}-${task.id}`}
                points={`${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                fill="none"
                stroke="#6B7280"
                strokeWidth={1.5}
                markerEnd="url(#dep-arrow)"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
