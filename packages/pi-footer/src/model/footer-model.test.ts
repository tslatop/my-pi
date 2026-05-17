import { describe, expect, it, vi } from 'vitest';
import {
	make_context,
	make_footer_data,
	test_theme,
} from '../test-utils.js';
import { build_footer_model } from './footer-model.js';

describe('build_footer_model', () => {
	it('builds path, stats, model, and status data', () => {
		const ctx = make_context({
			sessionManager: {
				getEntries: vi.fn(() => [
					{
						type: 'message',
						message: {
							role: 'assistant',
							usage: {
								input: 1200,
								output: 3400,
								cacheRead: 500,
								cacheWrite: 100,
								cost: { total: 0.1234 },
							},
						},
					},
				]),
				getSessionName: vi.fn(() => 'named'),
			},
		});
		const footer_data = make_footer_data({
			getExtensionStatuses: vi.fn(
				() =>
					new Map([
						['preset', 'prompt:terse'],
						['mcp', 'MCP 6/6 connected'],
					]),
			),
		});

		const model = build_footer_model(ctx, footer_data, test_theme);

		expect(model.pwd).toBe('~/repos/my-pi (main) • named');
		expect(model.stats_parts).toEqual(
			expect.arrayContaining([
				'↑1.2k',
				'↓3.4k',
				'R500',
				'W100',
				'$0.123',
			]),
		);
		expect(model.model_text).toContain('claude-sonnet');
		expect(model.preset_status).toBe('prompt:terse');
		expect(model.statuses.get('mcp')).toBe('MCP 6/6 connected');
		expect(model.statuses.has('preset')).toBe(false);
	});
});
