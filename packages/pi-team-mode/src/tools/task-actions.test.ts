import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TeamStore } from '../store.js';
import { execute_task_action, require_arg } from './task-actions.js';

let root: string;
let store: TeamStore;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'my-pi-team-task-actions-'));
	store = new TeamStore(root);
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('task action helpers', () => {
	it('requires non-empty string args', () => {
		expect(require_arg(' alice ', 'member')).toBe('alice');
		expect(() => require_arg(' ', 'member')).toThrow(
			/member is required/,
		);
	});

	it('creates a task through the task action handler', async () => {
		const team = store.create_team({ cwd: '/repo' });
		const result = await execute_task_action(
			{ action: 'task_create', title: 'Review split' },
			{
				ctx: { cwd: '/repo' } as any,
				store,
				runners: new Map(),
				team_id: team.id,
				require_team_id: () => team.id,
			},
		);

		expect(result.content[0]?.text).toContain('Created task #1');
		expect(result.details.task).toMatchObject({
			id: '1',
			title: 'Review split',
		});
	});
});
