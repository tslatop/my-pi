import { describe, expect, it, vi } from 'vitest';
import {
	make_context,
	make_footer_data,
	test_theme,
} from '../test-utils.js';
import { render_footer_lines } from './footer-lines.js';

describe('render_footer_lines', () => {
	it('renders minimal preset as one line', () => {
		const lines = render_footer_lines(
			make_context(),
			test_theme,
			make_footer_data(),
			{
				preset: 'minimal',
				status_label_mode: 'smart',
				tone: 'muted',
			},
			100,
		);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain('claude-sonnet');
	});

	it('does not duplicate smart status labels', () => {
		const lines = render_footer_lines(
			make_context(),
			test_theme,
			make_footer_data({
				getExtensionStatuses: vi.fn(
					() =>
						new Map([
							['mcp', '\u001B[2mMCP 6/6 connected\u001B[22m'],
						]),
				),
			}),
			{
				preset: 'default',
				status_label_mode: 'smart',
				tone: 'muted',
			},
			120,
		);
		expect(lines.join('\n')).toContain('MCP 6/6 connected');
		expect(lines.join('\n')).not.toContain('mcp:MCP');
	});

	it('can force status labels', () => {
		const lines = render_footer_lines(
			make_context(),
			test_theme,
			make_footer_data({
				getExtensionStatuses: vi.fn(
					() => new Map([['mcp', 'MCP 6/6 connected']]),
				),
			}),
			{
				preset: 'default',
				status_label_mode: 'always',
				tone: 'muted',
			},
			120,
		);
		expect(lines.join('\n')).toContain('mcp:MCP 6/6 connected');
	});
});
