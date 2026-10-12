#!/usr/bin/env python3
"""Claude Code PreToolUse hook: block destructive shell commands.

Claude Code sends the pending tool call as JSON on stdin.
Exit 0 = allow. Exit 2 = block; stderr is shown to Claude so it can choose another way.
"""
import json
import re
import sys

DANGEROUS = [
    r"\brm\s+-rf\s+(/|~|\$HOME)",
    r"\bgit\s+push\b.*--force",
    r"\bDROP\s+(TABLE|DATABASE)\b",
    r"\bcurl\b[^|]*\|\s*(ba|z)?sh\b",
]

event = json.load(sys.stdin)
command = event.get("tool_input", {}).get("command", "")
for pattern in DANGEROUS:
    if re.search(pattern, command, re.IGNORECASE):
        print(f"Blocked by policy: '{command}' matches {pattern}. Use a safer alternative.",
              file=sys.stderr)
        sys.exit(2)
sys.exit(0)
