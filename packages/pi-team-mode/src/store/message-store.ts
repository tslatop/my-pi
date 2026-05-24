import { join } from 'node:path';
import {
	delay,
	now,
	random_suffix,
	require_member_name,
	safe_segment,
	write_json,
} from '../store-utils.js';
import type { SendMessageInput, TeamMessage } from './types.js';

export interface MessageStoreContext {
	with_team_lock<T>(
		team_id: string,
		fn: () => T | Promise<T>,
	): Promise<T>;
	load_team(team_id: string): unknown;
	mailbox_dir(team_id: string, member: string): string;
	list_messages(team_id: string, member: string): TeamMessage[];
	touch_team_unlocked(team_id: string): void;
	append_event(team_id: string, type: string, data: unknown): unknown;
}

export async function send_message(
	store: MessageStoreContext,
	team_id: string,
	input: SendMessageInput,
): Promise<TeamMessage> {
	return store.with_team_lock(team_id, () => {
		if (!input.body.trim())
			throw new Error('Message body is required');
		store.load_team(team_id);
		const timestamp = now();
		const from = require_member_name(input.from, 'from');
		const to = require_member_name(input.to, 'to');
		const message: TeamMessage = {
			id: `${Date.now().toString(36)}-${random_suffix()}`,
			from,
			to,
			body: input.body.trim(),
			urgent: input.urgent ?? false,
			created_at: timestamp,
		};
		if (input.reply_to?.trim()) {
			const reply_to = input.reply_to.trim();
			if (safe_segment(reply_to) !== reply_to) {
				throw new Error(`Invalid reply_to message id: ${reply_to}`);
			}
			message.reply_to = reply_to;
		}
		if (input.ttl_ms && input.ttl_ms > 0) {
			message.expires_at = new Date(
				Date.parse(timestamp) + input.ttl_ms,
			).toISOString();
		}
		if (input.requires_ack !== undefined) {
			message.requires_ack = input.requires_ack;
		}
		write_json(
			join(store.mailbox_dir(team_id, to), `${message.id}.json`),
			message,
		);
		store.touch_team_unlocked(team_id);
		store.append_event(team_id, 'message_sent', { message });
		return message;
	});
}

export async function wait_for_message(
	store: MessageStoreContext,
	team_id: string,
	member: string,
	options: {
		reply_to?: string;
		from?: string;
		timeout_ms?: number;
		include_read?: boolean;
	} = {},
): Promise<TeamMessage | undefined> {
	const normalized_member = require_member_name(member);
	const from = options.from
		? require_member_name(options.from, 'from')
		: undefined;
	const reply_to = options.reply_to?.trim();
	if (reply_to && safe_segment(reply_to) !== reply_to) {
		throw new Error(`Invalid reply_to message id: ${reply_to}`);
	}
	const timeout_ms = Math.max(0, options.timeout_ms ?? 30_000);
	const deadline = Date.now() + timeout_ms;
	for (;;) {
		const timestamp = Date.now();
		const message = store
			.list_messages(team_id, normalized_member)
			.find((item) => {
				if (!options.include_read && item.read_at) return false;
				if (reply_to && item.reply_to !== reply_to) return false;
				if (from && item.from !== from) return false;
				if (
					item.expires_at &&
					Date.parse(item.expires_at) <= timestamp
				) {
					return false;
				}
				return true;
			});
		if (message) return message;
		if (timestamp >= deadline) return undefined;
		await delay(Math.min(250, deadline - timestamp));
	}
}

export async function update_messages(
	store: MessageStoreContext,
	team_id: string,
	member: string,
	message_ids: string[] | undefined,
	update: (message: TeamMessage, timestamp: string) => void,
): Promise<TeamMessage[]> {
	return store.with_team_lock(team_id, () => {
		const normalized_member = require_member_name(member);
		const id_filter = message_ids
			? new Set(message_ids.map((id) => safe_segment(id)))
			: undefined;
		const messages = store.list_messages(team_id, normalized_member);
		const timestamp = now();
		const changed: TeamMessage[] = [];
		for (const message of messages) {
			if (id_filter && !id_filter.has(message.id)) continue;
			const before = JSON.stringify(message);
			update(message, timestamp);
			if (JSON.stringify(message) === before) continue;
			write_json(
				join(
					store.mailbox_dir(team_id, normalized_member),
					`${message.id}.json`,
				),
				message,
			);
			changed.push(message);
		}
		if (changed.length > 0) {
			store.append_event(team_id, 'messages_updated', {
				member: normalized_member,
				messages: changed,
			});
		}
		return messages;
	});
}
