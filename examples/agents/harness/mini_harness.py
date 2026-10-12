"""A small but complete agent harness.

The model only proposes actions. Everything in this file is the harness: loop control,
budgets, permissions, hooks, context hygiene, verification and tracing.
"""
import json
import re
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

import anthropic

MODEL = "claude-opus-5-5"


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    fn: Callable[..., str]
    risk: str = "read"                      # read | write | exec

    def spec(self) -> dict:
        return {"name": self.name, "description": self.description, "input_schema": self.input_schema}


@dataclass
class Policy:
    """Permission rules: deny patterns first, then a default per risk level."""
    read: str = "allow"
    write: str = "ask"
    exec: str = "ask"
    deny_patterns: tuple[str, ...] = ("rm -rf", "git push --force", "| sh", ".env")

    def decide(self, tool: Tool, args: dict) -> str:
        blob = json.dumps(args)
        if any(p in blob for p in self.deny_patterns):
            return "deny"
        return getattr(self, tool.risk)


@dataclass
class Budget:
    max_turns: int = 30
    max_output_tokens: int = 300_000
    turns: int = 0
    output_tokens: int = 0

    def charge(self, usage) -> None:
        self.turns += 1
        self.output_tokens += usage.output_tokens

    @property
    def turns_left(self) -> int:
        return self.max_turns - self.turns

    def exhausted(self) -> bool:
        return self.turns_left <= 0 or self.output_tokens >= self.max_output_tokens


PreHook = Callable[[str, dict], Optional[str]]   # return a reason to block, or None
PostHook = Callable[[str, dict, str], str]       # may rewrite the output (e.g. redact)


def ask_human(name: str, args: dict) -> bool:
    return input(f"Allow {name} {json.dumps(args)[:200]}? [y/N] ").strip().lower() == "y"


@dataclass
class Harness:
    tools: list[Tool]
    system: str
    client: anthropic.Anthropic = field(default_factory=anthropic.Anthropic)
    policy: Policy = field(default_factory=Policy)
    budget: Budget = field(default_factory=Budget)
    approve: Callable[[str, dict], bool] = ask_human
    pre_hooks: list[PreHook] = field(default_factory=list)
    post_hooks: list[PostHook] = field(default_factory=list)
    verify: Optional[Callable[[], Optional[str]]] = None   # failure text, or None when OK
    max_result_chars: int = 10_000
    trace_path: Path = Path("trace.jsonl")

    # -- observability ---------------------------------------------------------------
    def trace(self, event: str, **data) -> None:
        with self.trace_path.open("a") as f:
            f.write(json.dumps({"ts": time.time(), "event": event, **data}, default=str) + "\n")

    # -- one model call: stable prefix for caching, server-side compaction -------------
    def call_model(self, messages: list):
        return self.client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=["compact-2026-01-12"],
            context_management={"edits": [{"type": "compact_20260112"}]},
            system=[{"type": "text", "text": self.system,
                     "cache_control": {"type": "ephemeral"}}],   # caches tools + system
            tools=[t.spec() for t in self.tools],                # same order on every call
            messages=messages,
        )

    # -- one tool call: hooks -> permission -> execute -> post-process -----------------
    def run_tool(self, block) -> dict:
        def result(text: str, error: bool = False) -> dict:
            self.trace("tool", name=block.name, error=error, chars=len(text))
            return {"type": "tool_result", "tool_use_id": block.id, "content": text, "is_error": error}

        tool = next((t for t in self.tools if t.name == block.name), None)
        if tool is None:
            return result(f"Unknown tool '{block.name}'.", error=True)
        for hook in self.pre_hooks:                            # deterministic guardrails
            reason = hook(block.name, block.input)
            if reason:
                return result(f"Blocked by policy: {reason}", error=True)
        decision = self.policy.decide(tool, block.input)
        if decision == "deny" or (decision == "ask" and not self.approve(block.name, block.input)):
            return result(f"Permission denied for {block.name}. Try a different approach.", error=True)
        try:
            output = tool.fn(**block.input)
        except Exception as exc:                               # errors become information
            return result(f"{type(exc).__name__}: {exc}", error=True)
        for hook in self.post_hooks:
            output = hook(block.name, block.input, output)
        if len(output) > self.max_result_chars:                # context hygiene
            cut = len(output) - self.max_result_chars
            output = output[: self.max_result_chars] + f"\n[... {cut} more chars not shown]"
        return result(output)

    # -- the loop ----------------------------------------------------------------------
    def run(self, task: str) -> str:
        messages: list = [{"role": "user", "content": task}]
        self.trace("start", task=task)
        while not self.budget.exhausted():
            response = self.call_model(messages)
            self.budget.charge(response.usage)
            self.trace("model", stop_reason=response.stop_reason,
                       output_tokens=response.usage.output_tokens)
            messages.append({"role": "assistant", "content": response.content})  # append-only

            if response.stop_reason == "tool_use":
                calls = [b for b in response.content if b.type == "tool_use"]
                messages.append({"role": "user", "content": [self.run_tool(b) for b in calls]})
                if self.budget.turns_left == 3:                # warn instead of cutting off
                    messages.append({"role": "system",
                                     "content": "3 turns left. Finish the current step and summarise."})
                continue
            if response.stop_reason == "max_tokens":
                messages.append({"role": "user", "content": "Continue exactly where you stopped."})
                continue
            if response.stop_reason == "refusal":
                self.trace("refusal")
                return "The model declined this task."

            failure = self.verify() if self.verify else None  # end_turn: check before accepting
            if failure is None:
                self.trace("done", turns=self.budget.turns)
                return "".join(b.text for b in response.content if b.type == "text")
            self.trace("verify_failed", details=failure[:500])
            messages.append({"role": "user",
                             "content": f"Verification failed. Fix this before finishing:\n{failure}"})
        self.trace("budget_exhausted", turns=self.budget.turns)
        return "Stopped: budget exhausted."


# ---- wiring it up -------------------------------------------------------------------
def read_file(path: str) -> str:
    return Path(path).read_text()


def write_file(path: str, content: str) -> str:
    Path(path).write_text(content)
    return f"Wrote {len(content)} chars to {path}"


def run_command(command: str) -> str:
    p = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=120)
    return f"exit={p.returncode}\n{p.stdout}{p.stderr}"


def tests_pass() -> Optional[str]:
    p = subprocess.run(["pytest", "-q"], capture_output=True, text=True)
    return None if p.returncode == 0 else (p.stdout + p.stderr)[-3000:]


def protect_main_branch(name: str, args: dict) -> Optional[str]:
    if name == "run_command" and re.search(r"git (commit|push).*\bmain\b", args.get("command", "")):
        return "Never commit or push to main. Create a feature branch."
    return None


def redact_secrets(name: str, args: dict, output: str) -> str:
    return re.sub(r"sk-[A-Za-z0-9_-]{20,}", "[REDACTED]", output)


PATH = {"type": "string", "description": "Path relative to the repo root."}
TOOLS = [
    Tool("read_file", "Read a UTF-8 text file.",
         {"type": "object", "properties": {"path": PATH}, "required": ["path"]}, read_file, "read"),
    Tool("write_file", "Create or overwrite a file with the given content.",
         {"type": "object", "properties": {"path": PATH, "content": {"type": "string"}},
          "required": ["path", "content"]}, write_file, "write"),
    Tool("run_command", "Run a shell command in the repo (120 s timeout). Returns exit code and output.",
         {"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]},
         run_command, "exec"),
]

if __name__ == "__main__":
    harness = Harness(
        tools=TOOLS,
        system="You are a careful coding agent. Make the smallest change that makes the tests pass.",
        pre_hooks=[protect_main_branch],
        post_hooks=[redact_secrets],
        verify=tests_pass,
    )
    print(harness.run("The test test_parse_date is failing. Find the cause and fix it."))
