import { describe, expect, it } from 'vitest';

describe('packages/pi-skills/src/skills-ui.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./skills-ui.js')).resolves.toBeDefined();
	});
});
