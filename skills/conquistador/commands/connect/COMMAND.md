---
name: connect
description: "Show which of the user's services Conquistador can use through Executor, and connect what the task needs."
metadata:
  version: 1.0.0
---

# Connect the user's services

Conquistador names capabilities, not providers. The user connects the services they already use
in Executor. You find the right tool at task time and call it.

## Run it

Run `conquistador connect` in the user's terminal, or `conquistador connect --json [CAPABILITY|COMMAND...]`
from the agent. Name a command (`launch`) to check only the capabilities it uses.

Each capability has one state:

| State | Means | Do |
| --- | --- | --- |
| `verified` | One read succeeded and was recorded | Use it |
| `connected` | Executor has a matching tool in a configured integration | Use it; verify one read when the result matters |
| `missing` | No matching tool, or Executor is not installed | Finish with supplied context; offer `conquistador connect add` |
| `unknown` | Executor is installed but not running | Tell the user to open Executor.app or run `executor web` |

## Set up what is missing

1. Executor is not installed: run `conquistador connect` in a terminal. It asks before it runs
   `npm install -g executor` and `executor install`. Without a terminal, give the user those two
   commands.
2. Executor is not running: tell the user to open Executor.app or run `executor web`. Do not run
   `executor tools`, `executor call`, or `executor mcp` to wake it; those start a folder-scoped
   server that hides the user's integrations.
3. A capability is missing: run `conquistador connect add`. It opens the Executor web UI. The
   user chooses Add Integration and signs in there. Read `integrations/<capability>.md` for the
   providers that fit.
4. Verify one bounded read: `conquistador connect verify CAPABILITY --tool PATH --args JSON`.
   It runs read-class tools only and records the tool, not the data.

Never ask for API keys, tokens, or passwords in chat. Credentials stay in Executor.

## Use a capability during a task

Follow the task-time protocol in [setup](../../standards/setup.md#use-live-data-through-executor).

## Capabilities

[`capabilities.json`](../../capabilities.json) lists every capability with its class and Executor
search phrases, and maps each command to the capabilities it can use. Each capability has a
recipe in [`integrations/`](../../integrations/README.md).

Read-class tools run within host policy. Write-class tools send, publish, spend, or change data:
show the exact payload and get the user's explicit approval for each call.
