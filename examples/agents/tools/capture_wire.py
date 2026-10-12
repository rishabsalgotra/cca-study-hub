"""Regenerate tools/wire/*.json: real MCP results from mcp_server.py (shown on the topic page)."""
import asyncio
import json
from pathlib import Path

from mcp import Client

import mcp_server

OUT = Path(__file__).parent / "wire"


def dump(name: str, model) -> None:
    data = model.model_dump(by_alias=True, exclude_none=True, mode="json")
    data.pop("_meta", None)
    (OUT / name).write_text(json.dumps(data, indent=2) + "\n")


async def main() -> None:
    async with Client(mcp_server.mcp) as client:
        tools = await client.list_tools()
        listed = tools.model_copy()
        for t in listed.tools:
            t.output_schema = None                    # keep the page example short
        dump("tools_list_result.json", listed)
        dump("tools_call_result.json", await client.call_tool("search_tickets", {"query": "login"}))
        dump("tools_call_error.json", await client.call_tool("search_tickets", {"query": "x", "limit": 500}))


if __name__ == "__main__":
    asyncio.run(main())
