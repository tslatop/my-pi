import { describe, expect, it } from 'vitest';

describe('packages/pi-skills/src/skills-ui/skill-list.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./skill-list.js')).resolves.toBeDefined();
	});
});
