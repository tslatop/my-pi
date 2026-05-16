import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import {
	show_confirm_modal,
	show_settings_modal,
} from '@spences10/pi-tui-modal';
import type { SkillsManager } from '../manager.js';
import {
	DISABLED,
	ENABLED,
	sets_equal,
	sort_skills,
	to_setting_item,
} from '../skill-utils.js';

const SYNC_FROM_UPSTREAM = '↻ sync from upstream';
const DELETE_SKILL = '✕ delete';

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
	const items = discovered.map((skill) => {
		const item = to_setting_item(skill);
		const values = [...(item.values ?? [])];
		if (skill.import_meta) values.push(SYNC_FROM_UPSTREAM);
		values.push(DELETE_SKILL);
		return { ...item, values };
	});
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
			} else if (new_value === DISABLED) {
				current_enabled.delete(id);
				mgr.disable(id);
			}
		},
	});

	const sync_ids = items
		.filter((item) => item.currentValue === SYNC_FROM_UPSTREAM)
		.map((item) => item.id);
	const delete_ids = items
		.filter((item) => item.currentValue === DELETE_SKILL)
		.map((item) => item.id);

	let changed = !sets_equal(initial_enabled, current_enabled);

	for (const id of sync_ids) {
		try {
			changed = mgr.sync_skill(id).changed || changed;
		} catch (error) {
			ctx.ui.notify(
				error instanceof Error ? error.message : String(error),
				'warning',
			);
		}
	}

	if (delete_ids.length) {
		const ok = await show_confirm_modal(ctx, {
			title: 'Delete skills?',
			message: `Delete ${delete_ids.length} skill${delete_ids.length === 1 ? '' : 's'} from disk? This cannot be undone.`,
			confirm_label: 'Delete',
			cancel_label: 'Keep skills',
		});
		if (ok) {
			for (const id of delete_ids) {
				try {
					mgr.delete_skill(id);
					changed = true;
				} catch (error) {
					ctx.ui.notify(
						error instanceof Error ? error.message : String(error),
						'warning',
					);
				}
			}
		}
	}

	if (changed) {
		ctx.ui.notify('Reloading to apply updated skills...', 'info');
		await ctx.reload();
		return true;
	}

	return false;
}
