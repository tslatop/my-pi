import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import {
	getKeybindings,
	Key,
	matchesKey,
	truncateToWidth,
} from '@earendil-works/pi-tui';
import { show_modal } from '@spences10/pi-tui-modal';
import { watch, type FSWatcher } from 'node:fs';
import {
	collect_session_usage,
	collect_team_mailboxes,
	format_completed_task_results,
	format_status_counts,
	format_team_dashboard,
} from '../formatting.js';
import type { RpcTeammate } from '../rpc-runner.js';
import { get_team_status } from '../runner-orchestration.js';
import type { TeamStatus, TeamStore } from '../store.js';
import { has_modal_ui } from '../ui-status.js';

export async function show_team_dashboard_modal(
	ctx: ExtensionCommandContext,
	store: TeamStore,
	status: TeamStatus,
	runners: Map<string, RpcTeammate> = new Map(),
): Promise<'close' | 'results'> {
	let current_status = status;
	const dashboard_lines = () =>
		format_team_dashboard(current_status, {
			team_dir: store.team_dir(current_status.team.id),
			mailboxes: collect_team_mailboxes(store, current_status),
			session_usage: collect_session_usage(current_status.members),
		}).split('\n');

	return await show_modal<'close' | 'results'>(
		ctx,
		{
			title: 'Team dashboard',
			subtitle: () =>
				`${current_status.team.name} • ${format_status_counts(current_status)}`,
			footer:
				'live refresh • ↑↓ scroll • enter/s results • q/esc close',
			overlay_options: { width: '90%', minWidth: 72 },
		},
		({ done }, theme, layout, tui) => {
			let offset = 0;
			let max_offset = 0;
			let disposed = false;
			let refreshing = false;
			let refresh_queued = false;
			const refresh = async () => {
				if (disposed) return;
				if (refreshing) {
					refresh_queued = true;
					return;
				}
				refreshing = true;
				try {
					current_status = await get_team_status(
						store,
						current_status.team.id,
						runners,
					);
					tui.requestRender();
				} catch {
					// Keep showing the last known dashboard snapshot.
				} finally {
					refreshing = false;
					if (refresh_queued) {
						refresh_queued = false;
						void refresh();
					}
				}
			};
			let watcher: FSWatcher | undefined;
			try {
				watcher = watch(
					store.events_path(current_status.team.id),
					{ persistent: false },
					() => void refresh(),
				);
			} catch {
				// If watching is unavailable, the dashboard still renders the
				// snapshot captured when it opened.
			}

			return {
				render: (width: number) => {
					const rendered = dashboard_lines().map((line) => {
						const styled = /^[A-Z][^:]+$/.test(line)
							? theme.fg('accent', theme.bold(line))
							: line;
						return truncateToWidth(styled, width);
					});
					const budget = Math.max(
						1,
						layout.get_max_body_lines(width),
					);
					const visible_count =
						rendered.length > budget
							? Math.max(1, budget - 1)
							: budget;
					max_offset = Math.max(0, rendered.length - visible_count);
					offset = Math.max(0, Math.min(offset, max_offset));
					const end = Math.min(
						offset + visible_count,
						rendered.length,
					);
					const visible = rendered.slice(offset, end);
					if (rendered.length > visible_count) {
						visible.push(
							theme.fg(
								'dim',
								truncateToWidth(
									`(${offset + 1}-${end}/${rendered.length})`,
									width,
								),
							),
						);
					}
					return visible;
				},
				invalidate: () => undefined,
				dispose: () => {
					disposed = true;
					watcher?.close();
				},
				handleInput: (data: string) => {
					const keybindings = getKeybindings();
					if (
						keybindings.matches(data, 'tui.select.up') ||
						data === 'k'
					) {
						offset = Math.max(0, offset - 1);
					} else if (
						keybindings.matches(data, 'tui.select.down') ||
						data === 'j'
					) {
						offset = Math.min(max_offset, offset + 1);
					} else if (matchesKey(data, Key.home)) {
						offset = 0;
					} else if (matchesKey(data, Key.end)) {
						offset = max_offset;
					} else if (matchesKey(data, Key.enter) || data === 's') {
						done('results');
					} else if (matchesKey(data, Key.escape) || data === 'q') {
						done('close');
					}
				},
			};
		},
	);
}

export function present_completed_task_results(
	ctx: ExtensionCommandContext,
	status: TeamStatus,
): void {
	const text = format_completed_task_results(status);
	if (
		has_modal_ui(ctx) &&
		typeof ctx.ui.setEditorText === 'function'
	) {
		ctx.ui.setEditorText(text);
		ctx.ui.notify('Inserted completed team results into the editor.');
		return;
	}
	ctx.ui.notify(text);
}
