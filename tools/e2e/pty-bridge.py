"""Run one command in a pseudo-terminal of a fixed size and relay its bytes.

    python3 -I tools/e2e/pty-bridge.py COLUMNS ROWS -- COMMAND [ARG...]

Bytes on stdin go to the terminal; terminal output goes to stdout. The exit status is the
command's status (128 + signal when a signal ended it). The onboarding E2E drives this
bridge from Node, because Node has no built-in pseudo-terminal.
"""
import fcntl
import os
import pty
import select
import signal
import struct
import sys
import termios

columns, rows = int(sys.argv[1]), int(sys.argv[2])
command = sys.argv[sys.argv.index('--') + 1:]
pid, master = pty.fork()
if pid == 0:
    os.execvp(command[0], command)
fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', rows, columns, 0, 0))
os.kill(pid, signal.SIGWINCH)
stdin, stdout = sys.stdin.fileno(), sys.stdout.fileno()
open_input = True
status = None
while True:
    readers = [master] + ([stdin] if open_input else [])
    ready, _, _ = select.select(readers, [], [], 0.05)
    if master in ready:
        try:
            data = os.read(master, 65536)
        except OSError:
            data = b''
        if data:
            os.write(stdout, data)
        elif status is not None:
            break
    if stdin in ready:
        data = os.read(stdin, 65536)
        if data:
            os.write(master, data)
        else:
            open_input = False
    if status is None:
        done, code = os.waitpid(pid, os.WNOHANG)
        if done:
            status = code
    if status is not None and master not in ready:
        # Drain what is left, then stop.
        try:
            while select.select([master], [], [], 0.05)[0]:
                data = os.read(master, 65536)
                if not data:
                    break
                os.write(stdout, data)
        except OSError:
            pass
        break
sys.exit(os.WEXITSTATUS(status) if os.WIFEXITED(status) else 128 + os.WTERMSIG(status))
