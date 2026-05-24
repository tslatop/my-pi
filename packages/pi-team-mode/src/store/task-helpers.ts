import { normalize_unique_ids } from '../store-utils.js';
import type { TeamTask, TeamTaskStatus } from './types.js';

export function validate_task_dependencies(
	tasks: TeamTask[],
	task_id: string,
	depends_on: string[] | undefined,
): string[] {
	const normalized = normalize_unique_ids(depends_on);
	if (normalized.includes(task_id)) {
		throw new Error(`Task #${task_id} cannot depend on itself`);
	}

	const by_id = new Map(tasks.map((task) => [task.id, task]));
	for (const dep_id of normalized) {
		if (!by_id.has(dep_id)) {
			throw new Error(`Unknown dependency task: ${dep_id}`);
		}
	}

	const reaches_task = (
		current_id: string,
		seen = new Set<string>(),
	): boolean => {
		if (current_id === task_id) return true;
		if (seen.has(current_id)) return false;
		seen.add(current_id);
		const current = by_id.get(current_id);
		if (!current) return false;
		return current.depends_on.some((dep_id) =>
			reaches_task(dep_id, seen),
		);
	};

	for (const dep_id of normalized) {
		if (reaches_task(dep_id)) {
			throw new Error(
				`Task dependency cycle detected for #${task_id}`,
			);
		}
	}
	return normalized;
}

export function count_tasks(
	tasks: TeamTask[],
): Record<TeamTaskStatus, number> {
	const counts: Record<TeamTaskStatus, number> = {
		pending: 0,
		in_progress: 0,
		blocked: 0,
		completed: 0,
		cancelled: 0,
	};
	for (const task of tasks) counts[task.status] += 1;
	return counts;
}
