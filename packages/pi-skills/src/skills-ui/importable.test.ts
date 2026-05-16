import { describe, expect, it } from 'vitest';

describe('packages/pi-skills/src/skills-ui/importable.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./importable.js')).resolves.toBeDefined();
	});
});
