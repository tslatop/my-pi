import type { TeamCommandDeps } from './types.js';

export function show_team_help({ ctx }: TeamCommandDeps): void {
	ctx.ui.notify(
		[
			'Team commands:',
			'/team create [name] — start a team for this repo',
			'/team status — show members and task progress',
			'/team dashboard — inspect members, tasks, mailboxes, transcripts, and usage',
			'/team results — collect completed task results into one summary',
			'/team spawn <member> [--worktree] [--mutating] [--branch name] [prompt] — start a teammate',
			'/team task add [member:] <title> — queue work',
			'/team task show <id> — show full task details/result',
			'/team task block|cancel <id> [reason] — mark blocked/cancelled and replace the result note',
			'/team task reopen <id> — move back to pending and clear the result note',
			'/team task assign <id> <member> / unassign <id> — change owner without changing status',
			'/team dm <member> <message> — send a mailbox message',
			'/team inbox <member> read|ack [message-id...] — mark mailbox messages read or acknowledged',
			'/team wait <member> / shutdown [--done|--all|<member>] — control teammate processes',
			'/team teams|switch|resume|detach — manage active team UI',
			'/team delete <id> / prune-stale [days] [--cwd] — remove stored stale teams',
		].join('\n'),
		'warning',
	);
}
