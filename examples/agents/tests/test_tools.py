import asyncio
import subprocess
import sys
import time
from pathlib import Path

from conftest import response, text, tool_use

import parallel_tools
import tool_design
from mcp import Client

TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"


def test_tool_design_shapes():
    assert tool_design.GOOD["input_schema"]["additionalProperties"] is False
    assert len(tool_design.GOOD["description"]) > 4 * len(tool_design.BAD["description"])


def test_parallel_execution_order_errors_and_truncation():
    def slow(city):
        time.sleep(0.2)
        return {"city": city, "temp": 21}

    registry = {"get_weather": slow, "search_docs": lambda q: "x" * 50_000,
                "send_email": lambda to: f"sent to {to}"}
    resp = response(tool_use("a", "get_weather", city="Paris"), tool_use("b", "get_weather", city="Rome"),
                    tool_use("c", "send_email", to="ops"), tool_use("d", "search_docs", q="api"),
                    tool_use("e", "nope"), stop="tool_use")
    t0 = time.time()
    msg = parallel_tools.execute_tool_calls(resp, registry)
    assert time.time() - t0 < 0.39                                  # the two slow calls overlapped
    ids = [r["tool_use_id"] for r in msg["content"]]
    assert ids == ["a", "b", "c", "d", "e"] and msg["role"] == "user"
    assert "cut" in msg["content"][3]["content"] and len(msg["content"][3]["content"]) < 21_000
    assert msg["content"][4]["is_error"] and "Available" in msg["content"][4]["content"]


def test_mcp_server_in_process():
    sys.path.insert(0, str(TOOLS_DIR))
    import mcp_server

    async def run():
        async with Client(mcp_server.mcp) as client:
            tools = await client.list_tools()
            tool = tools.tools[0]
            assert tool.name == "search_tickets" and tool.annotations.read_only_hint is True
            assert "query" in tool.input_schema["required"]
            hits = await client.call_tool("search_tickets", {"query": "login"})
            assert "T-1" in str(hits.structured_content or hits.content)
            page = await client.read_resource("ticket://T-1")
            assert "Login fails" in page.contents[0].text
            prompts = await client.list_prompts()
            assert prompts.prompts[0].name == "triage"

            from anthropic.lib.tools.mcp import async_mcp_tool
            converted = async_mcp_tool(tool, client.session).to_dict()
            assert converted["name"] == "search_tickets" and "input_schema" in converted
    asyncio.run(run())


def test_mcp_client_over_stdio():
    out = subprocess.run([sys.executable, "mcp_client.py"], cwd=TOOLS_DIR, capture_output=True,
                         text=True, timeout=60, env={"PATH": str(Path(sys.executable).parent)})
    assert out.returncode == 0, out.stderr
    assert "search_tickets" in out.stdout and "Login fails" in out.stdout
