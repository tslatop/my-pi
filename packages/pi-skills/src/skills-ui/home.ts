import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { show_picker_modal } from '@spences10/pi-tui-modal';

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
