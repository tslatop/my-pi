import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { type SelectItem } from '@earendil-works/pi-tui';
import {
	show_confirm_modal,
	show_input_modal,
	show_picker_modal,
} from '@spences10/pi-tui-modal';
import { format_member_status } from '../formatting.js';
import type { RpcTeammate } from '../rpc-runner.js';
import {
	deliver_message_to_runner,
	get_team_status,
	shutdown_orphaned_member,
} from '../runner-orchestration.js';
import type { TeamStatus, TeamStore } from '../store.js';
import { set_team_ui } from '../ui-status.js';
import { show_team_member_picker } from './member-picker.js';

export type TeamMemberModalAction =
	| 'dm'
	| 'send'
	| 'steer'
	| 'wait'
	| 'shutdown';

async function show_team_member_action_modal(
	ctx: ExtensionCommandContext,
	member: TeamStatus['members'][number],
	runner: RpcTeammate | undefined,
): Promise<TeamMemberModalAction | undefined> {
	const is_running = runner?.is_running;
	const is_orphaned = member.status === 'running_orphaned';
	const items: SelectItem[] = [
		{
			value: 'dm',
			label: 'Send mailbox DM',
			description: 'Leave a persistent team message',
		},
	];
	if (is_running) {
		items.push(
			{
				value: 'send',
				label: 'Send prompt',
				description: 'Send a normal prompt to the running teammate',
			},
			{
				value: 'steer',
				label: 'Steer current turn',
				description: 'Queue guidance for the current teammate turn',
			},
		);
	}
	if (is_running || is_orphaned) {
		items.push(
			{
				value: 'wait',
				label: 'Wait for idle/offline',
				description: 'Block until the teammate stops running',
			},
			{
				value: 'shutdown',
				label: 'Shutdown teammate',
				description:
					'Ask attached runner to stop or terminate safe orphan',
			},
		);
	}

	const selected = await show_picker_modal(ctx, {
		title: member.name,
		subtitle: `${member.role} • ${format_member_status(member)}`,
		items,
		footer: 'enter runs action • esc back',
	});
	return selected as TeamMemberModalAction | undefined;
}

export async function show_team_member_actions_modal(
	ctx: ExtensionCommandContext,
	store: TeamStore,
	team_id: string,
	runners: Map<string, RpcTeammate>,
): Promise<void> {
	while (true) {
		const status = await get_team_status(store, team_id, runners);
		const member_name = await show_team_member_picker(ctx, status, {
			title: 'Teammate actions',
			subtitle: `${status.team.name} • ${status.members.length} member(s)`,
		});
		if (!member_name) return;
		const member = status.members.find(
			(item) => item.name === member_name,
		);
		if (!member) continue;
		const action = await show_team_member_action_modal(
			ctx,
			member,
			runners.get(member.name),
		);
		if (!action) continue;
		await run_member_modal_action(
			ctx,
			store,
			team_id,
			runners,
			member.name,
			action,
		);
	}
}

async function run_member_modal_action(
	ctx: ExtensionCommandContext,
	store: TeamStore,
	team_id: string,
	runners: Map<string, RpcTeammate>,
	member_name: string,
	action: TeamMemberModalAction,
): Promise<void> {
	if (action === 'dm') {
		const body = await show_input_modal(ctx, {
			title: `DM ${member_name}`,
			label: 'Message',
		});
		if (!body) return;
		const message = await store.send_message(team_id, {
			from: 'lead',
			to: member_name,
			body,
		});
		const runner = runners.get(message.to);
		if (runner?.is_running) {
			await deliver_message_to_runner(
				store,
				team_id,
				runner,
				message,
			);
		}
		ctx.ui.notify(`Sent ${message.id} to ${message.to}`);
		return;
	}

	if (action === 'send' || action === 'steer') {
		const prompt = await show_input_modal(ctx, {
			title:
				action === 'send'
					? `Send prompt to ${member_name}`
					: `Steer ${member_name}`,
			label: action === 'send' ? 'Prompt' : 'Steering message',
		});
		if (!prompt) return;
		const runner = runners.get(member_name);
		if (!runner?.is_running)
			throw new Error(`No running teammate: ${member_name}`);
		if (action === 'send') await runner.prompt(prompt);
		else await runner.steer(prompt);
		ctx.ui.notify(
			action === 'send'
				? `Sent prompt to ${member_name}`
				: `Steered ${member_name}`,
		);
		return;
	}

	if (action === 'wait') {
		set_team_ui(ctx, store, team_id, runners);
		ctx.ui.notify(
			`${member_name} is running in the background; lead session is free`,
		);
		return;
	}

	const confirmed = await show_confirm_modal(ctx, {
		title: `Shutdown ${member_name}?`,
		message:
			'Attached runners are asked to stop; safe orphaned teammate processes are terminated.',
		confirm_label: 'Shutdown',
	});
	if (!confirmed) return;
	const runner = runners.get(member_name);
	if (runner?.is_running) {
		await runner.shutdown('leader requested shutdown');
		runners.delete(member_name);
		await store.upsert_member(team_id, {
			name: member_name,
			status: 'offline',
		});
		ctx.ui.notify(`Shutdown requested for ${member_name}`);
	} else {
		const member = await shutdown_orphaned_member(
			store,
			team_id,
			member_name,
		);
		ctx.ui.notify(
			`Terminated orphaned teammate ${member_name}; status ${member.status}`,
		);
	}
}
