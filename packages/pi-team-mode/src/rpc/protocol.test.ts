import { describe, expect, it } from 'vitest';
import {
	json_line,
	next_rpc_request_id,
	normalize_member_name,
} from './protocol.js';

describe('RPC protocol helpers', () => {
	it('serializes JSON messages as newline-delimited records', () => {
		expect(json_line({ type: 'get_state' })).toBe(
			'{"type":"get_state"}\n',
		);
	});

	it('generates unique team RPC ids', () => {
		const first = next_rpc_request_id();
		const second = next_rpc_request_id();

		expect(first).toMatch(/^team-rpc-\d+$/);
		expect(second).toMatch(/^team-rpc-\d+$/);
		expect(second).not.toBe(first);
	});

	it('normalizes safe teammate names and rejects path-like names', () => {
		expect(normalize_member_name(' alice-1 ')).toBe('alice-1');
		expect(() => normalize_member_name('../alice')).toThrow(
			/member must contain/,
		);
		expect(() => normalize_member_name('.')).toThrow(
			/member must contain/,
		);
	});
});
