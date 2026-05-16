import { describe, expect, it } from 'vitest';

describe('packages/pi-skills/src/scanner.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./scanner.js')).resolves.toBeDefined();
	});
});
