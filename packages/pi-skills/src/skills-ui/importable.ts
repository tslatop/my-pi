import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { show_settings_modal } from '@spences10/pi-tui-modal';
import type { SkillsManager } from '../manager.js';
import {
	find_matching_imported_skill,
	find_skill,
	get_importable_state,
	sort_skills,
} from '../skill-utils.js';

const IMPORT_SELECTED = '● import';
const SYNC_SELECTED = '● sync';
const SKIP_SELECTED = '○ skip';

function importable_action_label(
	state: ReturnType<typeof get_importable_state>,
): string {
	if (state.action === 'import') return 'Import';
	if (state.action === 'sync') return 'Sync available';
	return state.label === 'managed'
		? 'Already managed'
		: 'Already imported';
}

export async function show_importable_skills_modal(
	ctx: ExtensionCommandContext,
	mgr: SkillsManager,
): Promise<boolean> {
	const managed = sort_skills(mgr.discover());
	const importable = sort_skills(mgr.discover_importable());
	if (importable.length === 0) {
		ctx.ui.notify('No importable skills found');
		return false;
	}

	const selected = new Map<string, string>();
	const metadata_by_id = new Map<string, string>();
	const items = importable.map((skill) => {
		const state = get_importable_state(managed, skill);
		metadata_by_id.set(
			skill.key,
			[
				`${importable_action_label(state)} • ${skill.source} • ${skill.key}`,
				skill.description,
				state.detail,
				skill.baseDir,
			].join('\n'),
		);
		const values =
			state.action === 'import'
				? [SKIP_SELECTED, IMPORT_SELECTED]
				: state.action === 'sync'
					? [SKIP_SELECTED, SYNC_SELECTED]
					: [state.label];
		return {
			id: skill.key,
			label: skill.name,
			description: '',
			currentValue: values[0]!,
			values,
		};
	});

	await show_settings_modal(ctx, {
		title: 'Importable skills',
		subtitle: () => {
			const actions = [...selected.values()].filter(
				(value) => value !== SKIP_SELECTED,
			).length;
			return `${importable.length} external skills • ${actions} selected`;
		},
		items,
		max_visible: Math.min(Math.max(items.length + 4, 8), 12),
		enable_search: true,
		metadata: (item) =>
			item ? metadata_by_id.get(item.id)?.split('\n') : undefined,
		on_change: (id, new_value) => {
			if (new_value === SKIP_SELECTED) selected.delete(id);
			else selected.set(id, new_value);
		},
	});

	let changed = false;
	for (const [key, action] of selected) {
		const skill = find_skill(importable, key);
		try {
			if (action === IMPORT_SELECTED) {
				mgr.import_skill(skill.key);
				changed = true;
			} else if (action === SYNC_SELECTED) {
				const imported_skill = find_matching_imported_skill(
					managed,
					skill,
				);
				if (!imported_skill) {
					ctx.ui.notify(
						`Imported copy for ${skill.name} was not found`,
						'warning',
					);
					continue;
				}
				changed =
					mgr.sync_skill(imported_skill.key).changed || changed;
			}
		} catch (error) {
			ctx.ui.notify(
				error instanceof Error ? error.message : String(error),
				'warning',
			);
		}
	}

	if (changed) {
		ctx.ui.notify('Updated importable skills. Reloading...', 'info');
		await ctx.reload();
		return true;
	}

	return false;
}
