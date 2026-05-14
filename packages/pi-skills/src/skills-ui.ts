import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import {
	show_input_modal,
	show_picker_modal,
	show_settings_modal,
	show_text_modal,
} from '@spences10/pi-tui-modal';
import {
	has_gh_skill,
	list_github_repository_skills,
	run_gh_skill_install,
	run_gh_skill_update,
} from './gh-skill.js';
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

const IMPORT_SELECTED = '● import';
const SYNC_SELECTED = '● sync';
const SKIP_SELECTED = '○ skip';

function is_already_installed_error(error: unknown): boolean {
	const message =
		error instanceof Error ? error.message : String(error);
	return message.includes('already installed');
}

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
				description:
					'Batch import external skills or sync imported copies',
			},
			{
				value: 'add',
				label: 'Add GitHub skill',
				description: 'Install a skill from owner/repo using gh skill',
			},
			{
				value: 'update',
				label: 'Update GitHub skills',
				description:
					'Check GitHub-installed skills and apply updates',
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

export async function show_add_github_skill_modal(
	ctx: ExtensionCommandContext,
): Promise<boolean> {
	if (!has_gh_skill()) {
		ctx.ui.notify(
			'Add GitHub skill requires gh v2.90.0+ with `gh skill` support.',
			'warning',
		);
		return false;
	}
	const repository = await show_input_modal(ctx, {
		title: 'Add GitHub skill',
		subtitle: 'Example: spences10/skills',
		label: 'Repository (owner/repo)',
		trim: true,
	});
	if (!repository) return false;

	const action = await show_picker_modal(ctx, {
		title: 'Add GitHub skill',
		subtitle: repository,
		items: [
			{
				value: 'one',
				label: 'Choose one skill',
				description: 'Enter a skill name or exact path to install',
			},
			{
				value: 'all',
				label: 'Install all skills from repo',
				description:
					'List SKILL.md files through gh api, install each one, then reload',
			},
			{
				value: 'preview',
				label: 'Preview/browse',
				description:
					'Coming later: preview repository skills before installing',
			},
		],
	});
	if (!action) return false;

	if (action === 'preview') {
		await show_text_modal(ctx, {
			title: 'Preview/browse coming later',
			text: `For now, use:\n\ngh skill preview ${repository}`,
		});
		return false;
	}

	if (action === 'one') {
		const skill = await show_input_modal(ctx, {
			title: 'Add one GitHub skill',
			subtitle: `${repository} • example: svelte-runes or svelte-runes@v1.0.0`,
			label: 'Skill name, optionally @tag-or-sha',
			trim: true,
		});
		if (!skill) return false;
		try {
			const output = run_gh_skill_install({
				repository,
				skill,
				flags: [],
			});
			await show_text_modal(ctx, {
				title: 'GitHub skill added',
				text: `${output || `Installed ${skill} from ${repository}`}\n\nReloading...`,
			});
			await ctx.reload();
			return true;
		} catch (error) {
			ctx.ui.notify(
				error instanceof Error ? error.message : String(error),
				'warning',
			);
			return false;
		}
	}

	const ref_mode = await show_picker_modal(ctx, {
		title: 'Install all GitHub skills',
		subtitle: repository,
		items: [
			{
				value: 'default',
				label: 'Use default branch',
				description: 'Install current default branch without a pin',
			},
			{
				value: 'pin',
				label: 'Pin to tag, branch, or commit SHA',
				description: 'Recommended for reviewed/reproducible installs',
			},
		],
	});
	if (!ref_mode) return false;
	const pin =
		ref_mode === 'pin'
			? await show_input_modal(ctx, {
					title: 'Install all GitHub skills',
					subtitle: repository,
					label: 'Pin tag, branch, or commit SHA',
					trim: true,
				})
			: undefined;
	if (ref_mode === 'pin' && !pin) return false;
	const existing_mode = await show_picker_modal(ctx, {
		title: 'Install all GitHub skills',
		subtitle: 'When a skill is already installed',
		items: [
			{
				value: 'skip',
				label: 'Skip existing skills',
				description: 'Leave installed skills unchanged',
			},
			{
				value: 'overwrite',
				label: 'Overwrite existing skills',
				description: 'Pass --force to gh skill install',
			},
		],
	});
	if (!existing_mode) return false;
	try {
		const skills = list_github_repository_skills(repository, pin);
		if (skills.length === 0) {
			ctx.ui.notify(
				`No SKILL.md files found in ${repository}`,
				'warning',
			);
			return false;
		}
		const lines: string[] = [];
		let installed = 0;
		let skipped = 0;
		let failed = 0;
		for (const skill of skills) {
			const flags = [
				...(pin ? ['--pin', pin] : []),
				...(existing_mode === 'overwrite' ? ['--force'] : []),
			];
			try {
				const output = run_gh_skill_install({
					repository,
					skill: skill.path,
					flags,
				});
				installed += 1;
				lines.push(`✓ ${skill.name}`);
				if (output) lines.push(output.split('\n')[0] ?? output);
			} catch (error) {
				if (
					existing_mode === 'skip' &&
					is_already_installed_error(error)
				) {
					skipped += 1;
					lines.push(`⊘ ${skill.name} already installed`);
					continue;
				}
				failed += 1;
				lines.push(
					`! ${skill.name}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
		await show_text_modal(ctx, {
			title: 'GitHub skills added',
			text: `Installed ${installed}, skipped ${skipped}, failed ${failed} from ${repository}.\n\n${lines.join('\n')}${installed > 0 ? '\n\nReloading...' : ''}`,
		});
		if (installed > 0) {
			await ctx.reload();
			return true;
		}
		return false;
	} catch (error) {
		ctx.ui.notify(
			error instanceof Error ? error.message : String(error),
			'warning',
		);
		return false;
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

export async function show_update_github_skills_modal(
	ctx: ExtensionCommandContext,
): Promise<boolean> {
	if (!has_gh_skill()) {
		ctx.ui.notify(
			'Update GitHub skills requires gh v2.90.0+ with `gh skill` support.',
			'warning',
		);
		return false;
	}
	try {
		const check_output = run_gh_skill_update(['--dry-run']);
		const selected = await show_picker_modal(ctx, {
			title: 'Update GitHub skills',
			subtitle: 'Dry-run result',
			items: [
				{
					value: 'apply',
					label: 'Apply updates',
					description: 'Run gh skill update --all and reload',
				},
				{
					value: 'check-only',
					label: 'Check only',
					description: 'Show dry-run output without modifying files',
				},
			],
			footer:
				check_output || 'No output from gh skill update --dry-run.',
		});
		if (!selected) return false;
		if (selected === 'check-only') {
			await show_text_modal(ctx, {
				title: 'GitHub skill update check',
				text:
					check_output || 'No output from gh skill update --dry-run.',
			});
			return false;
		}
		const output = run_gh_skill_update(['--all']);
		await show_text_modal(ctx, {
			title: 'GitHub skills updated',
			text: `${output || 'gh skill update --all completed.'}\n\nReloading...`,
		});
		await ctx.reload();
		return true;
	} catch (error) {
		ctx.ui.notify(
			error instanceof Error ? error.message : String(error),
			'warning',
		);
		return false;
	}
}

export async function show_refresh_summary(
	ctx: ExtensionCommandContext,
	mgr: SkillsManager,
): Promise<void> {
	mgr.refresh();
	ctx.ui.notify(
		`Skills refreshed: ${mgr.discover().length} managed, ${mgr.discover_importable().length} importable`,
		'info',
	);
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
