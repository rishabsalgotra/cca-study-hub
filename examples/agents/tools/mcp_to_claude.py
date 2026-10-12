"""Give Claude the MCP server's tools: list them, convert them, let the tool runner loop."""
import asyncio

import anthropic
from anthropic.lib.tools.mcp import async_mcp_tool
from mcp import Client, StdioServerParameters


async def main() -> None:
    claude = anthropic.AsyncAnthropic()
    async with Client(StdioServerParameters(command="python", args=["mcp_server.py"])) as mcp:
        listed = await mcp.list_tools()
        runner = claude.beta.messages.tool_runner(
            model="claude-opus-5-5",
            max_tokens=16000,
            tools=[async_mcp_tool(t, mcp.session) for t in listed.tools],
            messages=[{"role": "user", "content": "Are there open tickets about login problems?"}],
        )
        async for message in runner:
            for block in message.content:
                if block.type == "text":
                    print(block.text)


if __name__ == "__main__":
    asyncio.run(main())
