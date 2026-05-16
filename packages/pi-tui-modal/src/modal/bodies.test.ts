import { describe, expect, it, vi } from 'vitest';
import { DetailedSettingsList, TextModalBody } from './bodies.js';

const modal_theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => text,
} as any;
const settings_theme = {
	cursor: '→ ',
	label: (text: string) => text,
	value: (text: string) => text,
	description: (text: string) => text,
	hint: (text: string) => text,
};

describe('modal bodies', () => {
	it('renders scrollable text and invokes cancel', () => {
		const cancel = vi.fn();
		const body = new TextModalBody(
			'one\ntwo\nthree',
			2,
			modal_theme,
			cancel,
		);

		expect(body.render(20)).toEqual(['one', 'two', '(1-2/3)']);
		body.handleInput('j');
		expect(body.render(20)).toEqual(['two', 'three', '(2-3/3)']);
		body.handleInput('q');
		expect(cancel).toHaveBeenCalledOnce();
	});

	it('renders settings, cycles values, filters, and cancels', () => {
		const on_change = vi.fn();
		const on_cancel = vi.fn();
		const body = new DetailedSettingsList(
			[
				{
					id: 'theme',
					label: 'Theme',
					currentValue: 'light',
					values: ['light', 'dark'],
					description: 'Color mode',
				},
				{
					id: 'sound',
					label: 'Sound',
					currentValue: 'off',
					values: ['off', 'on'],
				},
			],
			2,
			settings_theme,
			on_change,
			on_cancel,
			{ enable_search: true, detail: (item) => `id:${item.id}` },
		);

		const rendered = body.render(80).join('\n');
		expect(rendered).toContain('Theme');
		expect(rendered).toContain('id:theme');

		body.handleInput(' ');
		expect(on_change).toHaveBeenCalledWith('theme', 'dark');

		body.handleInput('sound');
		expect(body.get_selected_item()?.id).toBe('sound');

		body.handleInput('\u001b');
		expect(on_cancel).toHaveBeenCalledOnce();
	});
});
