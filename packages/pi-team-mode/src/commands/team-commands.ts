import {
	find_team_switch_target,
	get_latest_team_for_cwd,
	require_arg,
	team_has_running_members,
	team_is_stale,
} from '../command-utils.js';
import {
	collect_session_usage,
	collect_team_mailboxes,
	format_status,
	format_status_counts,
	format_team_dashboard,
	format_teams_list,
} from '../formatting.js';
import {
	get_team_status,
	get_team_statuses,
} from '../runner-orchestration.js';
import {
	confirm_delete_team_modal,
	confirm_prune_teams_modal,
	present_completed_task_results,
	prompt_member_name,
	prompt_team_name,
	show_saved_team_actions_modal,
	show_team_dashboard_modal,
	show_team_home_modal,
	show_team_member_actions_modal,
	show_team_ui_modal,
} from '../team-modals.js';
import {
	get_team_ui_mode,
	get_team_ui_style,
	has_modal_ui,
	set_team_ui,
	show_team_switcher,
	show_team_text_modal,
	TEAM_UI_ENV,
	TEAM_UI_STYLE_ENV,
} from '../ui-status.js';
import type { TeamCommandDeps } from './types.js';
import { current_team_id } from './types.js';

export async function run_empty_team_command(
	deps: TeamCommandDeps,
): Promise<void> {
	let selected: string | undefined;
	while (
		(selected = await show_team_home_modal(
			deps.ctx,
			deps.store,
			deps.get_active_team_id(),
		))
	) {
		await deps.handle_team_command(selected);
	}
}

export async function handle_create_team(
	deps: TeamCommandDeps,
	rest_text: string,
): Promise<void> {
	let name = rest_text;
	if (!name && has_modal_ui(deps.ctx)) {
		const input = await prompt_team_name(deps.ctx);
		if (input === undefined) return;
		name = input;
	}
	const team = deps.store.create_team({
		cwd: deps.ctx.cwd,
		name: name || undefined,
	});
	deps.set_active_team_id(team.id);
	set_team_ui(deps.ctx, deps.store, team.id, deps.runners);
	deps.ctx.ui.notify(`Created team ${team.name} (${team.id})`);
}

export async function handle_team_id(
	deps: TeamCommandDeps,
): Promise<void> {
	const team_id = current_team_id(deps);
	const text = `${team_id}\n${deps.store.team_dir(team_id)}`;
	if (has_modal_ui(deps.ctx)) {
		await show_team_text_modal(deps.ctx, {
			title: 'Team id/path',
			subtitle: team_id,
			text,
		});
	} else {
		deps.ctx.ui.notify(text);
	}
}

export async function handle_team_ui(
	deps: TeamCommandDeps,
	rest: string[],
	rest_text: string,
): Promise<void> {
	const [ui_arg, style_arg] = rest;
	const mode = rest_text.trim().toLowerCase();
	if (!mode) {
		if (has_modal_ui(deps.ctx)) {
			await show_team_ui_modal(
				deps.ctx,
				deps.store,
				deps.get_active_team_id(),
			);
		} else {
			deps.ctx.ui.notify(
				`Team UI mode: ${get_team_ui_mode()}, style: ${get_team_ui_style()}`,
			);
		}
		return;
	}
	if (ui_arg === 'style') {
		const style = style_arg?.trim().toLowerCase();
		if (!style) {
			deps.ctx.ui.notify(`Team UI style: ${get_team_ui_style()}`);
			return;
		}
		if (!['plain', 'badge', 'color'].includes(style)) {
			throw new Error('Usage: /team ui style plain|badge|color');
		}
		process.env[TEAM_UI_STYLE_ENV] = style;
		set_team_ui(
			deps.ctx,
			deps.store,
			deps.get_active_team_id(),
			deps.runners,
		);
		deps.ctx.ui.notify(`Team UI style: ${style}`);
		return;
	}
	if (!['auto', 'compact', 'full', 'off'].includes(mode)) {
		throw new Error(
			'Usage: /team ui auto|compact|full|off or /team ui style plain|badge|color',
		);
	}
	process.env[TEAM_UI_ENV] = mode;
	set_team_ui(
		deps.ctx,
		deps.store,
		deps.get_active_team_id(),
		deps.runners,
	);
	deps.ctx.ui.notify(`Team UI mode: ${mode}`);
}

export async function handle_teams(
	deps: TeamCommandDeps,
): Promise<void> {
	if (has_modal_ui(deps.ctx)) {
		while (true) {
			const team_id = await show_team_switcher(
				deps.ctx,
				deps.store,
				deps.get_active_team_id(),
			);
			if (!team_id) break;
			const status = await get_team_status(
				deps.store,
				team_id,
				deps.runners,
			);
			const action = await show_saved_team_actions_modal(
				deps.ctx,
				status,
				deps.get_active_team_id(),
			);
			if (action === 'switch') {
				deps.set_active_team_id(team_id);
				set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
				deps.ctx.ui.notify(
					`Switched to team ${status.team.name} (${status.team.id})`,
				);
				break;
			}
			if (action === 'dashboard') {
				const dashboard_action = await show_team_dashboard_modal(
					deps.ctx,
					deps.store,
					status,
					deps.runners,
				);
				if (dashboard_action === 'results')
					present_completed_task_results(deps.ctx, status);
			}
			if (action === 'detach') {
				deps.set_active_team_id(undefined);
				set_team_ui(deps.ctx, deps.store, undefined, deps.runners);
				deps.ctx.ui.notify('Detached team UI');
				break;
			}
			if (action === 'delete') {
				if (team_has_running_members(status)) {
					deps.ctx.ui.notify(
						'Shut down running teammates before deleting a team.',
						'warning',
					);
					continue;
				}
				if (!(await confirm_delete_team_modal(deps.ctx, status.team)))
					continue;
				await deps.store.delete_team(team_id);
				if (deps.get_active_team_id() === team_id) {
					deps.set_active_team_id(undefined);
					set_team_ui(deps.ctx, deps.store, undefined, deps.runners);
				}
				deps.ctx.ui.notify(
					`Deleted team ${status.team.name} (${status.team.id})`,
					'info',
				);
			}
		}
		return;
	}
	const statuses = await get_team_statuses(deps.store, deps.runners);
	deps.ctx.ui.notify(
		format_teams_list(statuses, deps.get_active_team_id()),
	);
}

export async function handle_switch_team(
	deps: TeamCommandDeps,
	rest_text: string,
): Promise<void> {
	const target = rest_text
		? find_team_switch_target(deps.store, rest_text).id
		: has_modal_ui(deps.ctx)
			? await show_team_switcher(
					deps.ctx,
					deps.store,
					deps.get_active_team_id(),
				)
			: undefined;
	if (!target) {
		const statuses = await get_team_statuses(
			deps.store,
			deps.runners,
		);
		deps.ctx.ui.notify(
			format_teams_list(statuses, deps.get_active_team_id()),
		);
		return;
	}
	deps.set_active_team_id(target);
	set_team_ui(deps.ctx, deps.store, target, deps.runners);
	const team = deps.store.load_team(target);
	deps.ctx.ui.notify(`Switched to team ${team.name} (${team.id})`);
}

export function handle_detach_team(deps: TeamCommandDeps): void {
	deps.set_active_team_id(undefined);
	set_team_ui(deps.ctx, deps.store, undefined, deps.runners);
	deps.ctx.ui.notify('Detached team UI');
}

export async function handle_delete_team(
	deps: TeamCommandDeps,
	rest_text: string,
): Promise<void> {
	const target = find_team_switch_target(
		deps.store,
		rest_text || current_team_id(deps),
	);
	const status = await get_team_status(
		deps.store,
		target.id,
		deps.runners,
	);
	if (team_has_running_members(status))
		throw new Error(
			'Shut down running teammates before deleting a team.',
		);
	const confirmed = has_modal_ui(deps.ctx)
		? await confirm_delete_team_modal(deps.ctx, status.team)
		: await deps.ctx.ui.confirm(
				'Delete team?',
				`Delete ${status.team.name} (${status.team.id}) from local team storage?`,
			);
	if (!confirmed) return;
	await deps.store.delete_team(target.id);
	if (deps.get_active_team_id() === target.id) {
		deps.set_active_team_id(undefined);
		set_team_ui(deps.ctx, deps.store, undefined, deps.runners);
	}
	deps.ctx.ui.notify(
		`Deleted team ${status.team.name} (${status.team.id})`,
		'info',
	);
}

export async function handle_prune_teams(
	deps: TeamCommandDeps,
	rest: string[],
): Promise<void> {
	const days_arg = rest.find((item) => /^\d+$/.test(item));
	const days = days_arg ? Number(days_arg) : 14;
	const cwd_only = rest.includes('--cwd');
	const statuses = await get_team_statuses(deps.store, deps.runners);
	const stale = statuses.filter(
		(status) =>
			(!cwd_only || status.team.cwd === deps.ctx.cwd) &&
			team_is_stale(status, days),
	);
	if (stale.length === 0) {
		deps.ctx.ui.notify(
			`No stale teams older than ${days} day(s)${cwd_only ? ' for this cwd' : ''}.`,
		);
		return;
	}
	const confirmed = has_modal_ui(deps.ctx)
		? await confirm_prune_teams_modal(deps.ctx, stale.length, days)
		: await deps.ctx.ui.confirm(
				'Prune stale teams?',
				`Delete ${stale.length} stale team(s) older than ${days} day(s)?`,
			);
	if (!confirmed) return;
	for (const status of stale)
		await deps.store.delete_team(status.team.id);
	if (
		deps.get_active_team_id() &&
		stale.some(
			(status) => status.team.id === deps.get_active_team_id(),
		)
	) {
		deps.set_active_team_id(undefined);
		set_team_ui(deps.ctx, deps.store, undefined, deps.runners);
	}
	deps.ctx.ui.notify(
		`Deleted ${stale.length} stale team(s).`,
		'info',
	);
}

export async function handle_status(
	deps: TeamCommandDeps,
): Promise<void> {
	const team_id = current_team_id(deps);
	const status = await get_team_status(
		deps.store,
		team_id,
		deps.runners,
	);
	set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
	const text = format_status(status);
	if (has_modal_ui(deps.ctx)) {
		await show_team_text_modal(deps.ctx, {
			title: 'Team status',
			subtitle: `${status.team.name} • ${format_status_counts(status)}`,
			text,
		});
	} else {
		deps.ctx.ui.notify(text);
	}
}

export async function handle_dashboard(
	deps: TeamCommandDeps,
): Promise<void> {
	const team_id = current_team_id(deps);
	const status = await get_team_status(
		deps.store,
		team_id,
		deps.runners,
	);
	set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
	if (has_modal_ui(deps.ctx)) {
		const action = await show_team_dashboard_modal(
			deps.ctx,
			deps.store,
			status,
			deps.runners,
		);
		if (action === 'results')
			present_completed_task_results(deps.ctx, status);
	} else {
		deps.ctx.ui.notify(
			format_team_dashboard(status, {
				team_dir: deps.store.team_dir(team_id),
				mailboxes: collect_team_mailboxes(deps.store, status),
				session_usage: collect_session_usage(status.members),
			}),
		);
	}
}

export async function handle_results(
	deps: TeamCommandDeps,
): Promise<void> {
	present_completed_task_results(
		deps.ctx,
		await get_team_status(
			deps.store,
			current_team_id(deps),
			deps.runners,
		),
	);
}

export function handle_resume(deps: TeamCommandDeps): void {
	const team = get_latest_team_for_cwd(deps.store, deps.ctx.cwd);
	if (!team) throw new Error('No previous team for this cwd.');
	deps.set_active_team_id(team.id);
	set_team_ui(deps.ctx, deps.store, team.id, deps.runners);
	deps.ctx.ui.notify(`Resumed team ${team.name} (${team.id})`);
}

export async function handle_members(
	deps: TeamCommandDeps,
): Promise<void> {
	const team_id = current_team_id(deps);
	await show_team_member_actions_modal(
		deps.ctx,
		deps.store,
		team_id,
		deps.runners,
	);
	set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
}

export async function handle_member(
	deps: TeamCommandDeps,
	rest: string[],
): Promise<void> {
	const [action, name] = rest;
	if (action !== 'add')
		throw new Error('Usage: /team member add <name>');
	let member_name: string | undefined = name;
	if (!member_name && has_modal_ui(deps.ctx)) {
		member_name = await prompt_member_name(deps.ctx);
		if (!member_name) return;
	}
	const member = await deps.store.upsert_member(
		current_team_id(deps),
		{
			name: require_arg(member_name, 'member name'),
		},
	);
	set_team_ui(
		deps.ctx,
		deps.store,
		deps.get_active_team_id(),
		deps.runners,
	);
	deps.ctx.ui.notify(`Member ${member.name} ready`);
}
