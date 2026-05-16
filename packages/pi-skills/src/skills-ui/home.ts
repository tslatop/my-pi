import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { show_picker_modal } from '@spences10/pi-tui-modal';

export interface SkillsHomeCounts {
	managed: number;
	pi_native: number;
}

export async function show_skills_home_modal(
	ctx: ExtensionCommandContext,
	counts: SkillsHomeCounts,
	active_profile: string,
): Promise<string | undefined> {
	return await show_picker_modal(ctx, {
		title: 'Skills',
		subtitle: `${counts.managed} managed • ${counts.pi_native} pi-native • profile ${active_profile}`,
		items: [
			{
				value: 'manage',
				label: 'Manage skills',
				description: 'Search, enable/disable, or delete Pi skills',
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
				description: 'Rescan managed skills',
			},
		],
		footer: 'enter opens • esc close/back',
	});
}
