import { describe, expect, it } from 'vitest';
import {
	count_tasks,
	validate_task_dependencies,
} from './task-helpers.js';
import type { TeamTask } from './types.js';

function task(id: string, depends_on: string[] = []): TeamTask {
	return {
		id,
		title: `Task ${id}`,
		status: 'pending',
		depends_on,
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
	};
}

describe('store task helpers', () => {
	it('rejects unknown dependencies and cycles', () => {
		expect(() =>
			validate_task_dependencies([task('1')], '2', ['3']),
		).toThrow(/Unknown dependency/);
		expect(() =>
			validate_task_dependencies([task('1', ['2'])], '2', ['1']),
		).toThrow(/cycle/);
	});

	it('counts task statuses', () => {
		expect(
			count_tasks([
				{ ...task('1'), status: 'pending' },
				{ ...task('2'), status: 'completed' },
			]),
		).toMatchObject({ pending: 1, completed: 1, blocked: 0 });
	});
});
