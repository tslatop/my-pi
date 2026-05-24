import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { format_status, format_task_detail } from '../formatting.js';
import type { RpcTeammate } from '../rpc-runner.js';
import { get_team_status } from '../runner-orchestration.js';
import type { TeamStore } from '../store.js';
import type { TeamToolParams } from '../team-tool-params.js';
import { set_team_ui } from '../ui-status.js';

export function require_arg(
	value: string | undefined,
	name: string,
): string {
	const trimmed = value?.trim();
	if (!trimmed) throw new Error(`${name} is required`);
	return trimmed;
}

interface TaskActionContext {
	ctx: ExtensionContext;
	store: TeamStore;
	runners: Map<string, RpcTeammate>;
	team_id: string | undefined;
	require_team_id: () => string;
}

export async function execute_task_action(
	params: TeamToolParams,
	context: TaskActionContext,
) {
	const { ctx, store, runners, team_id, require_team_id } = context;
	switch (params.action) {
		case 'task_create': {
			const task = await store.create_task(require_team_id(), {
				title: require_arg(params.title, 'title'),
				description: params.description,
				assignee: params.assignee,
				depends_on: params.depends_on,
			});
			set_team_ui(ctx, store, team_id, runners);
			return {
				content: [
					{
						type: 'text' as const,
						text: `Created task #${task.id}: ${task.title}`,
					},
				],
				details: { task },
			};
		}
		case 'task_list': {
			const tasks = store.list_tasks(require_team_id());
			return {
				content: [
					{
						type: 'text' as const,
						text: format_status(
							await get_team_status(
								store,
								require_team_id(),
								runners,
							),
						),
					},
				],
				details: { tasks },
			};
		}
		case 'task_get': {
			const task = store.load_task(
				require_team_id(),
				require_arg(params.task_id, 'task_id'),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: format_task_detail(task),
					},
				],
				details: { task },
			};
		}
		case 'task_update': {
			const task = await store.update_task(
				require_team_id(),
				require_arg(params.task_id, 'task_id'),
				{
					title: params.title,
					description: params.description,
					status: params.task_status,
					assignee: params.clear_assignee ? null : params.assignee,
					depends_on: params.depends_on,
					result: params.clear_result ? null : params.result,
				},
			);
			set_team_ui(ctx, store, team_id, runners);
			return {
				content: [
					{
						type: 'text' as const,
						text: `Updated task #${task.id}`,
					},
				],
				details: { task },
			};
		}
		case 'task_claim_next': {
			const task = await store.claim_next_task(
				require_team_id(),
				require_arg(params.assignee ?? params.member, 'assignee'),
			);
			set_team_ui(ctx, store, team_id, runners);
			return {
				content: [
					{
						type: 'text' as const,
						text: task
							? `Claimed task #${task.id}: ${task.title}`
							: 'No ready pending tasks',
					},
				],
				details: { task },
			};
		}
	}
	throw new Error(`Unsupported task action: ${params.action}`);
}
