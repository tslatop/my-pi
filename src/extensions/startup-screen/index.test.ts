import type {
	ExtensionContext,
	Theme,
} from '@mariozechner/pi-coding-agent';
import { visibleWidth } from '@mariozechner/pi-tui';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render_startup_header } from './index.js';

const theme = {
	bold: (text: string) => text,
	fg: (_color: string, text: string) => text,
	getColorMode: () => 'truecolor',
} as Theme;

const ctx = {
	cwd: '/repos/state-of-ai-site',
	model: { id: 'gpt-5.5' },
} as ExtensionContext;

const package_version = JSON.parse(
	readFileSync('package.json', 'utf-8'),
).version as string;

describe('render_startup_header', () => {
	it('renders an ANSI truecolor pixel logo and centered subtitle', () => {
		const lines = render_startup_header(ctx, theme, 72);

		expect(lines.join('\n')).toContain('\x1b[38;2;');
		expect(lines.join('\n')).toContain('gpt-5.5 · state-of-ai-site');
		expect(lines.join('\n')).toContain(`my-pi v${package_version}`);
		expect(lines.every((line) => visibleWidth(line) <= 72)).toBe(
			true,
		);
	});

	it('uses a compact fallback for narrow terminals', () => {
		const lines = render_startup_header(ctx, theme, 12);

		expect(lines).toHaveLength(2);
		expect(lines.join('\n')).toContain('My-Pi');
		expect(lines.every((line) => visibleWidth(line) <= 12)).toBe(
			true,
		);
	});
});
