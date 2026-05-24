import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TeamStore } from '../store.js';
import { execute_message_action } from './message-actions.js';

let root: string;
let store: TeamStore;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'my-pi-team-message-actions-'));
	store = new TeamStore(root);
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('message action helpers', () => {
	it('sends a message through the message action handler', async () => {
		const team = store.create_team({ cwd: '/repo' });
		const result = await execute_message_action(
			{
				action: 'message_send',
				to: 'alice',
				message: 'Please review this.',
			},
			{
				store,
				runners: new Map(),
				own_member: 'lead',
				require_team_id: () => team.id,
			},
		);

		expect(result.content[0]?.text).toContain('Sent message');
		expect(result.details.message).toMatchObject({
			from: 'lead',
			to: 'alice',
			body: 'Please review this.',
		});
	});
});
