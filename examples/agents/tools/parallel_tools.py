"""Executing several tool calls from one turn: concurrently, safely, in one reply."""
import json
from concurrent.futures import ThreadPoolExecutor

MAX_RESULT_CHARS = 20_000          # protect the context window from giant outputs
READ_ONLY = {"get_weather", "search_docs"}   # safe to run in parallel


def shorten(text: str, limit: int = MAX_RESULT_CHARS) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n...[cut {len(text) - limit} chars; narrow your query]"


def execute_one(block, registry: dict) -> dict:
    fn = registry.get(block.name)
    try:
        if fn is None:
            raise KeyError(f"Unknown tool '{block.name}'. Available: {', '.join(registry)}")
        output = fn(**block.input)
        content = output if isinstance(output, str) else json.dumps(output)
        return {"type": "tool_result", "tool_use_id": block.id, "content": shorten(content)}
    except Exception as exc:
        return {"type": "tool_result", "tool_use_id": block.id,
                "content": f"Error: {exc}", "is_error": True}


def execute_tool_calls(response, registry: dict) -> dict:
    """Return ONE user message holding a tool_result for EVERY tool_use block."""
    calls = [b for b in response.content if b.type == "tool_use"]
    parallel = [c for c in calls if c.name in READ_ONLY]
    serial = [c for c in calls if c.name not in READ_ONLY]       # writes keep their order

    with ThreadPoolExecutor() as pool:
        done = dict(zip((c.id for c in parallel), pool.map(lambda c: execute_one(c, registry), parallel)))
    for c in serial:
        done[c.id] = execute_one(c, registry)

    return {"role": "user", "content": [done[c.id] for c in calls]}   # original order
