"""Installed-package terminal E2E. Run with an installed CLI path and Node 26 PATH.

Example: CONQUISTADOR_E2E_WRONG_NODE=/path/to/node26 CONQUISTADOR_E2E_NODE24=/path/to/node24 \\
    python3 tools/node-onboarding.e2e.py dist/node-onboarding-e2e/prefix/node_modules/.bin/conquistador dist/node-onboarding-e2e
Writes transcript and JSON evidence under the supplied output directory (not committed).
"""
import fcntl
import json
import os
import pty
import re
import select
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
    sys.exit('Set CONQUISTADOR_E2E_WRONG_NODE and CONQUISTADOR_E2E_NODE24 to absolute executables (Node 26 and 24).')
wrong_node, right_node = str(Path(wrong_node).resolve()), str(Path(right_node).resolve())
wrong, right = str(Path(wrong_node).parent), str(Path(right_node).parent)
if not subprocess.check_output([wrong_node, '-v']).startswith(b'v26') or not subprocess.check_output([right_node, '-v']).startswith(b'v24'):
    sys.exit('Expected Node 26 and Node 24 executables, respectively.')
if wrong in ('/opt/homebrew/bin', '/usr/local/bin'):
    sys.exit('Use an isolated Node 26 bin directory, not Homebrew bin, to exercise the no-candidate path.')
for name in ['neutral', 'project', 'other', 'empty-home', 'adoption']:
    shutil.rmtree(root / name, ignore_errors=True)
    (root / name).mkdir(parents=True)
env = {**os.environ, 'PATH': wrong + ':/usr/bin:/bin', 'CLAUDECODE': '1'}
records = []


def clean(data):
    return re.sub(r'\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07]*\x07)', '', data.decode('utf8', 'replace')).replace('\r', '')


def terminal(name, cwd, steps, environment=env, args=()):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 120, 0, 0))
    process = subprocess.Popen([cli, *args], cwd=cwd, env=environment, stdin=slave, stdout=slave, stderr=slave)
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
assert code == 1 and 'Node 24 setup' in text and 'nvm install 24' not in text
code, text = terminal('repeat-existing', project, [
    (b'How do you want to continue', b'\r'),
    (b'Where should Conquistador', b'\r'),
    (b'What do you want to do first', b'\r'),
])
assert code == 0 and 'Local files verified' in text and (project / '.conquistador/.conquistador-install.json').read_bytes() == receipt
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
