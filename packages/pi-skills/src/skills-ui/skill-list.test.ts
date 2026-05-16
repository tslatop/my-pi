import {
	show_picker_modal,
	show_text_modal,
} from '@spences10/pi-tui-modal';
import { describe, expect, it, vi } from 'vitest';
import {
	pick_skill,
	show_skill_detail_modal,
	show_skill_list_modal,
} from './skill-list.js';

vi.mock('@spences10/pi-tui-modal', () => ({
	show_picker_modal: vi.fn(),
	show_text_modal: vi.fn(async () => {}),
}));

const skill = {
	key: 'alpha',
	name: 'Alpha',
	description: 'Desc',
	source: 'local',
	enabled: true,
	baseDir: '/tmp/a',
} as any;

describe('skill list UI', () => {
	it('picks skills with status descriptions', async () => {
		vi.mocked(show_picker_modal).mockResolvedValueOnce('alpha');
		await expect(
			pick_skill({} as any, {
				title: 'Pick',
				subtitle: 'Sub',
				skills: [skill],
				empty_message: 'Empty',
			}),
		).resolves.toBe('alpha');
		expect(show_picker_modal).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				title: 'Pick',
				items: [
					expect.objectContaining({
						value: 'alpha',
						label: 'Alpha',
						description: expect.stringContaining('local'),
					}),
				],
			}),
		);
	});

	it('shows skill details and loops until selection is cancelled', async () => {
		vi.mocked(show_picker_modal)
			.mockResolvedValueOnce('alpha')
			.mockResolvedValueOnce(undefined);
		await show_skill_detail_modal({} as any, skill);
		expect(show_text_modal).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				title: 'Alpha',
				text: expect.stringContaining('Desc'),
			}),
		);

		const mgr = {
			discover: () => [skill],
			discover_importable: () => [],
		};
		await show_skill_list_modal({} as any, mgr as any);
		expect(show_text_modal).toHaveBeenCalledTimes(2);
	});
});
