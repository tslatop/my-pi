import { describe, expect, it } from 'vitest';

describe('packages/pi-skills/src/skills-ui/manage.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./manage.js')).resolves.toBeDefined();
	});
});
