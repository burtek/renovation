import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '../../contexts/AppContext';
import type { Subtask, Task } from '../../types';
import { cn } from '../../utils/classnames';

import GanttChart from './GanttChart';
import SubtaskModal from './SubtaskModal';
import TaskIssuesPopup from './TaskIssuesPopup';
import TaskModal from './TaskModal';
import TasksList from './TasksList';
import { detectIssues } from './taskIssues';
import type { SubtaskFormData, TaskFormData } from './types';
import {
    emptySubtaskForm,
    emptyTaskForm,
    getToday
} from './types';


type Tab = 'list' | 'gantt';

export default function Tasks() {
    const { state, dispatch } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const tab: Tab = location.pathname.endsWith('/gantt') ? 'gantt' : 'list';

    const setTab = (newTab: Tab) => {
        navigate(`/tasks/${newTab}`, { replace: true });
    };
    const [taskModal, setTaskModal] = useState<{ open: boolean; editTask?: Task }>({ open: false });
    const [issuesOpen, setIssuesOpen] = useState(false);
    const warningRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        document.title = 'Tasks | Renovation';
    }, []);
    const [subtaskModal, setSubtaskModal] = useState<{ open: boolean; taskId: string; editSubtask?: Subtask }>({ open: false, taskId: '' });
    const [taskForm, setTaskForm] = useState<TaskFormData>(emptyTaskForm);
    const [subtaskForm, setSubtaskForm] = useState<SubtaskFormData>(emptySubtaskForm);

    const openNewTask = () => {
        const today = getToday();
        setTaskForm({ ...emptyTaskForm, startDate: today, endDate: today });
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
            dependsOn: task.dependsOn ?? []
        });
        setTaskModal({ open: true, editTask: task });
    };

    const issues = useMemo(() => detectIssues(state.tasks), [state.tasks]);
    const closeIssues = useCallback(() => {
        setIssuesOpen(false);
    }, []);
    const effectiveIsOpen = issuesOpen && issues.length > 0;

    const performSaveTask = (): boolean => {
        if (!taskForm.title.trim()) {
            return false;
        }

        if (taskModal.editTask) {
            dispatch({ type: 'UPDATE_TASK', payload: { ...taskModal.editTask, ...taskForm } });
        } else {
            dispatch({ type: 'ADD_TASK', payload: { ...taskForm, subtasks: [] } });
        }
        return true;
    };

    const saveTask = () => {
        if (performSaveTask()) {
            setTaskModal({ open: false });
        }
    };

    const saveTaskAndNew = () => {
        if (performSaveTask()) {
            const today = getToday();
            setTaskForm({ ...emptyTaskForm, startDate: today, endDate: today });
            setTaskModal({ open: true });
        }
    };

    const deleteTask = (id: string) => {
        // eslint-disable-next-line no-alert
        if (confirm('Delete task?')) {
            dispatch({ type: 'DELETE_TASK', payload: id });
        }
    };

    const openNewSubtask = (taskId: string) => {
        const parentTask = state.tasks.find(t => t.id === taskId);
        const startDate = parentTask?.startDate ?? getToday();
        const parentEndDate = parentTask?.endDate ?? '';
        const endDate = parentEndDate || startDate;
        setSubtaskForm({ ...emptySubtaskForm, startDate, endDate, assignee: parentTask?.assignee ?? '' });
        setSubtaskModal({ open: true, taskId });
    };

    const openEditSubtask = (taskId: string, subtask: Subtask) => {
        setSubtaskForm({
            title: subtask.title,
            notes: subtask.notes,
            startDate: subtask.startDate ?? '',
            endDate: subtask.endDate ?? '',
            assignee: subtask.assignee ?? '',
            completed: subtask.completed,
            dependsOn: subtask.dependsOn ?? []
        });
        setSubtaskModal({ open: true, taskId, editSubtask: subtask });
    };

    const performSaveSubtask = (): boolean => {
        if (!subtaskForm.title.trim()) {
            return false;
        }
        if (subtaskModal.editSubtask) {
            dispatch({
                type: 'UPDATE_SUBTASK',
                payload: { taskId: subtaskModal.taskId, subtask: { ...subtaskModal.editSubtask, ...subtaskForm } }
            });
        } else {
            dispatch({
                type: 'ADD_SUBTASK',
                payload: { taskId: subtaskModal.taskId, subtask: { ...subtaskForm, parentId: subtaskModal.taskId } }
            });
        }
        return true;
    };

    const saveSubtask = () => {
        if (performSaveSubtask()) {
            setSubtaskModal({ open: false, taskId: '' });
        }
    };

    const saveSubtaskAndNew = () => {
        if (performSaveSubtask()) {
            const { taskId } = subtaskModal;
            const parentTask = state.tasks.find(t => t.id === taskId);
            const startDate = parentTask?.startDate ?? getToday();
            const parentEndDate = parentTask?.endDate ?? '';
            const endDate = parentEndDate || startDate;
            setSubtaskForm({ ...emptySubtaskForm, startDate, endDate, assignee: parentTask?.assignee ?? '' });
            setSubtaskModal({ open: true, taskId });
        }
    };

    const deleteSubtask = (taskId: string, subtaskId: string) => {
        // eslint-disable-next-line no-alert
        if (confirm('Delete subtask?')) {
            dispatch({ type: 'DELETE_SUBTASK', payload: { taskId, subtaskId } });
        }
    };

    const duplicateSubtask = (taskId: string, subtask: Subtask) => {
        setSubtaskForm({
            title: subtask.title,
            notes: subtask.notes,
            startDate: subtask.startDate ?? '',
            endDate: subtask.endDate ?? '',
            assignee: subtask.assignee ?? '',
            completed: false,
            dependsOn: subtask.dependsOn ?? []
        });
        setSubtaskModal({ open: true, taskId });
    };

    const toggleTaskComplete = (task: Task) => {
        dispatch({ type: 'UPDATE_TASK', payload: { ...task, completed: !task.completed } });
    };

    const toggleSubtaskComplete = (taskId: string, subtask: Subtask) => {
        dispatch({ type: 'UPDATE_SUBTASK', payload: { taskId, subtask: { ...subtask, completed: !subtask.completed } } });
    };

    const allSubtasks = state.tasks.flatMap(t =>
        t.subtasks.map(s => ({ ...s, parentTitle: t.title })));

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Tasks</h1>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setTab('list');
                        }}
                        className={cn('px-3 py-1 rounded text-sm', tab === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600')}
                    >List
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setTab('gantt');
                        }}
                        className={cn('px-3 py-1 rounded text-sm', tab === 'gantt' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600')}
                    >Gantt
                    </button>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {issues.length > 0 && (
                        <div
                            ref={warningRef}
                            className="relative"
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setIssuesOpen(v => !v);
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded text-sm bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300"
                                title="View task issues"
                                aria-expanded={effectiveIsOpen}
                            >
                                ⚠️ {issues.length}
                            </button>
                            <TaskIssuesPopup
                                issues={issues}
                                isOpen={effectiveIsOpen}
                                onClose={closeIssues}
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={openNewTask}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                    >+ Add Task
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                {tab === 'list'
                    ? (
                        <TasksList
                            tasks={state.tasks}
                            onToggleTaskComplete={toggleTaskComplete}
                            onToggleSubtaskComplete={toggleSubtaskComplete}
                            onAddSubtask={openNewSubtask}
                            onEditTask={openEditTask}
                            onDeleteTask={deleteTask}
                            onEditSubtask={openEditSubtask}
                            onDuplicateSubtask={duplicateSubtask}
                            onDeleteSubtask={deleteSubtask}
                        />
                    )
                    : <GanttChart tasks={state.tasks} />}
            </div>

            {taskModal.open && (
                <TaskModal
                    editTask={taskModal.editTask}
                    form={taskForm}
                    allTasks={state.tasks}
                    onFormChange={update => {
                        setTaskForm(f => ({ ...f, ...update }));
                    }}
                    onSave={saveTask}
                    onSaveAndNew={saveTaskAndNew}
                    onClose={() => {
                        setTaskModal({ open: false });
                    }}
                />
            )}

            {subtaskModal.open && (
                <SubtaskModal
                    editSubtask={subtaskModal.editSubtask}
                    parentTaskTitle={state.tasks.find(t => t.id === subtaskModal.taskId)?.title ?? ''}
                    form={subtaskForm}
                    allSubtasks={allSubtasks}
                    onFormChange={update => {
                        setSubtaskForm(f => ({ ...f, ...update }));
                    }}
                    onSave={saveSubtask}
                    onSaveAndNew={saveSubtaskAndNew}
                    onClose={() => {
                        setSubtaskModal({ open: false, taskId: '' });
                    }}
                />
            )}
        </div>
    );
}
