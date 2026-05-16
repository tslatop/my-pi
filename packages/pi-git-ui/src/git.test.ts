import { describe, expect, it } from 'vitest';
import { parse_diff_hunks, parse_porcelain_z } from './git.js';

describe('parse_porcelain_z', () => {
	it('classifies and sorts git status entries', () => {
		const files = parse_porcelain_z(
			[
				' M src/changed.ts',
				'?? notes.md',
				'MM src/mixed.ts',
				'A  src/staged.ts',
				'UU src/conflict.ts',
			].join('\0') + '\0',
		);

		expect(files.map((file) => [file.path, file.state])).toEqual([
			['src/conflict.ts', 'conflicted'],
			['src/changed.ts', 'changed'],
			['notes.md', 'untracked'],
			['src/mixed.ts', 'mixed'],
			['src/staged.ts', 'staged'],
		]);
	});

	it('keeps rename source and target visible', () => {
		const files = parse_porcelain_z(
			['R  new.ts', 'old.ts'].join('\0') + '\0',
		);

		expect(files).toHaveLength(1);
		expect(files[0]?.path).toBe('old.ts → new.ts');
		expect(files[0]?.state).toBe('staged');
	});
});

describe('parse_diff_hunks', () => {
	const diff = `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 const one = 1;
+const two = 2;
 const three = 3;
@@ -10,3 +11,4 @@ function run() {
 	start();
+	finish();
 }
`;

	it('extracts independently applicable hunk patches', () => {
		const hunks = parse_diff_hunks(diff, 'unstaged');

		expect(hunks).toHaveLength(2);
		expect(hunks[0]).toMatchObject({
			section: 'unstaged',
			line_index: 4,
			header: '@@ -1,3 +1,4 @@',
		});
		expect(hunks[0]?.patch).toContain(
			'diff --git a/src/app.ts b/src/app.ts',
		);
		expect(hunks[0]?.patch).toContain('+const two = 2;');
		expect(hunks[0]?.patch).not.toContain('+\tfinish();');
		expect(hunks[1]?.patch).toContain('+\tfinish();');
	});
});
