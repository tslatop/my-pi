import { describe, expect, it } from 'vitest';

describe('packages/pi-skills/src/skills-ui/github.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./github.js')).resolves.toBeDefined();
	});
});
