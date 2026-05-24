import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { show_picker_modal } from '@spences10/pi-tui-modal';
import { format_member_status } from '../formatting.js';
import type { TeamStatus } from '../store.js';

export async function show_team_member_picker(
	ctx: ExtensionCommandContext,
	status: TeamStatus,
	options: { title: string; subtitle?: string },
): Promise<string | undefined> {
	return await show_picker_modal(ctx, {
		title: options.title,
		subtitle: options.subtitle,
		items: status.members.map((member) => ({
			value: member.name,
			label: member.name,
			description: `${member.role} • ${format_member_status(member)}`,
		})),
		empty_message: 'No members yet. Add one first.',
	});
}
