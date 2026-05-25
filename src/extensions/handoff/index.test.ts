import { describe, expect, it, vi } from 'vitest';
import handoff, {
	HANDOFF_GUIDE,
	handoff_command_output,
} from './index.js';

describe('pi-handoff command', () => {
	it('explains Pi built-ins without prompt injection', () => {
		expect(HANDOFF_GUIDE).toContain('/fork');
		expect(HANDOFF_GUIDE).toContain('/tree');
		expect(HANDOFF_GUIDE).toContain('/export');
		expect(HANDOFF_GUIDE).toContain('/import');
		expect(HANDOFF_GUIDE).toContain('/share');
	});

	it('can include a user intent note', () => {
		expect(handoff_command_output(' review this later ')).toContain(
			'Intent noted: review this later',
		);
	});

	it('registers /handoff as a help command only', async () => {
		const commands = new Map<string, any>();
		handoff({
			registerCommand(name: string, definition: any) {
				commands.set(name, definition);
			},
		} as any);

		const ctx = { ui: { notify: vi.fn() } };
		await commands.get('handoff').handler('', ctx);

		expect(ctx.ui.notify).toHaveBeenCalledWith(HANDOFF_GUIDE, 'info');
	});
});
