import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type {
	RawMcpConfigFile,
	StoredMcpConfigFile,
} from './types.js';

export function read_config_file(path: string): StoredMcpConfigFile {
	if (!existsSync(path)) return { mcpServers: {} };
	const raw = readFileSync(path, 'utf-8');
	const config = JSON.parse(raw) as Partial<StoredMcpConfigFile>;
	return {
		...config,
		mcpServers: config.mcpServers || {},
	};
}

export function write_config_file(
	path: string,
	config: StoredMcpConfigFile,
): void {
	mkdirSync(dirname(path), { recursive: true });
	const tmp_path = join(dirname(path), `.${Date.now()}.tmp`);
	writeFileSync(
		tmp_path,
		`${JSON.stringify(config, null, 2)}\n`,
		'utf-8',
	);
	renameSync(tmp_path, path);
}

export function read_config(
	path: string,
): RawMcpConfigFile['mcpServers'] {
	return read_config_file(path).mcpServers;
}
