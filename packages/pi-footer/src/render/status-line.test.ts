import { describe, expect, it } from 'vitest';
import { test_theme } from '../test-utils.js';
import { render_footer_status_line } from './status-line.js';

describe('render_footer_status_line', () => {
	it('renders left-only status using the selected tone', () => {
		expect(
			render_footer_status_line(
				test_theme,
				80,
				['MCP 6/6 connected'],
				undefined,
				'bright',
			),
		).toContain('<accent>MCP 6/6 connected</accent>');
	});

	it('aligns right-only status to the right', () => {
		const line = render_footer_status_line(
			test_theme,
			30,
			[],
			'prompt:terse',
		);
		expect(line).toContain('prompt:terse');
		expect(line?.startsWith(' ')).toBe(true);
	});

	it('returns undefined when no status text exists', () => {
		expect(
			render_footer_status_line(test_theme, 30, []),
		).toBeUndefined();
	});
});
