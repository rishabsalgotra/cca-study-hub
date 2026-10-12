"""Offline test helpers: fake Anthropic clients that replay scripted responses."""
import os
import sys
from pathlib import Path
from types import SimpleNamespace as NS

ROOT = Path(__file__).resolve().parents[1]
for sub in ("agentic", "tools", "harness"):
    sys.path.insert(0, str(ROOT / sub))
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-used")   # clients are never called for real


def text(t):
    return NS(type="text", text=t)


def tool_use(id_, name, **inp):
    return NS(type="tool_use", id=id_, name=name, input=inp)


def response(*blocks, stop="end_turn", out=50):
    return NS(content=list(blocks), stop_reason=stop, usage=NS(output_tokens=out, input_tokens=500))


class FakeMessages:
    def __init__(self, script):
        self.script = list(script) if not callable(script) else script
        self.calls = []

    def _next(self, kw):
        self.calls.append({**kw, "messages": list(kw.get("messages", []))})
        return self.script(kw) if callable(self.script) else self.script.pop(0)

    def create(self, **kw):
        return self._next(kw)


class AsyncFakeMessages(FakeMessages):
    async def create(self, **kw):
        return self._next(kw)


def fake_client(script):
    msgs = FakeMessages(script)
    return NS(messages=msgs, beta=NS(messages=msgs))


def fake_async_client(script):
    return NS(messages=AsyncFakeMessages(script))
