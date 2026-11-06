// Writes the run's problems to the job summary and as annotations, from its log (elsetest.log):
// "[00:01:05] WARN: ..." starts an entry, and the lines that follow without one belong to it.
import fs from 'node:fs';
import path from 'node:path';

const runDir = process.env.RUN_DIR;
const exitCode = process.env.EXIT_CODE;
const artifact = process.env.ARTIFACT;
const maxListed = 50;
// GitHub shows at most 10 annotations of each level per step.
const maxAnnotations = 10;

const outcomes = {
  0: 'The test ran to its end.',
  1: 'The test couldn\'t go on.',
  2: 'Your testing time ran out.',
  3: 'Problems found.',
};

function output(name, value) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function entries(log) {
  const result = [];
  log.split('\n').forEach(line => {
    const match = /^\[([\d:]+)\] ([A-Z]+): (.*)$/.exec(line);
    if (match) result.push({ time: match[1], level: match[2], lines: [ match[3] ] });
    else if (line.trim() && result.length > 0) result[result.length - 1].lines.push(line.trim());
  });
  return result;
}

const html = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const command = text => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/** The entries of a level, those with the same first line as one, with how many there were. */
function problems(all, level) {
  const byText = new Map();
  all.filter(entry => entry.level === level).forEach(entry => {
    const known = byText.get(entry.lines[0]);
    if (known) known.count += 1;
    else byText.set(entry.lines[0], { ...entry, count: 1 });
  });
  return [ ...byText.values() ];
}

function section(title, list) {
  if (list.length === 0) return '';
  const items = list.slice(0, maxListed).map(({ time, lines, count }) => {
    const details = lines.slice(1).map(line => `<br><sub>${html(line)}</sub>`).join('');
    return `<li><code>${time}</code> ${html(lines[0])}${count > 1 ? ` <i>(${count} times)</i>` : ''}${details}</li>`;
  });
  const more = list.length > maxListed ? `<li><i>and ${list.length - maxListed} more, in the log</i></li>` : '';
  return `\n<details${title === 'Errors' ? ' open' : ''}><summary><b>${title}</b> (${list.length})</summary>\n<ul>${items.join('')}${more}</ul>\n</details>\n`;
}

const logFile = runDir && path.join(runDir, 'elsetest.log');
const all = logFile && fs.existsSync(logFile) ? entries(fs.readFileSync(logFile, 'utf8')) : [];
const errors = problems(all, 'ERROR');
const warnings = problems(all, 'WARN');
const count = level => all.filter(entry => entry.level === level).length;
output('errors', count('ERROR'));
output('warnings', count('WARN'));

[ [ 'error', errors ], [ 'warning', warnings ] ].forEach(([ kind, list ]) => {
  list.slice(0, maxAnnotations).forEach(({ lines }) => {
    console.log(`::${kind} title=Elsetest::${command(lines.join('\n'))}`);
  });
});

let summary = `## Elsetest\n\n${outcomes[exitCode] ?? `Elsetest exited with code ${exitCode}.`}\n\n`;
summary += `| Errors | Warnings | Info |\n|---:|---:|---:|\n| ${count('ERROR')} | ${count('WARN')} | ${count('INFO')} |\n`;
summary += section('Errors', errors) + section('Warnings', warnings);
if (artifact) summary += `\nThe log and the video of the run are in the artifact **${html(artifact)}**.\n`;
summary += '\nHide a message in later runs with the [`ignoreLogs`](https://elsetest.com/docs/options#ignoreLogs) option.\n';
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
else console.log(summary);
