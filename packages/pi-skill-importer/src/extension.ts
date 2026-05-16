import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import {
	show_confirm_modal,
	show_picker_modal,
	show_text_modal,
} from '@spences10/pi-tui-modal';
import {
	delete_managed_skill as delete_imported_skill,
	get_imported_skill_sync_status,
	import_external_skill,
	sync_imported_skill,
} from './importer.js';
import {
	scan_importable_skills,
	scan_managed_skills,
	type DiscoveredSkill,
} from './scanner.js';

const WARNING =
	'External skills can instruct agent behavior and tool use. Import copies only after reviewing their source.';

function skill_key(skill: DiscoveredSkill): string {
	return `${skill.source}/${skill.name}`;
}

function imported_skills(): DiscoveredSkill[] {
	return scan_managed_skills().filter((skill) => skill.import_meta);
}

function sort_skills(skills: DiscoveredSkill[]): DiscoveredSkill[] {
	return [...skills].sort((a, b) =>
		`${a.name}\0${a.source}`.localeCompare(`${b.name}\0${b.source}`),
	);
}

function find_skill(
	skills: DiscoveredSkill[],
	target: string,
): DiscoveredSkill {
	const trimmed = target.trim();
	const match = skills.find(
		(skill) =>
			skill.name === trimmed ||
			skill_key(skill) === trimmed ||
			skill.baseDir === trimmed ||
			skill.skillPath === trimmed,
	);
	if (!match) throw new Error(`Skill not found: ${target}`);
	return match;
}

function find_imported_for_sync(target: string): DiscoveredSkill {
	const imported = imported_skills();
	try {
		return find_skill(imported, target);
	} catch {
		const external = find_skill(scan_importable_skills(), target);
		const match = imported.find(
			(skill) =>
				skill.import_meta?.source === external.source &&
				skill.import_meta.upstream_base_dir === external.baseDir,
		);
		if (match) return match;
		throw new Error(`Imported copy not found for ${target}`);
	}
}

function format_plugin(skill: DiscoveredSkill): string {
	if (!skill.plugin) return skill.source;
	return [
		skill.source,
		`version ${skill.plugin.version}`,
		skill.plugin.gitCommitSha
			? `commit ${skill.plugin.gitCommitSha.slice(0, 12)}`
			: undefined,
	]
		.filter(Boolean)
		.join(' • ');
}

function format_external(skill: DiscoveredSkill): string {
	return [
		`${skill.name} — ${skill.description}`,
		`key: ${skill_key(skill)}`,
		`source: ${format_plugin(skill)}`,
		`upstream: ${skill.baseDir}`,
	].join('\n');
}

function format_imported(skill: DiscoveredSkill): string {
	const status = get_imported_skill_sync_status(skill);
	const meta = skill.import_meta!;
	return [
		`${skill.name} — ${status.status.replaceAll('-', ' ')}`,
		`key: ${skill_key(skill)}`,
		`source: ${meta.source}`,
		meta.upstream_version
			? `version: ${meta.upstream_version}`
			: undefined,
		meta.upstream_git_commit_sha
			? `commit: ${meta.upstream_git_commit_sha.slice(0, 12)}`
			: undefined,
		`upstream: ${meta.upstream_base_dir}`,
		status.detail,
	]
		.filter(Boolean)
		.join('\n');
}

function notify_error(
	ctx: ExtensionCommandContext,
	error: unknown,
): void {
	ctx.ui.notify(
		error instanceof Error ? error.message : String(error),
		'warning',
	);
}

async function pick_external(
	ctx: ExtensionCommandContext,
): Promise<DiscoveredSkill | undefined> {
	const skills = sort_skills(scan_importable_skills());
	const selected = await show_picker_modal(ctx, {
		title: 'Import external skill',
		subtitle: WARNING,
		items: skills.map((skill) => ({
			value: skill_key(skill),
			label: skill.name,
			description: `${skill.source} • ${skill.baseDir}`,
		})),
		selected_footer: (item) => {
			const skill = item ? find_skill(skills, item.value) : undefined;
			return skill ? format_external(skill).split('\n') : undefined;
		},
		empty_message: 'No importable external skills found',
		max_visible: 12,
	});
	return selected ? find_skill(skills, selected) : undefined;
}

async function pick_imported(
	ctx: ExtensionCommandContext,
	title: string,
): Promise<DiscoveredSkill | undefined> {
	const skills = sort_skills(imported_skills());
	const selected = await show_picker_modal(ctx, {
		title,
		subtitle:
			'Only copied Pi-native skills with importer metadata are shown.',
		items: skills.map((skill) => ({
			value: skill_key(skill),
			label: skill.name,
			description: get_imported_skill_sync_status(skill).status,
		})),
		selected_footer: (item) => {
			const skill = item ? find_skill(skills, item.value) : undefined;
			return skill ? format_imported(skill).split('\n') : undefined;
		},
		empty_message: 'No imported skill copies found',
		max_visible: 12,
	});
	return selected ? find_skill(skills, selected) : undefined;
}

async function show_home(
	ctx: ExtensionCommandContext,
): Promise<void> {
	while (true) {
		const external = scan_importable_skills();
		const imported = imported_skills();
		const action = await show_picker_modal(ctx, {
			title: 'Skill importer',
			subtitle: `${external.length} external • ${imported.length} imported copies`,
			footer: WARNING,
			items: [
				{
					value: 'list',
					label: 'List skills',
					description: 'Show importable and imported skills',
				},
				{
					value: 'import',
					label: 'Import external skill',
					description:
						'Copy an external skill into Pi-native storage',
				},
				{
					value: 'sync',
					label: 'Sync imported copy',
					description: 'Refresh a copied skill when upstream changed',
				},
				{
					value: 'delete',
					label: 'Delete imported copy',
					description:
						'Remove only copied skills with importer metadata',
				},
			],
		});
		if (!action) return;
		if (action === 'list') await show_list(ctx);
		else if (action === 'import') await import_command('', ctx);
		else if (action === 'sync') await sync_command('', ctx);
		else if (action === 'delete') await delete_command('', ctx);
	}
}

async function show_list(
	ctx: ExtensionCommandContext,
): Promise<void> {
	const external = sort_skills(scan_importable_skills());
	const imported = sort_skills(imported_skills());
	const text = [
		WARNING,
		'',
		'Importable external skills',
		external.length
			? external.map(format_external).join('\n\n')
			: 'None found.',
		'',
		'Imported copies',
		imported.length
			? imported.map(format_imported).join('\n\n')
			: 'None found.',
	].join('\n');
	if (ctx.hasUI)
		await show_text_modal(ctx, { title: 'Skill importer', text });
	else ctx.ui.notify(text);
}

async function import_command(
	target: string,
	ctx: ExtensionCommandContext,
): Promise<void> {
	try {
		const skill = target
			? find_skill(scan_importable_skills(), target)
			: ctx.hasUI
				? await pick_external(ctx)
				: undefined;
		if (!skill) {
			ctx.ui.notify(
				'Usage: /skill-importer import <key|name>',
				'warning',
			);
			return;
		}
		if (ctx.hasUI) {
			const ok = await show_confirm_modal(ctx, {
				title: 'Import external skill?',
				message: `${WARNING}\n\n${format_external(skill)}`,
				confirm_label: 'Import copy',
				cancel_label: 'Cancel',
			});
			if (!ok) return;
		}
		const result = import_external_skill(skill);
		ctx.ui.notify(
			`Imported ${skill.name} to ${result.skillDir}. Reloading...`,
			'info',
		);
		await ctx.reload();
	} catch (error) {
		notify_error(ctx, error);
	}
}

async function sync_command(
	target: string,
	ctx: ExtensionCommandContext,
): Promise<void> {
	try {
		const skill = target
			? find_imported_for_sync(target)
			: ctx.hasUI
				? await pick_imported(ctx, 'Sync imported skill')
				: undefined;
		if (!skill) {
			ctx.ui.notify(
				'Usage: /skill-importer sync <key|name>',
				'warning',
			);
			return;
		}
		const result = sync_imported_skill(skill);
		ctx.ui.notify(
			result.changed
				? `Synced ${skill.name}. Reloading...`
				: `${skill.name} is already up to date.`,
			'info',
		);
		if (result.changed) await ctx.reload();
	} catch (error) {
		notify_error(ctx, error);
	}
}

async function delete_command(
	target: string,
	ctx: ExtensionCommandContext,
): Promise<void> {
	try {
		const skill = target
			? find_skill(imported_skills(), target)
			: ctx.hasUI
				? await pick_imported(ctx, 'Delete imported skill copy')
				: undefined;
		if (!skill) {
			ctx.ui.notify(
				'Usage: /skill-importer delete <key|name>',
				'warning',
			);
			return;
		}
		if (ctx.hasUI) {
			const ok = await show_confirm_modal(ctx, {
				title: 'Delete imported copy?',
				message: `Delete copied Pi skill ${skill.name}? Upstream external sources are never deleted.`,
				confirm_label: 'Delete copy',
				cancel_label: 'Keep copy',
			});
			if (!ok) return;
		}
		const result = delete_imported_skill(skill);
		ctx.ui.notify(
			`Deleted imported copy at ${result.skillDir}. Reloading...`,
			'info',
		);
		await ctx.reload();
	} catch (error) {
		notify_error(ctx, error);
	}
}

function completions(prefix: string) {
	const parts = prefix.trimStart().split(/\s+/);
	const has_trailing_space = /\s$/.test(prefix);
	if (parts.length <= 1 && !has_trailing_space) {
		return ['list', 'import', 'sync', 'delete']
			.filter((item) => item.startsWith(parts[0] ?? ''))
			.map((item) => ({ value: item, label: item }));
	}
	const sub = parts[0];
	const target_prefix = parts.slice(1).join(' ').toLowerCase();
	const skills =
		sub === 'import' ? scan_importable_skills() : imported_skills();
	return skills
		.flatMap((skill) => [skill_key(skill), skill.name])
		.filter((item) => item.toLowerCase().includes(target_prefix))
		.slice(0, 20)
		.map((item) => ({ value: `${sub} ${item}`, label: item }));
}

export default async function skill_importer(
	pi: ExtensionAPI,
): Promise<void> {
	pi.registerCommand('skill-importer', {
		description:
			'Import external Agent Skills into Pi-native storage',
		getArgumentCompletions: completions,
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			if (!trimmed && ctx.hasUI) {
				await show_home(ctx);
				return;
			}

			const [sub = 'list', ...rest] = trimmed.split(/\s+/);
			const target = rest.join(' ');
			switch (sub) {
				case 'list':
				case 'ls':
					await show_list(ctx);
					break;
				case 'import':
					await import_command(target, ctx);
					break;
				case 'sync':
					await sync_command(target, ctx);
					break;
				case 'delete':
				case 'remove':
					await delete_command(target, ctx);
					break;
				default:
					ctx.ui.notify(
						'Usage: /skill-importer [list|import|sync|delete] [key|name]',
						'warning',
					);
			}
		},
	});
}
