import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '../../contexts/AppContext';
import type { Subtask, Task } from '../../types';
import { cn } from '../../utils/classnames';

import GanttChart from './GanttChart';
import SubtaskModal from './SubtaskModal';
import TaskModal from './TaskModal';
import TasksList from './TasksList';
import type { SubtaskFormData, TaskFormData } from './types';
import {
    addDays,
    dayDiff,
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
    const [taskModal, setTaskModal] = useState<{ open: boolean; editTask?: Task; instanceId: number }>({ open: false, instanceId: 0 });

    useEffect(() => {
        document.title = 'Tasks | Renovation';
    }, []);
    const [subtaskModal, setSubtaskModal] = useState<{ open: boolean; taskId: string; editSubtask?: Subtask; instanceId: number }>({ open: false, taskId: '', instanceId: 0 });
    const [taskForm, setTaskForm] = useState<TaskFormData>(emptyTaskForm);
    const [subtaskForm, setSubtaskForm] = useState<SubtaskFormData>(emptySubtaskForm);

    const openNewTask = () => {
        const today = getToday();
        setTaskForm({ ...emptyTaskForm, startDate: today, endDate: today });
        setTaskModal(prev => ({ open: true, instanceId: prev.instanceId + 1 }));
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
        setTaskModal(prev => ({ open: true, editTask: task, instanceId: prev.instanceId + 1 }));
    };

    const performSaveTask = (): boolean => {
        if (!taskForm.title.trim()) {
            return false;
        }

        if (taskModal.editTask) {
            const oldTask = taskModal.editTask;
            const oldEnd = oldTask.endDate;
            const newEnd = taskForm.endDate;

            if (oldEnd && newEnd && newEnd > oldEnd) {
                const shift = dayDiff(newEnd, oldEnd);
                const dependents = state.tasks.filter(
                    t => t.id !== oldTask.id && (t.dependsOn ?? []).includes(oldTask.id) && t.startDate
                );
                if (dependents.length > 0) {
                    const names = dependents.map(t => `"${t.title}"`).join(', ');
                    // eslint-disable-next-line no-alert
                    const proceed = confirm(
                        `Postponing "${oldTask.title}" by ${shift} day(s) will also shift:\n${names}\nby ${shift} day(s). Proceed?`
                    );
                    if (!proceed) {
                        return false;
                    }
                    dependents.forEach(t => {
                        dispatch({
                            type: 'UPDATE_TASK',
                            payload: {
                                ...t,
                                startDate: t.startDate ? addDays(t.startDate, shift) : t.startDate,
                                endDate: t.endDate ? addDays(t.endDate, shift) : t.endDate
                            }
                        });
                    });
                }
            }

            dispatch({ type: 'UPDATE_TASK', payload: { ...oldTask, ...taskForm } });
        } else {
            dispatch({ type: 'ADD_TASK', payload: { ...taskForm, subtasks: [] } });
        }
        return true;
    };

    const saveTask = () => {
        if (performSaveTask()) {
            setTaskModal(prev => ({ ...prev, open: false, editTask: undefined }));
        }
    };

    const saveTaskAndNew = () => {
        if (performSaveTask()) {
            const today = getToday();
            setTaskForm({ ...emptyTaskForm, startDate: today, endDate: today });
            setTaskModal(prev => ({ open: true, instanceId: prev.instanceId + 1 }));
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
        setSubtaskModal(prev => ({ open: true, taskId, instanceId: prev.instanceId + 1 }));
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
        setSubtaskModal(prev => ({ open: true, taskId, editSubtask: subtask, instanceId: prev.instanceId + 1 }));
    };

    const performSaveSubtask = (): boolean => {
        if (!subtaskForm.title.trim()) {
            return false;
        }
        if (subtaskModal.editSubtask) {
            const oldSub = subtaskModal.editSubtask;
            const oldEnd = oldSub.endDate;
            const newEnd = subtaskForm.endDate;

            if (oldEnd && newEnd && newEnd > oldEnd) {
                const shift = dayDiff(newEnd, oldEnd);
                const allSubs = state.tasks.flatMap(t => t.subtasks);
                const dependents = allSubs.filter(
                    s => s.id !== oldSub.id && (s.dependsOn ?? []).includes(oldSub.id) && s.startDate
                );
                if (dependents.length > 0) {
                    const names = dependents.map(s => `"${s.title}"`).join(', ');
                    // eslint-disable-next-line no-alert
                    const proceed = confirm(
                        `Postponing "${oldSub.title}" by ${shift} day(s) will also shift:\n${names}\nby ${shift} day(s). Proceed?`
                    );
                    if (!proceed) {
                        return false;
                    }
                    dependents.forEach(s => {
                        const parentTask = state.tasks.find(t => t.subtasks.some(st => st.id === s.id));
                        if (!parentTask) {
                            return;
                        }
                        dispatch({
                            type: 'UPDATE_SUBTASK',
                            payload: {
                                taskId: parentTask.id,
                                subtask: {
                                    ...s,
                                    startDate: s.startDate ? addDays(s.startDate, shift) : s.startDate,
                                    endDate: s.endDate ? addDays(s.endDate, shift) : s.endDate
                                }
                            }
                        });
                    });
                }
            }

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
            setSubtaskModal(prev => ({ ...prev, open: false, taskId: '', editSubtask: undefined }));
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
            setSubtaskModal(prev => ({ open: true, taskId, instanceId: prev.instanceId + 1 }));
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
        setSubtaskModal(prev => ({ open: true, taskId, instanceId: prev.instanceId + 1 }));
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
                <button
                    type="button"
                    onClick={openNewTask}
                    className="ml-auto bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                >+ Add Task
                </button>
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
                    key={taskModal.instanceId}
                    editTask={taskModal.editTask}
                    form={taskForm}
                    allTasks={state.tasks}
                    onFormChange={update => {
                        setTaskForm(f => ({ ...f, ...update }));
                    }}
                    onSave={saveTask}
                    onSaveAndNew={saveTaskAndNew}
                    onClose={() => {
                        setTaskModal(prev => ({ ...prev, open: false, editTask: undefined }));
                    }}
                />
            )}

            {subtaskModal.open && (
                <SubtaskModal
                    key={subtaskModal.instanceId}
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
                        setSubtaskModal(prev => ({ ...prev, open: false, taskId: '', editSubtask: undefined }));
                    }}
                />
            )}
        </div>
    );
}
