import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import {
	type SelectItem,
	type SettingItem,
} from '@earendil-works/pi-tui';
import {
	show_confirm_modal,
	show_input_modal,
	show_picker_modal,
	show_settings_modal,
} from '@spences10/pi-tui-modal';
import {
	format_member_status,
	format_status_counts,
	format_task_detail,
	format_task_status,
	summarize_result,
} from './formatting.js';
import { show_team_member_picker } from './modals/member-picker.js';
import { get_team_statuses } from './runner-orchestration.js';
import {
	TeamStore,
	type TeamConfig,
	type TeamStatus,
} from './store.js';
import type { TeamUiMode, TeamUiStyle } from './team-tool-params.js';
import {
	get_team_ui_mode,
	get_team_ui_style,
	set_team_ui,
	show_team_text_modal,
	TEAM_UI_ENV,
	TEAM_UI_STYLE_ENV,
} from './ui-status.js';
export {
	present_completed_task_results,
	show_team_dashboard_modal,
} from './modals/dashboard.js';
export { show_team_member_actions_modal } from './modals/member-actions.js';

function get_latest_team_for_cwd(
	store: TeamStore,
	cwd: string,
): TeamConfig | undefined {
	return store.list_teams().find((team) => team.cwd === cwd);
}

const TEAM_UI_MODE_VALUES: TeamUiMode[] = [
	'compact',
	'auto',
	'full',
	'off',
];
const TEAM_UI_STYLE_VALUES: TeamUiStyle[] = [
	'plain',
	'badge',
	'color',
];

export async function show_team_ui_modal(
	ctx: ExtensionCommandContext,
	store: TeamStore,
	team_id: string | undefined,
): Promise<void> {
	const items: SettingItem[] = [
		{
			id: 'mode',
			label: 'Status UI',
			currentValue: get_team_ui_mode(),
			values: TEAM_UI_MODE_VALUES,
			description:
				'compact keeps team mode in the footer, auto/full show the richer widget when there is useful detail, and off hides team UI for this session.',
		},
		{
			id: 'style',
			label: 'Visual style',
			currentValue: get_team_ui_style(),
			values: TEAM_UI_STYLE_VALUES,
			description:
				'plain is quiet, badge adds semantic icons, and color adds stronger status emphasis.',
		},
	];

	const current_status = team_id
		? await store.get_status(team_id)
		: undefined;
	await show_settings_modal(ctx, {
		title: 'Team UI',
		subtitle: () =>
			current_status
				? `Active team ${team_id} • ${format_status_counts(current_status)}`
				: 'No active team • settings apply to this session',
		items,
		metadata: (item) => item?.description,
		footer:
			'enter/space cycles values • changes apply immediately • esc close',
		on_change: (id, new_value) => {
			if (id === 'mode') process.env[TEAM_UI_ENV] = new_value;
			if (id === 'style') process.env[TEAM_UI_STYLE_ENV] = new_value;
			set_team_ui(ctx, store, team_id);
		},
	});
}

export async function show_team_home_modal(
	ctx: ExtensionCommandContext,
	store: TeamStore,
	active_team_id: string | undefined,
): Promise<string | undefined> {
	const statuses = await get_team_statuses(store);
	const active_status = statuses.find(
		(status) => status.team.id === active_team_id,
	);
	const latest = get_latest_team_for_cwd(store, ctx.cwd);
	const items: SelectItem[] = [];

	if (active_status) {
		items.push(
			{
				value: 'dashboard',
				label: 'Open dashboard',
				description:
					'Members, tasks, mailboxes, transcripts, and usage',
			},
			{
				value: 'task add',
				label: 'Create task',
				description: 'Queue work with an optional assignee',
			},
			{
				value: 'member add',
				label: 'Add member',
				description: 'Register a teammate name before assigning work',
			},
			{
				value: 'results',
				label: 'Summarize completed results',
				description: `${active_status.counts.completed} completed task(s)`,
			},
			{
				value: 'status',
				label: 'Show status',
				description: format_status_counts(active_status),
			},
			{
				value: 'task',
				label: 'Browse tasks',
				description:
					active_status.tasks.length > 0
						? `${active_status.tasks.length} tasks in this team`
						: 'No tasks yet',
			},
			{
				value: 'members',
				label: 'Teammate actions',
				description:
					active_status.members.length > 0
						? `${active_status.members.length} members available`
						: 'No members yet',
			},
			{
				value: 'switch',
				label: 'Switch team',
				description: 'Pick another saved team',
			},
			{
				value: 'ui',
				label: 'Team UI settings',
				description: `Mode ${get_team_ui_mode()} • style ${get_team_ui_style()}`,
			},
			{
				value: 'id',
				label: 'Show team id/path',
				description: active_status.team.id,
			},
			{
				value: 'clear',
				label: 'Detach team UI',
				description: 'Keep state on disk but clear this session view',
			},
		);
	} else {
		items.push({
			value: 'create',
			label: 'Create team',
			description: 'Start a new local team for this repo',
		});
		if (latest) {
			items.push({
				value: 'resume',
				label: 'Resume latest team',
				description: `${latest.name} (${latest.id})`,
			});
		}
		if (statuses.length > 0) {
			items.push({
				value: 'switch',
				label: 'Switch team',
				description: `${statuses.length} saved teams`,
			});
		}
		items.push({
			value: 'ui',
			label: 'Team UI settings',
			description: `Mode ${get_team_ui_mode()} • style ${get_team_ui_style()}`,
		});
	}

	if (statuses.length > 0) {
		items.push({
			value: 'teams',
			label: 'List all teams',
			description: `${statuses.length} teams stored locally`,
		});
	}

	return await show_picker_modal(ctx, {
		title: 'Team mode',
		subtitle: active_status
			? `Active: ${active_status.team.name} • ${format_status_counts(active_status)}`
			: 'No active team',
		items,
		max_visible: Math.min(Math.max(items.length, 6), 10),
		footer: 'enter runs action • esc cancel',
	});
}

export type SavedTeamModalAction =
	| 'switch'
	| 'dashboard'
	| 'delete'
	| 'detach';

export async function show_saved_team_actions_modal(
	ctx: ExtensionCommandContext,
	status: TeamStatus,
	active_team_id: string | undefined,
): Promise<SavedTeamModalAction | undefined> {
	const is_active = status.team.id === active_team_id;
	const items: SelectItem[] = [
		{
			value: 'switch',
			label: is_active ? 'Keep selected' : 'Switch to team',
			description: `${format_status_counts(status)} • ${status.team.cwd}`,
		},
		{
			value: 'dashboard',
			label: 'Open dashboard',
			description:
				'Members, tasks, mailboxes, transcripts, and usage',
		},
		{
			value: 'delete',
			label: 'Delete team',
			description: 'Remove stored team state from disk',
		},
	];
	if (is_active) {
		items.push({
			value: 'detach',
			label: 'Detach team UI',
			description: 'Keep state on disk but clear this session view',
		});
	}

	return (await show_picker_modal(ctx, {
		title: status.team.name,
		subtitle: `${status.team.id} • ${format_status_counts(status)}`,
		items,
		footer: 'enter runs action • esc back',
	})) as SavedTeamModalAction | undefined;
}

export async function confirm_delete_team_modal(
	ctx: ExtensionCommandContext,
	team: TeamConfig,
): Promise<boolean> {
	return await show_confirm_modal(ctx, {
		title: 'Delete team?',
		message: `Delete ${team.name} (${team.id}) from local team storage? This cannot be undone.`,
		confirm_label: 'Delete team',
	});
}

export async function confirm_prune_teams_modal(
	ctx: ExtensionCommandContext,
	count: number,
	older_than_days: number,
): Promise<boolean> {
	return await show_confirm_modal(ctx, {
		title: 'Prune stale teams?',
		message: `Delete ${count} stale team(s) older than ${older_than_days} day(s)? This cannot be undone.`,
		confirm_label: 'Prune teams',
	});
}

export async function show_team_task_picker(
	ctx: ExtensionCommandContext,
	status: TeamStatus,
): Promise<string | undefined> {
	const items: SelectItem[] = status.tasks.map((task) => ({
		value: task.id,
		label: `#${task.id} ${task.title}`,
		description: [
			format_task_status(task.status),
			task.status,
			task.assignee ? `@${task.assignee}` : 'unassigned',
			task.depends_on.length
				? `waits for #${task.depends_on.join(', #')}`
				: undefined,
			summarize_result(task.result),
		]
			.filter(Boolean)
			.join(' • '),
	}));

	return await show_picker_modal(ctx, {
		title: 'Team tasks',
		subtitle: `${status.team.name} • ${format_status_counts(status)}`,
		items,
		max_visible: Math.min(Math.max(items.length, 8), 14),
		empty_message: 'No team tasks yet',
		footer: 'enter manages task • esc back',
	});
}

type TeamTaskModalAction =
	| 'show'
	| 'done'
	| 'block'
	| 'cancel'
	| 'reopen'
	| 'assign'
	| 'unassign';

export async function show_team_task_action_modal(
	ctx: ExtensionCommandContext,
	status: TeamStatus,
	task: TeamStatus['tasks'][number],
): Promise<TeamTaskModalAction | undefined> {
	const items: SelectItem[] = [
		{
			value: 'show',
			label: 'Show details',
			description: 'Read the task description and result note',
		},
	];

	if (task.status !== 'completed') {
		items.push({
			value: 'done',
			label: 'Mark completed',
			description: 'Optionally add a result note',
		});
	}
	if (task.status !== 'blocked') {
		items.push({
			value: 'block',
			label: 'Mark blocked',
			description: 'Add a blocker note',
		});
	}
	if (task.status !== 'cancelled') {
		items.push({
			value: 'cancel',
			label: 'Cancel task',
			description: 'Optionally add a cancellation reason',
		});
	}
	if (task.status !== 'pending') {
		items.push({
			value: 'reopen',
			label: 'Reopen task',
			description: 'Move back to pending and clear the result note',
		});
	}
	if (status.members.length > 0) {
		items.push({
			value: 'assign',
			label: 'Assign member',
			description: 'Choose a teammate for this task',
		});
	}
	if (task.assignee) {
		items.push({
			value: 'unassign',
			label: 'Unassign',
			description: `Remove ${task.assignee} from this task`,
		});
	}

	const selected = await show_picker_modal(ctx, {
		title: `Task #${task.id}`,
		subtitle: `${task.status} • ${task.assignee ? `@${task.assignee}` : 'unassigned'}`,
		items,
		footer: 'enter runs action • esc back',
	});
	return selected as TeamTaskModalAction | undefined;
}

export async function prompt_team_name(
	ctx: ExtensionCommandContext,
): Promise<string | undefined> {
	return await show_input_modal(ctx, {
		title: 'Create team',
		label: 'Team name (optional)',
		allow_empty: true,
	});
}

export async function prompt_member_name(
	ctx: ExtensionCommandContext,
): Promise<string | undefined> {
	return await show_input_modal(ctx, {
		title: 'Add member',
		label: 'Member name',
	});
}

async function prompt_task_note(
	ctx: ExtensionCommandContext,
	options: { title: string; label: string },
): Promise<string | undefined> {
	return await show_input_modal(ctx, {
		title: options.title,
		label: options.label,
		allow_empty: true,
	});
}

export async function prompt_task_create(
	ctx: ExtensionCommandContext,
	status: TeamStatus,
): Promise<{ title: string; assignee?: string } | undefined> {
	const title = await show_input_modal(ctx, {
		title: 'Create task',
		label: 'Task title',
	});
	if (!title) return undefined;
	if (status.members.length === 0) return { title };

	const assignee = await show_picker_modal(ctx, {
		title: 'Assign task',
		subtitle: title,
		items: [
			{
				value: '__unassigned__',
				label: 'Leave unassigned',
				description: 'Queue the task without an owner',
			},
			...status.members.map((member) => ({
				value: member.name,
				label: member.name,
				description: `${member.role} • ${format_member_status(member)}`,
			})),
		],
		footer: 'enter selects • esc leaves unassigned',
	});
	return {
		title,
		assignee:
			assignee && assignee !== '__unassigned__'
				? assignee
				: undefined,
	};
}

export async function run_task_modal_action(
	ctx: ExtensionCommandContext,
	store: TeamStore,
	team_id: string,
	status: TeamStatus,
	task_id: string,
	action: TeamTaskModalAction,
): Promise<void> {
	const task = store.load_task(team_id, task_id);
	if (action === 'show') {
		await show_team_text_modal(ctx, {
			title: `Task #${task_id}`,
			subtitle: status.team.name,
			text: format_task_detail(task),
		});
		return;
	}

	if (action === 'assign') {
		const assignee = await show_team_member_picker(ctx, status, {
			title: `Assign task #${task_id}`,
			subtitle: task.title,
		});
		if (!assignee) return;
		await store.update_task(team_id, task_id, { assignee });
		ctx.ui.notify(`Assigned task #${task_id} to ${assignee}`);
		return;
	}

	if (action === 'unassign') {
		const confirmed = await show_confirm_modal(ctx, {
			title: `Unassign task #${task_id}?`,
			message: task.assignee
				? `Remove ${task.assignee} from ${task.title}?`
				: `Task #${task_id} is already unassigned.`,
			confirm_label: 'Unassign',
		});
		if (!confirmed) return;
		await store.update_task(team_id, task_id, { assignee: null });
		ctx.ui.notify(`Unassigned task #${task_id}`);
		return;
	}

	if (action === 'reopen') {
		const confirmed = await show_confirm_modal(ctx, {
			title: `Reopen task #${task_id}?`,
			message: `Move ${task.title} back to pending and clear the result note?`,
			confirm_label: 'Reopen',
		});
		if (!confirmed) return;
		await store.update_task(team_id, task_id, {
			status: 'pending',
			result: null,
		});
		ctx.ui.notify(`Reopened task #${task_id}`);
		return;
	}

	const note = await prompt_task_note(ctx, {
		title:
			action === 'done'
				? `Complete task #${task_id}`
				: action === 'block'
					? `Block task #${task_id}`
					: `Cancel task #${task_id}`,
		label:
			action === 'done'
				? 'Result note (optional)'
				: action === 'block'
					? 'Blocker reason (optional)'
					: 'Cancellation reason (optional)',
	});
	if (note === undefined) return;
	const next_status =
		action === 'done'
			? 'completed'
			: action === 'block'
				? 'blocked'
				: 'cancelled';
	await store.update_task(team_id, task_id, {
		status: next_status,
		result: note || null,
	});
	ctx.ui.notify(`Updated task #${task_id} to ${next_status}`);
}
