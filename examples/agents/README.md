# Agentic AI examples

Source for the code on three topic pages:
[`agentic-architecture`](../../topics/agentic-architecture.html),
[`tools-mcp`](../../topics/tools-mcp.html) and
[`harness-engineering`](../../topics/harness-engineering.html).

```
agentic/    agent_loop.py (manual loop) · tool_runner.py · workflows.py (5 patterns) · agent_sdk.py
tools/      tool_design.py · parallel_tools.py · mcp_server.py · mcp_client.py · mcp_to_claude.py
            mcp_connector.py · mcp.json · capture_wire.py → wire/*.json (real MCP results)
harness/    mini_harness.py · caching_layout.py · sdk_harness.py · evals.py · settings.json · hooks/
tests/      offline tests: fake Anthropic clients, an in-process MCP server, real hook subprocesses
templates/  page templates; build.py inlines the code above into ../../topics/*.html
```

## Run the tests (no API key needed)

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q tests        # 17 tests
```

## Rebuild the pages

Edit a source file or template, then:

```sh
python3 build.py                           # rewrites ../../topics/{agentic-architecture,tools-mcp,harness-engineering}.html
cd tools && ../.venv/bin/python capture_wire.py   # only if mcp_server.py changed
```

Running the examples against the real API needs `ANTHROPIC_API_KEY` (or `ant auth login`).
Models used: `claude-opus-5-5` (default) and `claude-haiku-5-5` (cheap workers/routers).
