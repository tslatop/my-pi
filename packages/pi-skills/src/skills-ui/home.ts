import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { show_picker_modal } from '@spences10/pi-tui-modal';

export interface SkillsHomeCounts {
	managed: number;
	pi_native: number;
	claude_code_detected: number;
	importable: number;
}

export async function show_skills_home_modal(
	ctx: ExtensionCommandContext,
	counts: SkillsHomeCounts,
	active_profile: string,
): Promise<string | undefined> {
	const should_nudge_import =
		counts.pi_native === 0 && counts.importable > 0;

	return await show_picker_modal(ctx, {
		title: should_nudge_import
			? 'Skills — import Claude Code skills?'
			: 'Skills',
		subtitle: `${counts.managed} managed • ${counts.claude_code_detected} Claude Code detected • ${counts.importable} importable • profile ${active_profile}`,
		initial_index: should_nudge_import ? 1 : 0,
		items: [
			{
				value: 'manage',
				label: 'Manage skills',
				description:
					'Search, enable/disable, sync imported copies, or delete skills',
			},
			{
				value: 'importable',
				label: should_nudge_import
					? 'Import Claude Code skills'
					: 'Importable skills',
				description: should_nudge_import
					? 'Found Claude Code plugin skills; import them into pi-native storage'
					: 'Batch import external skills or sync imported copies',
			},
			{
				value: 'search',
				label: 'Search GitHub skills',
				description:
					'Find skills with gh skill search, preview, then install',
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
