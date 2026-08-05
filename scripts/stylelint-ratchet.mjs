#!/usr/bin/env node
/**
 * Style-drift ratchet.
 *
 * This app is NOT on the shared Xomware design tokens. It defines its own
 * $text-* scale at different values, so importing the shared file would resize
 * text app-wide, and there is no visual regression suite here to catch that.
 * See xomware-frontend/scripts/sync-tokens.mjs for the detail.
 *
 * That decision is pending. In the meantime this stops the problem GROWING:
 * count the raw font-size / letter-spacing / font-weight values that bypass
 * this app's own variables and compare against a committed baseline.
 *
 *   more than baseline -> fail. You added drift.
 *   fewer than baseline -> pass, and print the new number to commit.
 *
 * The baseline only ever goes down. It changes nothing about how the app
 * renders today - not one pixel moves.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASELINE_FILE = new URL('../.stylelint-baseline', import.meta.url);
const shouldUpdate = process.argv.includes('--update');

if (!existsSync(BASELINE_FILE) && !shouldUpdate) {
  console.error('No .stylelint-baseline found. Run: npm run lint:css:baseline');
  process.exit(1);
}

let raw = '';
try {
  raw = execFileSync(
    'npx',
    ['stylelint', 'src/**/*.scss', '--formatter', 'string'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
} catch (err) {
  // stylelint exits non-zero when it finds problems; that is the normal path
  // here. Only a missing/!crashed binary should abort.
  if (err.stdout === undefined) {
    console.error('stylelint failed to run:', err.message);
    process.exit(1);
  }
  raw = err.stdout + (err.stderr ?? '');
}

// Count only "line:col ✖ ..." rows. A bare /✖/ match would also catch the
// trailing "✖ N problems" summary line and inflate the number by one.
const count = (raw.match(/^\s*\d+:\d+\s+✖/gm) ?? []).length;

if (shouldUpdate) {
  writeFileSync(BASELINE_FILE, `${count}\n`);
  console.log(`Baseline written: ${count}`);
  process.exit(0);
}

const baseline = Number.parseInt(readFileSync(BASELINE_FILE, 'utf8').trim(), 10);

if (Number.isNaN(baseline)) {
  console.error('.stylelint-baseline is not a number');
  process.exit(1);
}

if (count > baseline) {
  console.error(raw);
  console.error(
    `\n✖ Token violations went UP: ${baseline} -> ${count} (+${count - baseline}).\n` +
      `  Use the scales in src/styles/_variables.scss ($text-*, $tracking-*, $font-weight-*).`,
  );
  process.exit(1);
}

if (count < baseline) {
  console.log(
    `✔ Violations went down: ${baseline} -> ${count}.\n` +
      `  Commit the new baseline: npm run lint:css:baseline`,
  );
  process.exit(0);
}

console.log(`✔ Token violations held at baseline (${count}).`);
