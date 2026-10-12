import json
import subprocess
import sys
from pathlib import Path

from conftest import fake_client, response, text, tool_use

import evals
import mini_harness as mh

HOOKS = Path(__file__).resolve().parents[1] / "harness" / "hooks"


def test_harness_end_to_end(tmp_path):
    (tmp_path / "a.py").write_text("print('hi') sk-ABCDEFGHIJKLMNOPQRSTUVWX")
    fake = fake_client([
        response(tool_use("1", "read_file", path=str(tmp_path / "a.py")), stop="tool_use"),
        response(tool_use("2", "run_command", command="rm -rf /"),
                 tool_use("3", "run_command", command="git push origin main"),
                 tool_use("4", "write_file", path=str(tmp_path / "b.py"), content="x"), stop="tool_use"),
        response(text("Done.")),
        response(text("Done, tests fixed.")),
    ])
    verdicts = iter(["1 failed: test_parse_date", None])
    asked = []
    h = mh.Harness(tools=mh.TOOLS, system="test", client=fake,
                   approve=lambda n, a: asked.append(n) or False,
                   pre_hooks=[mh.protect_main_branch], post_hooks=[mh.redact_secrets],
                   verify=lambda: next(verdicts), trace_path=tmp_path / "trace.jsonl")
    assert h.run("fix it") == "Done, tests fixed."

    first_result = fake.messages.calls[1]["messages"][-1]["content"][0]
    assert "[REDACTED]" in first_result["content"]                       # post-hook ran
    second = fake.messages.calls[2]["messages"][-1]["content"]
    assert "Permission denied" in second[0]["content"]                   # deny pattern
    assert "Blocked by policy" in second[1]["content"]                   # pre-hook
    assert "Permission denied" in second[2]["content"] and asked == ["write_file"]   # ask -> no
    assert "Verification failed" in fake.messages.calls[3]["messages"][-1]["content"]
    assert fake.messages.calls[0]["system"][0]["cache_control"] == {"type": "ephemeral"}
    events = [json.loads(l)["event"] for l in (tmp_path / "trace.jsonl").read_text().splitlines()]
    assert events[0] == "start" and "verify_failed" in events and events[-1] == "done"


def test_budget_warning_and_stop(tmp_path):
    fake = fake_client(lambda kw: response(tool_use("x", "read_file", path="/nonexistent"), stop="tool_use"))
    h = mh.Harness(tools=mh.TOOLS, system="t", client=fake, budget=mh.Budget(max_turns=5),
                   trace_path=tmp_path / "t.jsonl")
    assert h.run("go") == "Stopped: budget exhausted."
    roles = [m["role"] for m in fake.messages.calls[-1]["messages"]]
    assert "system" in roles                                             # warned before the end
    assert len(fake.messages.calls) == 5


def run_hook(script, payload):
    return subprocess.run([sys.executable, str(HOOKS / script)], input=json.dumps(payload),
                          capture_output=True, text=True)


def test_pretooluse_hook():
    bad = run_hook("block_dangerous.py", {"tool_name": "Bash", "tool_input": {"command": "rm -rf ~"}})
    assert bad.returncode == 2 and "Blocked" in bad.stderr
    ok = run_hook("block_dangerous.py", {"tool_name": "Bash", "tool_input": {"command": "ls -la"}})
    assert ok.returncode == 0


def test_stop_hook_loop_guard():
    assert run_hook("stop_until_tests_pass.py", {"stop_hook_active": True}).returncode == 0


def test_pass_metrics():
    assert evals.pass_at_k(5, 5, 3) == 1.0 and evals.pass_hat_k(5, 0, 3) == 0.0
    assert evals.pass_at_k(5, 3, 3) == 1.0
    assert abs(evals.pass_hat_k(5, 3, 3) - 0.1) < 1e-9
    report = evals.evaluate([{"id": "t1", "prompt": "p"}], run_agent=lambda p: "ok",
                            grade=lambda t, out: out == "ok", trials=5, k=3)
    assert report["pass^3"] == 1.0


def test_sdk_harness_options():
    import sdk_harness
    assert sdk_harness.options.hooks["PreToolUse"][0].matcher == "Bash"
