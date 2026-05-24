import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TeamStore } from '../store.js';
import {
	send_message,
	update_messages,
	wait_for_message,
} from './message-store.js';

let root: string;
let store: TeamStore;
let team_id: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'my-pi-team-message-store-'));
	store = new TeamStore(root);
	team_id = store.create_team({ cwd: '/repo' }).id;
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('message store helpers', () => {
	it('sends messages with trimmed bodies and optional delivery metadata', async () => {
		const message = await send_message(store, team_id, {
			from: 'lead',
			to: 'alice',
			body: ' hello ',
			urgent: true,
			requires_ack: true,
			ttl_ms: 1_000,
		});

		expect(message).toMatchObject({
			from: 'lead',
			to: 'alice',
			body: 'hello',
			urgent: true,
			requires_ack: true,
		});
		expect(message.expires_at).toEqual(expect.any(String));
		expect(store.list_messages(team_id, 'alice')).toHaveLength(1);
	});

	it('waits for unread matching messages and ignores expired messages', async () => {
		await send_message(store, team_id, {
			from: 'bob',
			to: 'lead',
			body: 'old',
			ttl_ms: 1,
		});
		await new Promise((resolve) => setTimeout(resolve, 5));
		const expected = await send_message(store, team_id, {
			from: 'alice',
			to: 'lead',
			body: 'answer',
			reply_to: 'question-1',
		});

		const message = await wait_for_message(store, team_id, 'lead', {
			from: 'alice',
			reply_to: 'question-1',
			timeout_ms: 1,
		});

		expect(message?.id).toBe(expected.id);
	});

	it('updates selected messages and records a single update event', async () => {
		const first = await send_message(store, team_id, {
			from: 'lead',
			to: 'alice',
			body: 'first',
		});
		const second = await send_message(store, team_id, {
			from: 'lead',
			to: 'alice',
			body: 'second',
		});

		const messages = await update_messages(
			store,
			team_id,
			'alice',
			[second.id],
			(message, timestamp) => {
				message.read_at = timestamp;
			},
		);

		expect(
			messages.find((item) => item.id === first.id)?.read_at,
		).toBeUndefined();
		expect(
			messages.find((item) => item.id === second.id)?.read_at,
		).toEqual(expect.any(String));
	});
});
