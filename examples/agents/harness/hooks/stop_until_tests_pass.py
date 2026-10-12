#!/usr/bin/env python3
"""Claude Code Stop hook: the agent may not finish while the tests fail.

Exit 2 blocks the stop and feeds stderr back to Claude, so it keeps working.
"""
import json
import subprocess
import sys

event = json.load(sys.stdin)
if event.get("stop_hook_active"):      # we already sent it back once: don't loop forever
    sys.exit(0)

tests = subprocess.run(["npm", "test", "--silent"], capture_output=True, text=True)
if tests.returncode != 0:
    print("Tests are failing. Fix them before finishing:\n" + (tests.stdout + tests.stderr)[-2000:],
          file=sys.stderr)
    sys.exit(2)
sys.exit(0)
