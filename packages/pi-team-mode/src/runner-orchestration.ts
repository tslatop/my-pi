import { format_rpc_message } from './formatting.js';
import {
	default_process_identity_verifier,
	is_pid_alive,
	verify_process_identity,
	type ProcessIdentityVerifier,
} from './process-identity.js';
import type { RpcTeammate } from './rpc-runner.js';
import {
	TeamStore,
	type TeamMember,
	type TeamMessage,
	type TeamStatus,
	type TeamTask,
} from './store.js';

export async function deliver_message_to_runner(
	store: TeamStore,
	team_id: string,
	runner: RpcTeammate,
	message: TeamMessage,
): Promise<void> {
	const injected = format_rpc_message(message);
	if (message.urgent) await runner.steer(injected);
	else await runner.follow_up(injected);
	await store.mark_messages_delivered(team_id, message.to, [
		message.id,
	]);
}

export { is_pid_alive };

async function wait_for_pid_exit(
	pid: number,
	timeout_ms: number,
	verifier: ProcessIdentityVerifier,
): Promise<boolean> {
	const deadline = Date.now() + timeout_ms;
	while (Date.now() < deadline) {
		if (!verifier.is_alive(pid)) return true;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	return !verifier.is_alive(pid);
}

function verified_orphan_pid(
	member: TeamMember,
	verifier: ProcessIdentityVerifier,
): number {
	if (!member.pid || member.pid === process.pid) {
		throw new Error(
			`No safe orphaned teammate process to control: ${member.name}`,
		);
	}
	const identity = verify_process_identity(
		member.process_identity,
		verifier,
	);
	if (!identity.ok) {
		throw new Error(
			`Refusing to control orphaned teammate ${member.name}: ${identity.reason}`,
		);
	}
	return member.pid;
}

export async function shutdown_orphaned_member(
	store: TeamStore,
	team_id: string,
	member_name: string,
	timeout_ms = 3_000,
	verifier: ProcessIdentityVerifier = default_process_identity_verifier,
): Promise<TeamMember> {
	await store.refresh_member_process_statuses(team_id);
	const member = store
		.list_members(team_id)
		.find((item) => item.name === member_name);
	if (!member) throw new Error(`Unknown teammate: ${member_name}`);
	if (member.role !== 'teammate') {
		throw new Error(
			`Refusing to terminate non-teammate member: ${member_name}`,
		);
	}
	if (!member.pid || !verifier.is_alive(member.pid)) {
		await store.refresh_member_process_statuses(team_id);
		return store
			.list_members(team_id)
			.find((item) => item.name === member_name)!;
	}
	const pid = verified_orphan_pid(member, verifier);

	verifier.kill(pid, 'SIGTERM');
	if (!(await wait_for_pid_exit(pid, timeout_ms, verifier))) {
		verifier.kill(pid, 'SIGKILL');
		await wait_for_pid_exit(pid, 1_000, verifier);
	}
	await store.refresh_member_process_statuses(team_id);
	store.append_event(team_id, 'member_orphan_shutdown', {
		member: member_name,
		pid: member.pid,
	});
	return store
		.list_members(team_id)
		.find((item) => item.name === member_name)!;
}

export async function wait_for_orphaned_member(
	store: TeamStore,
	team_id: string,
	member_name: string,
	timeout_ms: number,
	verifier: ProcessIdentityVerifier = default_process_identity_verifier,
): Promise<TeamMember> {
	await store.refresh_member_process_statuses(team_id);
	const member = store
		.list_members(team_id)
		.find((item) => item.name === member_name);
	if (!member) throw new Error(`Unknown teammate: ${member_name}`);
	if (!member.pid || !verifier.is_alive(member.pid)) {
		await store.refresh_member_process_statuses(team_id);
		return store
			.list_members(team_id)
			.find((item) => item.name === member_name)!;
	}
	const pid = verified_orphan_pid(member, verifier);
	if (!(await wait_for_pid_exit(pid, timeout_ms, verifier))) {
		throw new Error(
			`Timed out waiting for orphaned teammate ${member_name} to exit`,
		);
	}
	await store.refresh_member_process_statuses(team_id);
	return store
		.list_members(team_id)
		.find((item) => item.name === member_name)!;
}

export type TeamShutdownMode = 'all' | 'done';

export interface TeamShutdownResult {
	members: TeamMember[];
	errors: Array<{ member: string; error: string }>;
}

function has_open_assigned_task(
	member: TeamMember,
	tasks: TeamTask[],
): boolean {
	return tasks.some(
		(task) =>
			task.assignee === member.name &&
			['pending', 'in_progress', 'blocked'].includes(task.status),
	);
}

function should_shutdown_member(
	member: TeamMember,
	tasks: TeamTask[],
	mode: TeamShutdownMode,
): boolean {
	if (member.role !== 'teammate' || member.status === 'offline')
		return false;
	return mode === 'all' || !has_open_assigned_task(member, tasks);
}

export async function shutdown_team_members(
	store: TeamStore,
	team_id: string,
	runners: Map<string, RpcTeammate>,
	mode: TeamShutdownMode = 'done',
	reason = 'team shutdown requested',
	timeout_ms = 3_000,
): Promise<TeamShutdownResult> {
	const attached = attached_member_names(runners);
	const members = await store.refresh_member_process_statuses(
		team_id,
		attached,
	);
	const tasks = store.list_tasks(team_id);
	const targets = members.filter((member) =>
		should_shutdown_member(member, tasks, mode),
	);
	const stopped: TeamMember[] = [];
	const errors: TeamShutdownResult['errors'] = [];

	for (const member of targets) {
		try {
			const runner = runners.get(member.name);
			if (runner?.is_running) {
				await runner.shutdown(reason);
				runners.delete(member.name);
				stopped.push(
					await store.upsert_member(team_id, {
						name: member.name,
						status: 'offline',
					}),
				);
			} else {
				stopped.push(
					await shutdown_orphaned_member(
						store,
						team_id,
						member.name,
						timeout_ms,
					),
				);
			}
		} catch (error) {
			errors.push({
				member: member.name,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	store.append_event(team_id, 'team_members_shutdown', {
		mode,
		members: stopped.map((member) => member.name),
		errors,
	});
	return { members: stopped, errors };
}

export function attached_member_names(
	runners: Map<string, RpcTeammate>,
): ReadonlySet<string> {
	return new Set(
		[...runners]
			.filter(([, runner]) => runner.is_running)
			.map(([name]) => name),
	);
}

export async function get_team_status(
	store: TeamStore,
	team_id: string,
	runners: Map<string, RpcTeammate>,
): Promise<TeamStatus> {
	return store.get_status(team_id, attached_member_names(runners));
}

export async function get_team_statuses(
	store: TeamStore,
	runners: Map<string, RpcTeammate> = new Map(),
): Promise<TeamStatus[]> {
	const attached = attached_member_names(runners);
	return Promise.all(
		store
			.list_teams()
			.map((team) => store.get_status(team.id, attached)),
	);
}
