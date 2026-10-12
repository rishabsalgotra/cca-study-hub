"""Let the Claude API connect to a REMOTE MCP server for you (no client code needed)."""
import os

import anthropic

client = anthropic.Anthropic()

response = client.beta.messages.create(
    model="claude-opus-5-5",
    max_tokens=16000,
    betas=["mcp-client-2025-11-20"],
    mcp_servers=[{
        "type": "url",
        "url": "https://helpdesk.example.com/mcp",          # Streamable HTTP endpoint
        "name": "helpdesk",
        "authorization_token": os.environ["HELPDESK_TOKEN"],
    }],
    tools=[{
        "type": "mcp_toolset",
        "mcp_server_name": "helpdesk",                      # must match a name above
        "default_config": {"enabled": False},               # allowlist mode:
        "configs": {"search_tickets": {"enabled": True}},   # expose only what you need
    }],
    messages=[{"role": "user", "content": "Any open tickets about SSO?"}],
)
print(next(b.text for b in response.content if b.type == "text"))
