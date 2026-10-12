"""Connect to the server over stdio, discover its capabilities and call a tool."""
import asyncio

from mcp import Client, StdioServerParameters


async def main() -> None:
    server = StdioServerParameters(command="python", args=["mcp_server.py"])
    async with Client(server) as client:
        tools = await client.list_tools()
        print("tools:", [t.name for t in tools.tools])

        result = await client.call_tool("search_tickets", {"query": "login"})
        print("result:", result.structured_content or result.content)

        page = await client.read_resource("ticket://T-1")
        print(page.contents[0].text)


if __name__ == "__main__":
    asyncio.run(main())
