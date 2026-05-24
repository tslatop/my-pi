import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import {
	show_confirm_modal,
	show_input_modal,
	show_picker_modal,
} from '@spences10/pi-tui-modal';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import { TeamStore } from '../store.js';
import { show_team_member_actions_modal } from './member-actions.js';

vi.mock('@spences10/pi-tui-modal', () => ({
	show_confirm_modal: vi.fn(),
	show_input_modal: vi.fn(),
	show_picker_modal: vi.fn(),
}));

const picker = vi.mocked(show_picker_modal);
const input = vi.mocked(show_input_modal);
const confirm = vi.mocked(show_confirm_modal);

let root: string;
let store: TeamStore;
let team_id: string;
let notifications: string[];
let ctx: ExtensionCommandContext;

beforeEach(async () => {
	root = mkdtempSync(join(tmpdir(), 'my-pi-member-actions-'));
	store = new TeamStore(root);
	team_id = store.create_team({ cwd: '/repo', name: 'demo' }).id;
	await store.upsert_member(team_id, {
		name: 'alice',
		role: 'teammate',
		status: 'idle',
	});
	notifications = [];
	ctx = {
		ui: { notify: (message: string) => notifications.push(message) },
	} as unknown as ExtensionCommandContext;
});

afterEach(() => {
	vi.clearAllMocks();
	rmSync(root, { recursive: true, force: true });
});

describe('show_team_member_actions_modal', () => {
	it('sends a mailbox DM and exits when the picker is cancelled', async () => {
		picker
			.mockResolvedValueOnce('alice')
			.mockResolvedValueOnce('dm')
			.mockResolvedValueOnce(undefined);
		input.mockResolvedValueOnce('please review');

		await show_team_member_actions_modal(
			ctx,
			store,
			team_id,
			new Map(),
		);

		expect(store.list_messages(team_id, 'alice')).toMatchObject([
			{ from: 'lead', to: 'alice', body: 'please review' },
		]);
		expect(notifications.at(-1)).toMatch(/Sent .* to alice/);
	});

	it('prompts and shuts down an attached runner', async () => {
		const shutdown = vi.fn().mockResolvedValue(undefined);
		const runners = new Map([
			['alice', { is_running: true, shutdown }],
		]) as unknown as Parameters<
			typeof show_team_member_actions_modal
		>[3];
		picker
			.mockResolvedValueOnce('alice')
			.mockResolvedValueOnce('shutdown')
			.mockResolvedValueOnce(undefined);
		confirm.mockResolvedValueOnce(true);

		await show_team_member_actions_modal(
			ctx,
			store,
			team_id,
			runners,
		);

		expect(shutdown).toHaveBeenCalledWith(
			'leader requested shutdown',
		);
		expect(runners.has('alice')).toBe(false);
		const status = await store.get_status(team_id);
		expect(
			status.members.find((member) => member.name === 'alice'),
		).toMatchObject({
			status: 'offline',
		});
	});
});
