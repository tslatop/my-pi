import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import {
	show_input_modal,
	show_picker_modal,
	show_settings_modal,
	show_text_modal,
} from '@spences10/pi-tui-modal';
import type { ManagedSkill, SkillsManager } from './manager.js';
import {
	ENABLED,
	find_matching_imported_skill,
	find_skill,
	format_profile_detail,
	format_skill_detail,
	get_importable_state,
	profile_description,
	sets_equal,
	skill_status,
	sort_skills,
	to_setting_item,
} from './skill-utils.js';

function importable_action_label(
	state: ReturnType<typeof get_importable_state>,
): string {
	if (state.action === 'import') return 'Import';
	if (state.action === 'sync') return 'Sync available';
	return state.label === 'managed'
		? 'Already managed'
		: 'Already imported';
}

export async function show_skills_home_modal(
	ctx: ExtensionCommandContext,
	managed_count: number,
	importable_count: number,
	active_profile: string,
): Promise<string | undefined> {
	return await show_picker_modal(ctx, {
		title: 'Skills',
		subtitle: `${managed_count} managed • ${importable_count} importable • profile ${active_profile}`,
		items: [
			{
				value: 'manage',
				label: 'Manage skills',
				description: 'Search and enable/disable managed skills',
			},
			{
				value: 'importable',
				label: 'Importable skills',
				description: 'Import external skills or sync imported copies',
			},
			{
				value: 'profiles',
				label: 'Profiles',
				description: 'Switch profiles and edit profile rules',
			},
			{
				value: 'refresh',
				label: 'Refresh discovery',
				description: 'Rescan managed and importable skills',
			},
		],
		footer: 'enter opens • esc close/back',
	});
}

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

export async function show_importable_skills_modal(
	ctx: ExtensionCommandContext,
	mgr: SkillsManager,
): Promise<boolean> {
	while (true) {
		const managed = sort_skills(mgr.discover());
		const importable = sort_skills(mgr.discover_importable());
		if (importable.length === 0) {
			ctx.ui.notify('No importable skills found');
			return false;
		}

		const selected = await show_picker_modal(ctx, {
			title: 'Importable skills',
			subtitle: `${importable.length} external skills • enter imports or syncs`,
			items: importable.map((skill) => {
				const state = get_importable_state(managed, skill);
				return {
					value: skill.key,
					label: skill.name,
					description: `${importable_action_label(state)} • ${skill.source} • ${skill.key}`,
				};
			}),
			empty_message: 'No importable skills found',
		});
		if (!selected) return false;

		const skill = find_skill(importable, selected);
		const state = get_importable_state(managed, skill);

		if (state.action === 'import') {
			try {
				const result = mgr.import_skill(skill.key);
				ctx.ui.notify(
					`Imported ${skill.name} to ${result.skillDir}. Reloading...`,
					'info',
				);
				await ctx.reload();
				return true;
			} catch (error) {
				ctx.ui.notify(
					error instanceof Error ? error.message : String(error),
					'warning',
				);
			}
			continue;
		}

		if (state.action === 'sync') {
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
			try {
				const result = mgr.sync_skill(imported_skill.key);
				if (result.changed) {
					ctx.ui.notify(`Synced ${skill.name}. Reloading...`, 'info');
					await ctx.reload();
					return true;
				}
				await show_text_modal(ctx, {
					title: 'Skill already up to date',
					text: `${skill.name} is already up to date.`,
				});
			} catch (error) {
				ctx.ui.notify(
					error instanceof Error ? error.message : String(error),
					'warning',
				);
			}
			continue;
		}

		await show_text_modal(ctx, {
			title: skill.name,
			subtitle: importable_action_label(state),
			text: state.detail,
		});
	}
}

export async function pick_skill(
	ctx: ExtensionCommandContext,
	options: {
		title: string;
		subtitle: string;
		skills: ManagedSkill[];
		empty_message: string;
	},
): Promise<string | undefined> {
	return await show_picker_modal(ctx, {
		title: options.title,
		subtitle: options.subtitle,
		items: options.skills.map((skill) => ({
			value: skill.key,
			label: skill.name,
			description: `${skill_status(skill)} • ${skill.source} • ${skill.key}`,
		})),
		empty_message: options.empty_message,
	});
}

export async function show_skill_detail_modal(
	ctx: ExtensionCommandContext,
	skill: ManagedSkill,
): Promise<void> {
	await show_text_modal(ctx, {
		title: skill.name,
		subtitle: `${skill_status(skill)} • ${skill.source}`,
		text: format_skill_detail(skill),
	});
}

export async function show_skill_list_modal(
	ctx: ExtensionCommandContext,
	mgr: SkillsManager,
): Promise<void> {
	while (true) {
		const skills = sort_skills([
			...mgr.discover(),
			...mgr.discover_importable(),
		]);
		const key = await pick_skill(ctx, {
			title: 'Browse skills',
			subtitle: `${mgr.discover().length} managed • ${mgr.discover_importable().length} importable`,
			skills,
			empty_message: 'No skills found',
		});
		if (!key) return;
		await show_skill_detail_modal(ctx, find_skill(skills, key));
	}
}

export async function show_refresh_summary(
	ctx: ExtensionCommandContext,
	mgr: SkillsManager,
): Promise<void> {
	mgr.refresh();
	await show_text_modal(ctx, {
		title: 'Skills refreshed',
		text: `${mgr.discover().length} managed skills\n${mgr.discover_importable().length} importable skills found`,
	});
}

export async function show_defaults_modal(
	ctx: ExtensionCommandContext,
	mgr: SkillsManager,
): Promise<void> {
	const selected = await show_picker_modal(ctx, {
		title: 'Default skill policy',
		subtitle: `Active profile: ${mgr.get_active_profile()}`,
		items: [
			{
				value: 'all-enabled',
				label: 'Enable by default',
				description:
					'Start with matching skills enabled; exclude rules turn skills off',
			},
			{
				value: 'all-disabled',
				label: 'Disable by default',
				description:
					'Start with skills disabled; include rules turn skills on',
			},
		],
	});
	if (!selected) return;
	mgr.set_defaults(selected as 'all-enabled' | 'all-disabled');
	await show_text_modal(ctx, {
		title: 'Default skill policy updated',
		text: `Active profile now starts from: ${selected}`,
	});
}

export async function pick_profile(
	ctx: ExtensionCommandContext,
	mgr: SkillsManager,
	title: string,
): Promise<string | undefined> {
	return await show_picker_modal(ctx, {
		title,
		subtitle: `Active: ${mgr.get_active_profile()}`,
		items: mgr.list_profiles().map((profile) => ({
			value: profile.name,
			label: `${profile.active ? '● ' : '○ '}${profile.name}`,
			description: profile_description(profile),
		})),
		empty_message: 'No skill profiles found',
	});
}

export async function show_profiles_modal(
	ctx: ExtensionCommandContext,
	mgr: SkillsManager,
): Promise<boolean> {
	while (true) {
		const selected = await show_picker_modal(ctx, {
			title: 'Skill profiles',
			subtitle: `Active: ${mgr.get_active_profile()}`,
			items: [
				{
					value: 'use',
					label: 'Use profile',
					description: 'Switch the active skill profile and reload',
				},
				{
					value: 'create',
					label: 'Create profile',
					description: 'Create a named skill profile',
				},
				{
					value: 'include',
					label: 'Add include rule',
					description: 'Turn on skills that match a profile pattern',
				},
				{
					value: 'exclude',
					label: 'Add exclude rule',
					description: 'Turn off skills that match a profile pattern',
				},
				{
					value: 'defaults',
					label: 'Default skill policy',
					description:
						'Choose the profile starting point before rules apply',
				},
				{
					value: 'show',
					label: 'Show profile details',
					description: 'Inspect include/exclude patterns',
				},
			],
			footer:
				'patterns match skill names, keys, sources, or paths; * is supported',
		});
		if (!selected) return false;

		if (selected === 'use') {
			const profile = await pick_profile(
				ctx,
				mgr,
				'Use skill profile',
			);
			if (!profile) continue;
			try {
				mgr.use_profile(profile);
				ctx.ui.notify(
					`Using skill profile ${profile}. Reloading...`,
					'info',
				);
				await ctx.reload();
				return true;
			} catch (error) {
				ctx.ui.notify(
					error instanceof Error ? error.message : String(error),
					'warning',
				);
			}
		} else if (selected === 'create') {
			const name = await show_input_modal(ctx, {
				title: 'Create skill profile',
				label: 'Profile name',
				trim: true,
			});
			if (!name) continue;
			try {
				mgr.create_profile(name);
				await show_text_modal(ctx, {
					title: 'Skill profile created',
					text: `Created empty profile ${name}. Use /skills profile use ${name} to activate it, then /skills enable <skill> to add skills.`,
				});
			} catch (error) {
				ctx.ui.notify(
					error instanceof Error ? error.message : String(error),
					'warning',
				);
			}
		} else if (selected === 'include' || selected === 'exclude') {
			const profile = await pick_profile(
				ctx,
				mgr,
				selected === 'include'
					? 'Choose profile for include rule'
					: 'Choose profile for exclude rule',
			);
			if (!profile) continue;
			const pattern = await show_input_modal(ctx, {
				title:
					selected === 'include'
						? 'Add include rule'
						: 'Add exclude rule',
				subtitle: `Profile: ${profile}`,
				label: 'Skill name, key, or pattern',
				trim: true,
			});
			if (!pattern) continue;
			try {
				if (selected === 'include')
					mgr.include_in_profile(profile, pattern);
				else mgr.exclude_from_profile(profile, pattern);
				ctx.ui.notify(`Updated ${profile}. Reloading...`, 'info');
				await ctx.reload();
				return true;
			} catch (error) {
				ctx.ui.notify(
					error instanceof Error ? error.message : String(error),
					'warning',
				);
			}
		} else if (selected === 'defaults') {
			await show_defaults_modal(ctx, mgr);
		} else if (selected === 'show') {
			const profile_name = await pick_profile(
				ctx,
				mgr,
				'Show skill profile',
			);
			const profile = mgr
				.list_profiles()
				.find((p) => p.name === profile_name);
			if (!profile) continue;
			await show_text_modal(ctx, {
				title: profile.name,
				subtitle: profile_description(profile),
				text: format_profile_detail(profile),
			});
		}
	}
}
