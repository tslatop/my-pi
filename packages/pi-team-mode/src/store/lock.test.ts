import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { with_file_lock } from './lock.js';

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'my-pi-team-lock-'));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('with_file_lock', () => {
	it('creates an owner file while locked and removes the lock afterward', async () => {
		const lock = join(root, '.lock');
		let owner_exists = false;

		const result = await with_file_lock(lock, 'test lock', () => {
			owner_exists = existsSync(join(lock, 'owner.json'));
			return 'done';
		});

		expect(result).toBe('done');
		expect(owner_exists).toBe(true);
		expect(existsSync(lock)).toBe(false);
	});

	it('removes the lock when the callback throws', async () => {
		const lock = join(root, '.lock');

		await expect(
			with_file_lock(lock, 'test lock', () => {
				throw new Error('boom');
			}),
		).rejects.toThrow('boom');
		expect(existsSync(lock)).toBe(false);
	});
});
