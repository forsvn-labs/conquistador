"""Installed-package terminal E2E. Run with an installed CLI path and Node 26 PATH.

Example: CONQUISTADOR_E2E_WRONG_NODE=/path/to/node20 CONQUISTADOR_E2E_NODE24=/path/to/node24 \\
    python3 tools/node-onboarding.e2e.py dist/node-onboarding-e2e/prefix/node_modules/.bin/conquistador dist/node-onboarding-e2e
Writes transcript and JSON evidence under the supplied output directory (not committed).
"""
import fcntl
import json
import os
import pty
import re
import select
import signal
import time
import shutil
import struct
import subprocess
import sys
import termios
from pathlib import Path

cli = str(Path(sys.argv[1]).resolve())
root = Path(sys.argv[2]).resolve()
wrong_node = os.environ.get('CONQUISTADOR_E2E_WRONG_NODE')
right_node = os.environ.get('CONQUISTADOR_E2E_NODE24')
if not wrong_node or not right_node:
    sys.exit('Set CONQUISTADOR_E2E_WRONG_NODE (below 22.18) and CONQUISTADOR_E2E_NODE24 (Node 24) to absolute executables.')
wrong_node, right_node = str(Path(wrong_node).resolve()), str(Path(right_node).resolve())
wrong, right = str(Path(wrong_node).parent), str(Path(right_node).parent)
def below_floor(version):
    major, minor = (int(part) for part in version.decode().lstrip('v').split('.')[:2])
    return major < 22 or (major == 22 and minor < 18)
if not below_floor(subprocess.check_output([wrong_node, '-v'])) or not subprocess.check_output([right_node, '-v']).startswith(b'v24'):
    sys.exit('Expected a Node below 22.18 and a Node 24 executable, respectively.')
if wrong in ('/opt/homebrew/bin', '/usr/local/bin'):
    sys.exit('Use an isolated old-Node bin directory, not Homebrew bin, to exercise the no-candidate path.')
for name in ['neutral', 'project', 'other', 'empty-home', 'adoption', 'files-only', 'fresh-failure', 'fresh-optional-cancel', 'optional-failure', 'term-apply', 'reset-rollback', 'multi-host']:
    shutil.rmtree(root / name, ignore_errors=True)
    (root / name).mkdir(parents=True)
env = {**os.environ, 'PATH': wrong + ':/usr/bin:/bin', 'CLAUDECODE': '1'}
for signal_name in ['BB_THREAD_ID', 'BB_PROJECT_ID', 'BB_ENVIRONMENT_ID', 'CLAUDE_CODE',
                    'CURSOR_TRACE_ID', 'CURSOR_AGENT', 'COPILOT_CLI', 'GITHUB_COPILOT',
                    'CODEX_THREAD_ID', 'CODEX_SANDBOX']:
    env.pop(signal_name, None)
records = []


def clean(data):
    return re.sub(r'\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07]*\x07)', '', data.decode('utf8', 'replace')).replace('\r', '')


def terminal(name, cwd, steps, environment=env, args=(), command=(cli,)):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 120, 0, 0))
    process = subprocess.Popen([*command, *args], cwd=cwd, env=environment, stdin=slave, stdout=slave, stderr=slave)
    os.close(slave)
    transcript = b''
    for phrase, keys in steps:
        section = b''
        for _ in range(200):
            ready, _, _ = select.select([master], [], [], .1)
            if ready:
                try:
                    section += os.read(master, 65536)
                except OSError:
                    break
            if phrase in section:
                break
        transcript += section
        assert phrase in section, (name, phrase, clean(section[-1500:]))
        os.write(master, keys)
    for _ in range(400):
        ready, _, _ = select.select([master], [], [], .1)
        if ready:
            try:
                transcript += os.read(master, 65536)
            except OSError:
                break
        if process.poll() is not None:
            break
    assert process.poll() is not None, (name, clean(transcript[-1500:]))
    os.close(master)
    text = clean(transcript)
    (root / (name + '.terminal.txt')).write_text(text)
    records.append({'scenario': name, 'exit': process.returncode, 'transcript': name + '.terminal.txt'})
    return process.returncode, text


project = root / 'project'
neutral = root / 'neutral'
code, text = terminal('wrong-continue-first-install', neutral, [
    (b'How do you want to continue', b'\r'),
    (b'Where should Conquistador', b'\x1b[B\r'),
    (b'Absolute or relative', b'../project\r'),
    (b'Set up Conquistador', b'\r'),
])
assert code == 0 and (project / '.conquistador/SKILL.md').is_file() and 'Local files verified' in text
receipt = (project / '.conquistador/.conquistador-install.json').read_bytes()
code, text = terminal('wrong-cancel', neutral, [(b'How do you want to continue', b'\x03')])
assert code == 130 and 'Cancelled' in text
code, text = terminal('no-node24', neutral, [(b'How do you want to proceed', b'\r')], {
    **env, 'HOME': str(root / 'empty-home'), 'PATH': wrong + ':/usr/bin:/bin',
})
assert code == 1 and 'Node setup' in text and 'nvm install 24' not in text
code, text = terminal('repeat-existing', project, [
    (b'How do you want to continue', b'\r'),
    (b'Where should Conquistador', b'\r'),
    (b'What do you want to do first', b'\r'),
])
assert code == 0 and 'Local files verified' in text and (project / '.conquistador/.conquistador-install.json').read_bytes() == receipt
personal = project / 'personal-notes.txt'
personal.write_text('outside Conquistador')
operator_skill = project / '.conquistador/SKILL.md'
operator_skill.write_text(operator_skill.read_text() + '\nlocal operator edit\n')
native_skill = project / '.claude/skills/conquistador/SKILL.md'
native_skill.write_text(native_skill.read_text() + '\nlocal native edit\n')
local_extra = project / '.conquistador/private-note.txt'
local_extra.write_text('preserve this additional file')
code, text = terminal('modified-cancel', project, [
    (b'Where should Conquistador', b'\r'),
    (b'How do you want to continue with', b'\x03'),
], {**env, 'PATH': right + ':/usr/bin:/bin'})
assert code == 130 and 'local operator edit' in operator_skill.read_text()
assert not list(project.glob('.conquistador-backup-*'))
code, text = terminal('modified-reset', project, [
    (b'Where should Conquistador', b'\r'),
    (b'How do you want to continue with', b'\x1b[B\r'),
    (b'Back up these Conquistador files', b'y\r'),
    (b'What do you want to do first', b'\r'),
], {**env, 'PATH': right + ':/usr/bin:/bin'})
backups = sorted(project.glob('.conquistador-backup-*'))
assert code == 0 and len(backups) == 1 and 'Local files verified' in text, (code, text)
assert 'local operator edit' in (backups[0] / '.conquistador/SKILL.md').read_text()
assert 'local native edit' in (backups[0] / '.claude/skills/conquistador/SKILL.md').read_text()
assert (backups[0] / '.conquistador/private-note.txt').read_text() == 'preserve this additional file'
assert personal.read_text() == 'outside Conquistador'
assert 'local operator edit' not in operator_skill.read_text()
operator_skill.write_text(operator_skill.read_text() + '\nsecond local edit\n')
code, text = terminal('modified-reset-again', project, [
    (b'Where should Conquistador', b'\r'),
    (b'How do you want to continue with', b'\x1b[B\r'),
    (b'Back up these Conquistador files', b'y\r'),
    (b'What do you want to do first', b'\r'),
], {**env, 'PATH': right + ':/usr/bin:/bin'})
backups = sorted(project.glob('.conquistador-backup-*'))
assert code == 0 and len(backups) == 2 and 'Local files verified' in text, (code, text)
assert any('second local edit' in (backup / '.conquistador/SKILL.md').read_text() for backup in backups)
assert personal.read_text() == 'outside Conquistador'
receipt = (project / '.conquistador/.conquistador-install.json').read_bytes()

# A failed manifest write must restore every moved operator and native path.
rollback = root / 'reset-rollback'
rollback.mkdir(exist_ok=True)
for relative, content in [('.conquistador/SKILL.md', 'operator original'),
                          ('.claude/skills/conquistador/SKILL.md', 'native original')]:
    target = rollback / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
module = Path(cli).resolve().parents[2] / 'tools/onboarding-recovery.mjs'
plan = {'project': str(rollback), 'backup': str(rollback / '.conquistador-backup-failure'),
        'paths': [str(rollback / '.conquistador'), str(rollback / '.claude/skills/conquistador')],
        'hosts': ['claude-code'], 'version': '0.3.0'}
plan['identities'] = [{'path': path, 'dev': os.lstat(path).st_dev, 'ino': os.lstat(path).st_ino}
                      for path in plan['paths']]
script = (f'import {{ preserveForReset }} from {json.dumps(module.as_uri())}; '
          f'const plan = {json.dumps(plan)}; '
          'try { preserveForReset(plan, { writeManifest() { throw Error("manifest write failed"); } }); '
          'process.exitCode = 2; } catch (error) { '
          'if (!error.message.includes("manifest write failed")) throw error; '
          'console.log("Original paths restored after manifest failure"); }')
failed = subprocess.run([right_node, '--input-type=module', '-e', script], cwd=rollback,
                        env={**env, 'PATH': right + ':/usr/bin:/bin'}, text=True, capture_output=True)
assert failed.returncode == 0, (failed.stdout, failed.stderr)
assert (rollback / '.conquistador/SKILL.md').read_text() == 'operator original'
assert (rollback / '.claude/skills/conquistador/SKILL.md').read_text() == 'native original'
assert not (rollback / '.conquistador-backup-failure').exists()
(root / 'manifest-failure.terminal.txt').write_text(failed.stdout + failed.stderr)
records.append({'scenario': 'manifest-failure-rollback', 'exit': failed.returncode,
                'transcript': 'manifest-failure.terminal.txt'})
code, text = terminal('right-node-existing', project, [
    (b'Where should Conquistador', b'\r'),
    (b'What do you want to do first', b'\r'),
], {**env, 'PATH': right + ':/usr/bin:/bin'})
assert code == 0 and 'Local files verified' in text
code, text = terminal('repeat-optional-mcp', project, [
    (b'How do you want to continue', b'\r'),
    (b'Where should Conquistador', b'\r'),
    (b'What do you want to do first', b'\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\r'),
    (b'Optional integrations', b'\x1b[B\x1b[B\x1b[B\r'),
    (b'Which MCP client', b'\x1b[B\x1b[B\x1b[B\x1b[B\r'),
    (b'Prepare a local MCP', b'\r'),
    (b'What do you want to do first', b'\r'),
])
assert code == 0 and (project / '.conquistador-mcp/connector.json').is_file() and 'Client registration is still required' in text
assert (project / '.conquistador/.conquistador-install.json').read_bytes() == receipt

multi = root / 'multi-host'
multi_hosts = ['codex', 'cursor', 'claude-code', 'copilot']
installed = subprocess.run([cli, 'operator', 'install', '--project', str(multi), '--hosts', ','.join(multi_hosts)],
                           cwd=multi, env={**env, 'PATH': right + ':/usr/bin:/bin'}, text=True, capture_output=True)
assert installed.returncode == 0, (installed.stdout, installed.stderr)
for native_path in ['.agents/skills/conquistador', '.cursor/skills/conquistador']:
    skill = multi / native_path / 'SKILL.md'
    skill.write_text(skill.read_text() + '\nlocal native edit\n')
code, text = terminal('multi-host-reset', multi, [
    (b'Where should Conquistador', b'\r'),
    (b'How do you want to continue with', b'\x1b[B\r'),
    (b'Back up these Conquistador files', b'y\r'),
    (b'What do you want to do first', b'\r'),
], {**env, 'PATH': right + ':/usr/bin:/bin'})
multi_backups = list(multi.glob('.conquistador-backup-*'))
assert code == 0 and len(multi_backups) == 1, (code, text)
for native_path in ['.agents/skills/conquistador', '.cursor/skills/conquistador']:
    assert 'local native edit' in (multi_backups[0] / native_path / 'SKILL.md').read_text()
    assert 'local native edit' not in (multi / native_path / 'SKILL.md').read_text()
record = json.loads((multi / '.conquistador/project-installation.json').read_text())
assert record['hosts'] == multi_hosts, record

code, text = terminal('returning-optional-interrupt', project, [
    (b'How do you want to continue', b'\r'),
    (b'Where should Conquistador', b'\r'),
    (b'What do you want to do first', b'\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\r'),
    (b'Optional integrations', b'\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\r'),
    (b'What would you like to set up', b'\x03'),
])
assert code == 130 and text.count('◆  What do you want to do first') == 1, (code, text)
assert (project / '.conquistador/.conquistador-install.json').read_bytes() == receipt

adoption = root / 'adoption'
adoption.mkdir(exist_ok=True)
right_env = {**env, 'PATH': right + ':/usr/bin:/bin'}
for args in [
    ['--host', 'bb', '--yes'],
    ['setup', 'install', '--target', 'claude-code', '--project', str(adoption)],
]:
    result = subprocess.run([cli, *args], cwd=adoption, env=right_env, text=True, capture_output=True)
    assert result.returncode == 0, (args, result.stdout, result.stderr)
native = adoption / '.claude/skills/conquistador'
before = (native / 'SKILL.md').read_bytes()
code, text = terminal('returning-host-decline-adoption', adoption, [
    (b'Add this host', b'n\r'),
    (b'What do you want to do first', b'\r'),
], right_env, ['--host', 'claude-code'])
plan = ''.join(line.strip(' │') for line in text.splitlines())
assert code == 0 and str(native) in plan and 'operatoruninstallwillremoveittoo' in ''.join(plan.split()), text
assert (native / 'SKILL.md').read_bytes() == before
assert json.loads((adoption / '.conquistador/project-installation.json').read_text())['hosts'] == ['bb']
code, text = terminal('returning-host-adopt', adoption, [
    (b'Add this host', b'y\r'),
    (b'What do you want to do first', b'\r'),
], right_env, ['--host', 'claude-code'])
plan = ''.join(line.strip(' │') for line in text.splitlines())
assert code == 0 and str(native) in plan and 'operatoruninstallwillremoveittoo' in ''.join(plan.split()), text
record = json.loads((adoption / '.conquistador/project-installation.json').read_text())
assert record['hosts'] == ['bb', 'claude-code'] and record['skills'][0]['adopted'] is True, record
result = subprocess.run([cli, 'uninstall'], cwd=adoption, env=right_env, text=True, capture_output=True)
assert result.returncode == 0 and not native.exists(), (result.stdout, result.stderr)

files_only = root / 'files-only'
result = subprocess.run([cli, '--host', 'none', '--yes'], cwd=files_only, env=right_env, text=True, capture_output=True)
assert result.returncode == 0, result.stderr
code, text = terminal('files-only-add-first-host', files_only, [
    (b'Add this host', b'y\r'),
    (b'What do you want to do first', b'\r'),
], right_env, ['--host', 'claude-code'])
assert code == 0 and (files_only / '.claude/skills/conquistador/SKILL.md').is_file(), (code, text)
assert json.loads((files_only / '.conquistador/project-installation.json').read_text())['hosts'] == ['claude-code']
receipt = (files_only / '.conquistador/.conquistador-install.json').read_bytes()
code, text = terminal('native-host-none-preserved', files_only, [
    (b'What do you want to do first', b'\r'),
], right_env, ['--host', 'none'])
assert code == 0 and (files_only / '.conquistador/.conquistador-install.json').read_bytes() == receipt

no_npx = {**env, 'PATH': '/usr/bin:/bin'}
optional_failure = root / 'optional-failure'
result = subprocess.run([cli, '--host', 'none', '--yes'], cwd=optional_failure, env=right_env, text=True, capture_output=True)
assert result.returncode == 0, result.stderr
code, text = terminal('returning-optional-failure', optional_failure, [
    (b'Where should Conquistador', b'\r'),
    (b'What do you want to do first', b'\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\r'),
    (b'Optional integrations', b'\x1b[B\r'),
    (b'Which host should skills.sh', b'\r'),
    (b'Install the compact', b'\r'),
], no_npx, command=(right_node, cli))
assert code == 1 and 'The skills manager step did not complete' in text and text.count('◆  What do you want to do first') == 1, (code, text)

fresh = root / 'fresh-failure'
code, text = terminal('fresh-optional-interrupt', neutral, [
    (b'Where should Conquistador', b'\x1b[B\r'),
    (b'Absolute or relative', b'../fresh-failure\r'),
    (b'Set up Conquistador', b'\x1b[B\x1b[B\x1b[B\x1b[B\r'),
    (b'Optional integrations', b'\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\r'),
    (b'Set up Conquistador', b'\r'),
    (b'What would you like to set up', b'\x03'),
], right_env)
assert code == 130 and (fresh / '.conquistador/SKILL.md').is_file() and 'Conquistador files are ready.' not in text, (code, text)

cancel_project = root / 'fresh-optional-cancel'
code, text = terminal('fresh-optional-prompt-cancel', neutral, [
    (b'Where should Conquistador', b'\x1b[B\r'),
    (b'Absolute or relative', b'../fresh-optional-cancel\r'),
    (b'Set up Conquistador', b'\x1b[B\x1b[B\x1b[B\x1b[B\r'),
    (b'Optional integrations', b'\x1b[B\r'),
    (b'Set up Conquistador', b'\r'),
    (b'Which host should skills.sh', b'\x03'),
], right_env)
assert code == 130 and (cancel_project / '.conquistador/SKILL.md').is_file(), (code, text)
assert 'remains installed and owned' in text and 'No files changed' not in text, text

# Terminate the launched PID while its verified Node 24 child is waiting for a project.
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 120, 0, 0))
outer = subprocess.Popen([cli], cwd=neutral, env=env, stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
os.close(slave)
child_pid = None
try:
    output = b''
    for phrase, keys in [(b'How do you want to continue', b'\r'), (b'Where should Conquistador', None)]:
        for _ in range(200):
            ready, _, _ = select.select([master], [], [], .1)
            if ready:
                output += os.read(master, 65536)
            if phrase in output:
                break
        assert phrase in output, clean(output)
        if keys:
            os.write(master, keys)
    children = subprocess.check_output(['pgrep', '-P', str(outer.pid)], text=True).split()
    assert len(children) == 1, children
    child_pid = int(children[0])
    os.kill(outer.pid, signal.SIGTERM)
    outer.wait(timeout=10)
    for _ in range(50):
        state = subprocess.run(['ps', '-p', str(child_pid), '-o', 'stat='], text=True, capture_output=True).stdout.strip()
        if not state or state.startswith('Z'):
            break
        time.sleep(.1)
    assert not state or state.startswith('Z'), (outer.returncode, child_pid, state)
    assert outer.returncode in (-signal.SIGTERM, 128 + signal.SIGTERM), outer.returncode
    (root / 'launcher-term.terminal.txt').write_text(clean(output) + f'\nOuter exit: {outer.returncode}; Node 24 child reaped: {child_pid}\n')
    records.append({'scenario': 'launcher-term', 'exit': outer.returncode, 'transcript': 'launcher-term.terminal.txt'})
    child_pid = None
finally:
    if outer.poll() is None:
        os.kill(outer.pid, signal.SIGKILL)
    if child_pid:
        try:
            os.kill(child_pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    os.close(master)

# Killing the launcher during apply must stop the setup process tree before returning.
apply_project = root / 'term-apply'
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 120, 0, 0))
outer = subprocess.Popen([cli], cwd=neutral, env=env, stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
os.close(slave)
node_pid = setup_pid = None
try:
    output = b''
    for phrase, keys in [
        (b'How do you want to continue', b'\r'),
        (b'Where should Conquistador', b'\x1b[B\r'),
        (b'Absolute or relative', b'../term-apply\r'),
        (b'Set up Conquistador', b'\r'),
    ]:
        for _ in range(200):
            ready, _, _ = select.select([master], [], [], .1)
            if ready:
                output += os.read(master, 65536)
            if phrase in output:
                break
        assert phrase in output, clean(output[-1500:])
        os.write(master, keys)
    deadline = time.monotonic() + 20
    seen = []
    while time.monotonic() < deadline:
        ready, _, _ = select.select([master], [], [], 0)
        if ready:
            try:
                output += os.read(master, 65536)
            except OSError:
                pass
        children = subprocess.run(['pgrep', '-P', str(outer.pid)], text=True, capture_output=True).stdout.split()
        if children:
            node_pid = int(children[0])
            descendants = subprocess.run(['pgrep', '-P', str(node_pid)], text=True, capture_output=True).stdout.split()
            for descendant in descendants:
                command = subprocess.run(['ps', '-p', descendant, '-o', 'command='], text=True, capture_output=True).stdout
                seen.append(command)
                if 'tools/setup.mjs install' in command:
                    setup_pid = int(descendant)
                    break
        if setup_pid:
            break
        time.sleep(.01)
    assert setup_pid, f'Setup apply was not observed: {seen[-5:]} / {clean(output[-1500:])}'
    os.kill(outer.pid, signal.SIGTERM)
    outer.wait(timeout=15)
    def alive(pid):
        state = subprocess.run(['ps', '-p', str(pid), '-o', 'stat='], text=True, capture_output=True).stdout.strip()
        return bool(state and not state.startswith('Z'))
    assert not alive(node_pid) and not alive(setup_pid), (outer.returncode, node_pid, setup_pid)
    group = subprocess.run(['ps', '-axo', 'pid=,pgid=,stat='], text=True, capture_output=True, check=True).stdout
    active = [line for line in group.splitlines() if (parts := line.split()) and len(parts) >= 3
              and parts[1] == str(node_pid) and not parts[2].startswith('Z')]
    assert not active, f'Setup process group survived launcher exit: {active}'
    def footprint():
        return sorted((str(path.relative_to(apply_project)), path.stat().st_size, path.stat().st_mtime_ns)
                      for path in apply_project.rglob('*'))
    stable = footprint()
    time.sleep(1)
    assert footprint() == stable, 'Project writes continued after launcher exit'
    assert outer.returncode in (-signal.SIGTERM, 128 + signal.SIGTERM), outer.returncode
    (root / 'launcher-term-apply.terminal.txt').write_text(clean(output) + f'\nOuter exit: {outer.returncode}; setup PID: {setup_pid}; no descendants or later writes.\n')
    records.append({'scenario': 'launcher-term-apply', 'exit': outer.returncode, 'transcript': 'launcher-term-apply.terminal.txt'})
    node_pid = setup_pid = None
finally:
    if outer.poll() is None:
        os.kill(outer.pid, signal.SIGKILL)
    for group in (node_pid, outer.pid):
        if group:
            try:
                os.killpg(group, signal.SIGKILL)
            except ProcessLookupError:
                pass
    os.close(master)

for name, args, environment, expected in [
    ('wrong-noninteractive', [], env, 1),
    ('right-noninteractive-bare', [], {**env, 'PATH': right + ':/usr/bin:/bin'}, 0),
    ('right-noninteractive-install', ['--host', 'none', '--yes', '--project', str(root / 'other')], {**env, 'PATH': right + ':/usr/bin:/bin'}, 0),
    ('wrong-help', ['--help'], env, 0),
    ('wrong-version', ['--version'], env, 0),
]:
    proc = subprocess.run([cli, *args], cwd=neutral, env=environment, text=True, capture_output=True)
    text = proc.stdout + proc.stderr
    assert proc.returncode == expected, (name, text)
    (root / (name + '.terminal.txt')).write_text(text)
    records.append({'scenario': name, 'exit': proc.returncode, 'transcript': name + '.terminal.txt'})
assert (root / 'other/.conquistador/SKILL.md').is_file()
assert not (neutral / '.conquistador').exists()
(root / 'node-onboarding-e2e.json').write_text(json.dumps({'installedCli': cli, 'node26': wrong, 'node24': right, 'scenarios': records}, indent=2) + '\n')
print(root / 'node-onboarding-e2e.json')
