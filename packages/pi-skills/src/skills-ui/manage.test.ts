import { show_settings_modal } from '@spences10/pi-tui-modal';
import { describe, expect, it, vi } from 'vitest';
import { show_skills_manager_modal } from './manage.js';

vi.mock('@spences10/pi-tui-modal', () => ({
	show_settings_modal: vi.fn(async (_ctx, options) => {
		options.on_change('skill-a', '○ disabled');
	}),
}));

function create_ctx() {
	return {
		ui: { notify: vi.fn() },
		reload: vi.fn(async () => {}),
	} as any;
}

describe('show_skills_manager_modal', () => {
	it('notifies when no managed skills exist', async () => {
		const ctx = create_ctx();
		const mgr = { discover: () => [] };
		await expect(
			show_skills_manager_modal(ctx, mgr as any),
		).resolves.toBe(false);
		expect(ctx.ui.notify).toHaveBeenCalledWith(
			'No managed skills found',
		);
	});

	it('opens settings, applies changes, and reloads when enabled set changes', async () => {
		const ctx = create_ctx();
		const disable = vi.fn();
		const mgr = {
			discover: () => [
				{
					key: 'skill-a',
					name: 'Skill A',
					description: 'Desc',
					source: 'local',
					enabled: true,
					baseDir: '/tmp/a',
				},
			],
			get_active_profile: () => 'default',
			enable: vi.fn(),
			disable,
		};
		await expect(
			show_skills_manager_modal(ctx, mgr as any),
		).resolves.toBe(true);
		expect(show_settings_modal).toHaveBeenCalledWith(
			ctx,
			expect.objectContaining({
				title: 'Manage skills',
				enable_search: true,
			}),
		);
		expect(disable).toHaveBeenCalledWith('skill-a');
		expect(ctx.ui.notify).toHaveBeenCalledWith(
			'Reloading to apply updated skills...',
			'info',
		);
		expect(ctx.reload).toHaveBeenCalledOnce();
	});
});
