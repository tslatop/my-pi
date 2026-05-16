import { show_picker_modal } from '@spences10/pi-tui-modal';
import { describe, expect, it, vi } from 'vitest';
import { show_skills_home_modal } from './home.js';

vi.mock('@spences10/pi-tui-modal', () => ({
	show_picker_modal: vi.fn(async () => 'manage'),
}));

describe('show_skills_home_modal', () => {
	it('builds the skills home menu with counts and actions', async () => {
		await expect(
			show_skills_home_modal(
				{} as any,
				{
					managed: 3,
					pi_native: 1,
					claude_code_detected: 2,
					importable: 2,
				},
				'default',
			),
		).resolves.toBe('manage');
		expect(show_picker_modal).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				title: 'Skills',
				subtitle:
					'3 managed • 2 Claude Code detected • 2 importable • profile default',
				footer: 'enter opens • esc close/back',
				items: expect.arrayContaining([
					expect.objectContaining({
						value: 'manage',
						label: 'Manage skills',
					}),
					expect.objectContaining({
						value: 'importable',
						label: 'Importable skills',
					}),
					expect.objectContaining({
						value: 'profiles',
						label: 'Profiles',
					}),
				]),
			}),
		);
	});

	it('nudges new users towards importing Claude Code plugin skills', async () => {
		await show_skills_home_modal(
			{} as any,
			{
				managed: 0,
				pi_native: 0,
				claude_code_detected: 4,
				importable: 4,
			},
			'default',
		);

		expect(show_picker_modal).toHaveBeenLastCalledWith(
			expect.anything(),
			expect.objectContaining({
				title: 'Skills — import Claude Code skills?',
				initial_index: 1,
				items: expect.arrayContaining([
					expect.objectContaining({
						value: 'importable',
						label: 'Import Claude Code skills',
					}),
				]),
			}),
		);
	});
});
