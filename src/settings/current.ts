import {
	get_settings_path,
	read_settings,
	write_settings,
} from '@spences10/pi-settings';
import { existsSync } from 'node:fs';
import {
	DEFAULT_SETTINGS,
	normalize_settings,
	type MyPiSettings,
} from './schema.js';

export { get_settings_path } from '@spences10/pi-settings';

export function current_settings_exists(): boolean {
	return existsSync(get_settings_path());
}

export function read_current_settings(): MyPiSettings {
	if (!current_settings_exists()) return { ...DEFAULT_SETTINGS };
	return normalize_settings(read_settings());
}

export function write_current_settings(settings: MyPiSettings): void {
	write_settings(settings);
}

export function ensure_current_settings(): MyPiSettings {
	if (!current_settings_exists())
		write_current_settings(DEFAULT_SETTINGS);
	return read_current_settings();
}
