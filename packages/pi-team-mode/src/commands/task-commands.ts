import { parse_task_add } from '../command-parser.js';
import { require_arg } from '../command-utils.js';
import {
	format_status,
	format_status_counts,
	format_task_detail,
} from '../formatting.js';
import { get_team_status } from '../runner-orchestration.js';
import {
	prompt_task_create,
	run_task_modal_action,
	show_team_task_action_modal,
	show_team_task_picker,
} from '../team-modals.js';
import {
	has_modal_ui,
	set_team_ui,
	show_team_text_modal,
} from '../ui-status.js';
import type { TeamCommandDeps } from './types.js';
import { current_team_id } from './types.js';

export async function handle_task_command(
	deps: TeamCommandDeps,
	rest: string[],
): Promise<void> {
	const [action, id, ...tail] = rest;
	const team_id = current_team_id(deps);
	if (action === 'add') {
		const text = rest.slice(1).join(' ');
		const parsed = text
			? parse_task_add(text)
			: has_modal_ui(deps.ctx)
				? await prompt_task_create(
						deps.ctx,
						await get_team_status(deps.store, team_id, deps.runners),
					)
				: parse_task_add(text);
		if (!parsed) return;
		const task = await deps.store.create_task(team_id, parsed);
		set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
		deps.ctx.ui.notify(`Created task #${task.id}: ${task.title}`);
		return;
	}
	if (action === 'list' || !action) {
		await handle_task_list(deps, team_id);
		return;
	}
	if (action === 'show' || action === 'get') {
		const task_id = require_arg(id, 'task id');
		const text = format_task_detail(
			deps.store.load_task(team_id, task_id),
		);
		if (has_modal_ui(deps.ctx)) {
			await show_team_text_modal(deps.ctx, {
				title: `Task #${task_id}`,
				text,
			});
		} else {
			deps.ctx.ui.notify(text);
		}
		return;
	}
	if (action === 'done') {
		const task = await deps.store.update_task(
			team_id,
			require_arg(id, 'task id'),
			{
				status: 'completed',
				result: tail.join(' ') || undefined,
			},
		);
		set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
		deps.ctx.ui.notify(`Completed task #${task.id}`);
		return;
	}
	if (action === 'block') {
		const task = await deps.store.update_task(
			team_id,
			require_arg(id, 'task id'),
			{
				status: 'blocked',
				result: tail.join(' ') || null,
			},
		);
		set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
		deps.ctx.ui.notify(`Blocked task #${task.id}`);
		return;
	}
	if (action === 'cancel') {
		const task = await deps.store.update_task(
			team_id,
			require_arg(id, 'task id'),
			{
				status: 'cancelled',
				result: tail.join(' ') || null,
			},
		);
		set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
		deps.ctx.ui.notify(`Cancelled task #${task.id}`);
		return;
	}
	if (action === 'reopen') {
		const task = await deps.store.update_task(
			team_id,
			require_arg(id, 'task id'),
			{
				status: 'pending',
				result: null,
			},
		);
		set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
		deps.ctx.ui.notify(`Reopened task #${task.id}`);
		return;
	}
	if (action === 'assign') {
		const task = await deps.store.update_task(
			team_id,
			require_arg(id, 'task id'),
			{
				assignee: require_arg(tail[0], 'assignee'),
			},
		);
		set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
		deps.ctx.ui.notify(
			`Assigned task #${task.id} to ${task.assignee}`,
		);
		return;
	}
	if (action === 'unassign') {
		const task = await deps.store.update_task(
			team_id,
			require_arg(id, 'task id'),
			{
				assignee: null,
			},
		);
		set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
		deps.ctx.ui.notify(`Unassigned task #${task.id}`);
		return;
	}
	if (action === 'claim') {
		const assignee = require_arg(id, 'assignee');
		const task = await deps.store.claim_next_task(team_id, assignee);
		set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
		deps.ctx.ui.notify(
			task
				? `Claimed #${task.id}: ${task.title}`
				: 'No ready pending tasks',
		);
		return;
	}
	throw new Error(
		'Usage: /team task add|list|show|done|block <id> [reason]|cancel <id> [reason]|reopen <id>|assign <id> <member>|unassign <id>|claim ...',
	);
}

async function handle_task_list(
	deps: TeamCommandDeps,
	team_id: string,
): Promise<void> {
	let status = await get_team_status(
		deps.store,
		team_id,
		deps.runners,
	);
	if (has_modal_ui(deps.ctx) && status.tasks.length > 0) {
		while (true) {
			const task_id = await show_team_task_picker(deps.ctx, status);
			if (!task_id) break;
			const action = await show_team_task_action_modal(
				deps.ctx,
				status,
				deps.store.load_task(team_id, task_id),
			);
			if (action) {
				await run_task_modal_action(
					deps.ctx,
					deps.store,
					team_id,
					status,
					task_id,
					action,
				);
				set_team_ui(deps.ctx, deps.store, team_id, deps.runners);
			}
			status = await get_team_status(
				deps.store,
				team_id,
				deps.runners,
			);
		}
		return;
	}
	if (has_modal_ui(deps.ctx)) {
		await show_team_text_modal(deps.ctx, {
			title: 'Team tasks',
			subtitle: `${status.team.name} • ${format_status_counts(status)}`,
			text: format_status(status),
		});
	} else {
		deps.ctx.ui.notify(format_status(status));
	}
}
