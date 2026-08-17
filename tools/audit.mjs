#!/usr/bin/env node
/**
 * Objective metrics for the critic loop.
 *
 * Critics grade screenshots and code, but some claims are checkable by machine:
 * how much content actually exists, whether systems are wired in or orphaned,
 * and what the render cost is. This produces the numbers so a critic never has
 * to take a builder's word for "35+ weapons".
 *
 * Usage: node tools/audit.mjs [--json]
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'src');

const TEAM_DIRS = {
  core: 'Integration', render: 'Graphics', fx: 'VFX', lighting: 'Lighting',
  weather: 'Weather', world: 'World design', envart: 'Environmental art',
  weapons: 'Weapon systems', weaponmodels: 'Weapon models', anim: 'Animation',
  audio: 'Audio', ai: 'Enemy AI', tactics: 'Tactical behaviour',
  missions: 'Mission generation', player: 'Player', gear: 'Equipment',
  progression: 'Progression', ui: 'UI/UX', story: 'Story', perf: 'Performance',
};

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** Count entries in an exported array/record literal by counting top-level `id:` keys. */
function countIdEntries(source) {
  return (source.match(/^\s*(?:\{\s*)?id:\s*['"`]/gm) ?? []).length;
}

async function main() {
  const report = { generatedAt: new Date().toISOString(), teams: {}, totals: {}, wiring: {} };

  const mainSrc = await readFile(path.join(SRC, 'main.ts'), 'utf8').catch(() => '');

  for (const [dir, team] of Object.entries(TEAM_DIRS)) {
    const files = (await walk(path.join(SRC, dir))).filter((f) => f.endsWith('.ts'));
    let lines = 0;
    let bytes = 0;
    let systems = [];
    let registers = [];
    let shots = 0;
    let todos = 0;

    for (const f of files) {
      const src = await readFile(f, 'utf8');
      lines += src.split('\n').length;
      bytes += (await stat(f)).size;
      for (const m of src.matchAll(/class\s+(\w+)\s+implements\s+[^{]*\bSystem\b/g)) systems.push(m[1]);
      for (const m of src.matchAll(/services\.register\(\s*['"](\w+)['"]/g)) registers.push(m[1]);
      if (path.basename(f) === 'shots.ts') {
        shots += (src.match(/name:\s*['"`]/g) ?? []).length;
      }
      todos += (src.match(/\b(TODO|FIXME|XXX|placeholder|stub)\b/gi) ?? []).length;
    }

    report.teams[dir] = {
      team,
      files: files.length,
      lines,
      kb: Math.round(bytes / 102.4) / 10,
      systems,
      provides: [...new Set(registers)],
      shots,
      todoMarkers: todos,
      // A system that exists but is never registered in main.ts is dead code.
      wiredInMain: systems.filter((s) => mainSrc.includes(s)),
      orphanedSystems: systems.filter((s) => !mainSrc.includes(s)),
    };
  }

  // Content counts — the checkable version of "we built a lot".
  const contentTargets = [
    ['weapons', /weapons/, 'WeaponSpec'],
    ['ammo', /weapons/, 'AmmoSpec'],
    ['attachments', /weapons/, 'AttachmentSpec'],
  ];
  for (const [label, dirRe, typeName] of contentTargets) {
    const files = (await walk(SRC)).filter((f) => f.endsWith('.ts') && dirRe.test(f));
    let count = 0;
    for (const f of files) {
      const src = await readFile(f, 'utf8');
      // Typed arrays/records of the shape `: TypeName[] = [ ... ]`
      const re = new RegExp(`:\\s*(?:readonly\\s+)?${typeName}\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\n\\];`, 'g');
      for (const m of src.matchAll(re)) count += countIdEntries(m[1]);
      const re2 = new RegExp(`Record<string,\\s*${typeName}>\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`, 'g');
      for (const m of src.matchAll(re2)) count += countIdEntries(m[1]);
    }
    report.totals[label] = count;
  }

  const allFiles = (await walk(SRC)).filter((f) => f.endsWith('.ts'));
  let totalLines = 0;
  for (const f of allFiles) totalLines += (await readFile(f, 'utf8')).split('\n').length;
  report.totals.files = allFiles.length;
  report.totals.lines = totalLines;

  // Which contract services are actually satisfied anywhere.
  const provided = new Set();
  for (const t of Object.values(report.teams)) for (const p of t.provides) provided.add(p);
  const expected = ['world', 'nav', 'actors', 'weapons', 'audio', 'render', 'environment', 'missions', 'progression'];
  report.wiring.servicesProvided = [...provided].sort();
  report.wiring.servicesMissing = expected.filter((e) => !provided.has(e));

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\nBLACK MERIDIAN — build audit  ${report.generatedAt}\n`);
  console.log(`  ${String(report.totals.files).padStart(5)} TypeScript files`);
  console.log(`  ${String(report.totals.lines).padStart(5)} lines`);
  console.log(`  ${String(report.totals.weapons).padStart(5)} weapon specs`);
  console.log(`  ${String(report.totals.ammo).padStart(5)} ammo specs`);
  console.log(`  ${String(report.totals.attachments).padStart(5)} attachment specs\n`);

  const rows = Object.entries(report.teams)
    .filter(([, t]) => t.files > 0)
    .sort((a, b) => b[1].lines - a[1].lines);
  console.log('  DIR             TEAM                  FILES  LINES  SHOTS  PROVIDES            ORPHANED');
  console.log('  ' + '-'.repeat(96));
  for (const [dir, t] of rows) {
    console.log(
      '  ' +
        dir.padEnd(15) +
        t.team.padEnd(22) +
        String(t.files).padStart(5) +
        String(t.lines).padStart(7) +
        String(t.shots).padStart(7) +
        '  ' +
        (t.provides.join(',') || '-').padEnd(20) +
        (t.orphanedSystems.join(',') || '-'),
    );
  }
  console.log('');
  if (report.wiring.servicesMissing.length) {
    console.log(`  ⚠ contract services not yet implemented: ${report.wiring.servicesMissing.join(', ')}`);
  } else {
    console.log('  ✓ all contract services implemented');
  }
  const orphans = rows.flatMap(([, t]) => t.orphanedSystems);
  if (orphans.length) {
    console.log(`  ⚠ systems built but not registered in main.ts: ${orphans.join(', ')}`);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
