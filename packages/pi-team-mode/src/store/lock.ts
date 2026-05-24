import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
	delay,
	is_pid_alive,
	now,
	read_json,
	write_json,
} from '../store-utils.js';

const LOCK_STALE_AFTER_MS = 30_000;

interface TeamLockInfo {
	pid: number;
	created_at: string;
}

function read_lock_info(lock: string): TeamLockInfo | undefined {
	try {
		return read_json<TeamLockInfo>(join(lock, 'owner.json'));
	} catch {
		return undefined;
	}
}

function is_lock_stale(lock: string): boolean {
	const info = read_lock_info(lock);
	if (info?.pid) return !is_pid_alive(info.pid);
	try {
		return Date.now() - statSync(lock).mtimeMs > LOCK_STALE_AFTER_MS;
	} catch {
		return false;
	}
}

export async function with_file_lock<T>(
	lock: string,
	label: string,
	fn: () => T | Promise<T>,
): Promise<T> {
	let acquired = false;
	for (let attempt = 0; attempt < 250; attempt += 1) {
		try {
			mkdirSync(lock, { mode: 0o700 });
			write_json(join(lock, 'owner.json'), {
				pid: process.pid,
				created_at: now(),
			});
			acquired = true;
			break;
		} catch (error) {
			if (
				!error ||
				typeof error !== 'object' ||
				!('code' in error) ||
				error.code !== 'EEXIST'
			) {
				throw error;
			}
			if (is_lock_stale(lock)) {
				rmSync(lock, { recursive: true, force: true });
				continue;
			}
			await delay(10);
		}
	}
	if (!acquired) throw new Error(`Timed out locking ${label}`);
	try {
		return await fn();
	} finally {
		rmSync(lock, { recursive: true, force: true });
	}
}
