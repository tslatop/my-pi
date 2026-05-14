import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { show_settings_modal } from '@spences10/pi-tui-modal';
import type { SkillsManager } from '../manager.js';
import {
	ENABLED,
	sets_equal,
	sort_skills,
	to_setting_item,
} from '../skill-utils.js';

export async function show_skills_manager_modal(
	ctx: ExtensionCommandContext,
	mgr: SkillsManager,
): Promise<boolean> {
	const discovered = sort_skills(mgr.discover());
	if (discovered.length === 0) {
		ctx.ui.notify('No managed skills found');
		return false;
	}

	const initial_enabled = new Set(
		discovered
			.filter((skill) => skill.enabled)
			.map((skill) => skill.key),
	);
	const current_enabled = new Set(initial_enabled);
	const items = discovered.map(to_setting_item);
	const metadata_by_id = new Map(
		items.map((item) => [item.id, item.description ?? '']),
	);
	for (const item of items) item.description = '';

	await show_settings_modal(ctx, {
		title: 'Manage skills',
		subtitle: () => {
			const enabled = current_enabled.size;
			const disabled = discovered.length - enabled;
			return `profile ${mgr.get_active_profile()} • ${enabled} enabled • ${disabled} disabled`;
		},
		items,
		max_visible: Math.min(Math.max(items.length + 4, 8), 12),
		enable_search: true,
		metadata: (item) =>
			item ? metadata_by_id.get(item.id)?.split('\n') : undefined,
		on_change: (id, new_value) => {
			if (new_value === ENABLED) {
				current_enabled.add(id);
				mgr.enable(id);
			} else {
				current_enabled.delete(id);
				mgr.disable(id);
			}
		},
	});

	if (!sets_equal(initial_enabled, current_enabled)) {
		ctx.ui.notify('Reloading to apply updated skills...', 'info');
		await ctx.reload();
		return true;
	}

	return false;
}
