import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import {
	show_input_modal,
	show_picker_modal,
	show_text_modal,
} from '@spences10/pi-tui-modal';
import {
	has_gh_skill,
	list_github_repository_skills,
	run_gh_skill_install,
	run_gh_skill_update,
} from '../gh-skill.js';

function is_already_installed_error(error: unknown): boolean {
	const message =
		error instanceof Error ? error.message : String(error);
	return message.includes('already installed');
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
