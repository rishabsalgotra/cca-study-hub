"""A small MCP server exposing a tool, a resource template and a prompt (MCP Python SDK 2.x)."""
from typing import Annotated, Literal

from mcp.server.mcpserver import MCPServer
from mcp.types import ToolAnnotations
from pydantic import Field

mcp = MCPServer("helpdesk", instructions="Tools for searching and reading support tickets.")

TICKETS = {
    "T-1": {"title": "Login fails with SSO", "status": "open", "body": "SAML assertion expired..."},
    "T-2": {"title": "Invoice shows wrong VAT", "status": "closed", "body": "VAT rate was 19%..."},
}


@mcp.tool(annotations=ToolAnnotations(read_only_hint=True, open_world_hint=False))
def search_tickets(
    query: Annotated[str, Field(description="Keyword to match in the title, case-insensitive.")],
    status: Annotated[Literal["open", "closed", "any"], Field(description="Filter by status.")] = "any",
    limit: Annotated[int, Field(ge=1, le=50, description="Max tickets to return.")] = 10,
) -> list[dict]:
    """Search support tickets by keyword. Returns id, title and status for each match.
    Use ticket://{id} to read the full text of one ticket."""
    hits = [
        {"id": tid, "title": t["title"], "status": t["status"]}
        for tid, t in TICKETS.items()
        if query.lower() in t["title"].lower() and status in ("any", t["status"])
    ]
    return hits[:limit]


@mcp.resource("ticket://{ticket_id}", mime_type="text/markdown")
def ticket(ticket_id: str) -> str:
    """Full text of one ticket. The host app decides when to attach it."""
    t = TICKETS[ticket_id]
    return f"# {ticket_id}: {t['title']}\n\nStatus: {t['status']}\n\n{t['body']}"


@mcp.prompt()
def triage(ticket_id: str) -> str:
    """User-invoked template: triage a ticket."""
    return f"Read ticket://{ticket_id}, classify severity (P1-P4) and propose next steps."


if __name__ == "__main__":
    mcp.run()          # stdio transport by default; use mcp.run("streamable-http") for remote
