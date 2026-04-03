/**
 * Issue plugin registry.
 *
 * Defines the TaskIssuePlugin contract and assembles all registered plugins.
 * To add a new issue type: create a new self-contained module (interface +
 * detector + fixer), then add its detect function and Fix component here.
 */

import type { ReactNode } from 'react';

import type { Task } from '../../../types';

import type { DependencyOrderIssue } from './dependencyOrder';
import { DependencyOrderFix, detectDependencyOrderIssues } from './dependencyOrder';
import type { SubtaskFitIssue } from './subtaskFit';
import { SubtaskFitFix, detectSubtaskFitIssues } from './subtaskFit';


export type { DependencyOrderIssue } from './dependencyOrder';
export type { SubtaskFitIssue } from './subtaskFit';

/** Union of all known issue types. */
export type TaskIssue = DependencyOrderIssue | SubtaskFitIssue;

/** Contract every issue plugin must satisfy. */
export interface TaskIssuePlugin {
    /** Detect all issues of this type in the given task list. */
    detect: (tasks: Task[]) => TaskIssue[];
    /** Stable React key for the issue (must be unique across all plugins). */
    key: (issue: TaskIssue) => string;
    /** Returns true when this plugin is responsible for the given issue. */
    handles: (issue: TaskIssue) => boolean;
    /** Renders fix action(s) inside the issues popup. */
    renderFix: (issue: TaskIssue, onFixed: () => void) => ReactNode;
}

/** All registered issue plugins. Add new entries here to support more issue types. */
export const issuePlugins: TaskIssuePlugin[] = [
    {
        detect: detectDependencyOrderIssues,
        key: issue => {
            if (issue.type === 'dependency-order') {
                return `dep-${issue.dependentId}-${issue.dependencyId}`;
            }
            return issue.type;
        },
        handles: issue => issue.type === 'dependency-order',
        renderFix: (issue, onFixed) => {
            if (issue.type !== 'dependency-order') {
                return null;
            }
            return (
                <DependencyOrderFix
                    issue={issue}
                    onFixed={onFixed}
                />
            );
        }
    },
    {
        detect: detectSubtaskFitIssues,
        key: issue => {
            if (issue.type === 'subtask-fit') {
                return `fit-${issue.subtaskId}`;
            }
            return issue.type;
        },
        handles: issue => issue.type === 'subtask-fit',
        renderFix: (issue, onFixed) => {
            if (issue.type !== 'subtask-fit') {
                return null;
            }
            return (
                <SubtaskFitFix
                    issue={issue}
                    onFixed={onFixed}
                />
            );
        }
    }
];

/** Detect all issues across every registered plugin. */
export function detectIssues(tasks: Task[]): TaskIssue[] {
    return issuePlugins.flatMap(plugin => plugin.detect(tasks));
}
