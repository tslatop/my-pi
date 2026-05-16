import { show_settings_modal } from '@spences10/pi-tui-modal';
import { describe, expect, it, vi } from 'vitest';
import { show_importable_skills_modal } from './importable.js';

vi.mock('@spences10/pi-tui-modal', () => ({
	show_settings_modal: vi.fn(async (_ctx, options) => {
		options.on_change('remote', '● import');
	}),
}));

function create_ctx() {
	return {
		ui: { notify: vi.fn() },
		reload: vi.fn(async () => {}),
	} as any;
}

describe('show_importable_skills_modal', () => {
	it('notifies when no importable skills exist', async () => {
		const ctx = create_ctx();
		const mgr = { discover: () => [], discover_importable: () => [] };
		await expect(
			show_importable_skills_modal(ctx, mgr as any),
		).resolves.toBe(false);
		expect(ctx.ui.notify).toHaveBeenCalledWith(
			'No importable skills found',
		);
	});

	it('imports selected skills and reloads when changed', async () => {
		const ctx = create_ctx();
		const import_skill = vi.fn();
		const mgr = {
			discover: () => [],
			discover_importable: () => [
				{
					key: 'remote',
					name: 'Remote',
					description: 'Desc',
					source: 'github',
					enabled: false,
					baseDir: '/tmp/r',
				},
			],
			import_skill,
			sync_skill: vi.fn(),
		};
		await expect(
			show_importable_skills_modal(ctx, mgr as any),
		).resolves.toBe(true);
		expect(show_settings_modal).toHaveBeenCalledWith(
			ctx,
			expect.objectContaining({
				title: 'Importable skills',
				enable_search: true,
			}),
		);
		expect(import_skill).toHaveBeenCalledWith('remote');
		expect(ctx.ui.notify).toHaveBeenCalledWith(
			'Updated importable skills. Reloading...',
			'info',
		);
		expect(ctx.reload).toHaveBeenCalledOnce();
	});
});
