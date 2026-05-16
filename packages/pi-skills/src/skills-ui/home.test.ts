import { describe, expect, it } from 'vitest';

describe('packages/pi-skills/src/skills-ui/home.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./home.js')).resolves.toBeDefined();
	});
});
