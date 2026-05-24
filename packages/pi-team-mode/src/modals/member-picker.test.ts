import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { show_picker_modal } from '@spences10/pi-tui-modal';
import { describe, expect, it, vi } from 'vitest';
import type { TeamStatus } from '../store.js';
import { show_team_member_picker } from './member-picker.js';

vi.mock('@spences10/pi-tui-modal', () => ({
	show_picker_modal: vi.fn(),
}));

const picker = vi.mocked(show_picker_modal);

describe('show_team_member_picker', () => {
	it('formats teammates and returns the selected member name', async () => {
		picker.mockResolvedValueOnce('alice');
		const status = {
			members: [
				{
					name: 'alice',
					role: 'teammate',
					status: 'running_attached',
				},
				{ name: 'lead', role: 'lead', status: 'idle' },
			],
		} as TeamStatus;

		await expect(
			show_team_member_picker({} as ExtensionCommandContext, status, {
				title: 'Pick one',
				subtitle: 'demo',
			}),
		).resolves.toBe('alice');

		expect(picker).toHaveBeenCalledWith(
			{},
			expect.objectContaining({
				title: 'Pick one',
				subtitle: 'demo',
				empty_message: 'No members yet. Add one first.',
				items: expect.arrayContaining([
					expect.objectContaining({
						value: 'alice',
						label: 'alice',
						description: expect.stringContaining('teammate'),
					}),
				]),
			}),
		);
	});
});
