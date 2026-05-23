import type { ToolResultEvent } from '@earendil-works/pi-coding-agent';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { is_temp_path } from './paths.js';

function parse_shell_words(command: string): string[] {
	const words: string[] = [];
	const pattern = /"((?:\\.|[^"])*)"|'([^']*)'|(\S+)/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(command))) {
		words.push(match[1] ?? match[2] ?? match[3]);
	}
	return words;
}

export function extract_command_paths(
	command: string,
	command_name: 'rm' | 'git-rm',
): string[] | undefined {
	if (/[;&|`$()<>]/.test(command)) return undefined;
	const words = parse_shell_words(command);
	const command_index =
		command_name === 'rm'
			? words.findIndex((word) =>
					['rm', 'rmdir', 'unlink', 'shred'].includes(word),
				)
			: words.findIndex(
					(word, index) =>
						word === 'rm' && words[index - 1] === 'git',
				);
	if (command_index === -1) return undefined;

	return words
		.slice(command_index + 1)
		.filter((word) => word !== '--' && !word.startsWith('-'));
}

function option_takes_value(
	command_name: string,
	option: string,
): boolean {
	const value_options: Record<string, string[]> = {
		mkdir: ['-m', '--mode', '-Z', '--context'],
		touch: ['-r', '--reference', '-d', '--date', '-t'],
	};
	return value_options[command_name]?.includes(option) ?? false;
}

function extract_simple_create_paths(
	command: string,
	cwd: string,
): string[] {
	if (/[;&|`$()<>]/.test(command)) return [];
	const words = parse_shell_words(command);
	const command_name = words[0];
	if (!['mkdir', 'touch'].includes(command_name)) return [];

	const paths: string[] = [];
	for (let index = 1; index < words.length; index += 1) {
		const word = words[index];
		if (!word || word === '--') continue;
		if (word.startsWith('-')) {
			if (option_takes_value(command_name, word)) index += 1;
			continue;
		}

		const absolute = resolve(cwd, word);
		if (is_temp_path(absolute) && !existsSync(absolute)) {
			paths.push(absolute);
		}
	}
	return paths;
}

function extract_redirect_create_paths(
	command: string,
	cwd: string,
): string[] {
	const paths: string[] = [];
	const pattern =
		/(?:^|\s)(?:[12]>>|>>|&>|[12]?>)(?:\s*)("[^"]+"|'[^']+'|\S+)/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(command))) {
		const raw = match[1];
		const path = raw.replace(/^(['"])(.*)\1$/, '$2');
		const absolute = resolve(cwd, path);
		if (is_temp_path(absolute) && !existsSync(absolute)) {
			paths.push(absolute);
		}
	}
	return paths;
}

export function extract_bash_create_paths(
	command: string,
	cwd: string,
): string[] {
	return [
		...extract_simple_create_paths(command, cwd),
		...extract_redirect_create_paths(command, cwd),
	];
}

export function command_may_create_temp_path(
	command: string,
): boolean {
	return /^\s*mktemp\b/.test(command);
}

function text_content(event: ToolResultEvent): string {
	return event.content
		.map((part) => {
			if ('text' in part && typeof part.text === 'string') {
				return part.text;
			}
			return '';
		})
		.join('');
}

export function extract_created_temp_paths_from_result(
	event: ToolResultEvent,
): string[] {
	return text_content(event)
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && is_temp_path(line) && existsSync(line))
		.map((line) => resolve(line));
}
