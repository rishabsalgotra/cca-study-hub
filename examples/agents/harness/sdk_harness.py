"""The same guardrails, programmatically, with the Claude Agent SDK."""
import asyncio

from claude_agent_sdk import (ClaudeAgentOptions, HookMatcher, PermissionResultAllow,
                              PermissionResultDeny, ResultMessage, query)


async def block_dangerous(input_data, tool_use_id, context):
    """PreToolUse hook: runs before every Bash call, can deny it."""
    command = input_data["tool_input"].get("command", "")
    if "rm -rf" in command or "--force" in command:
        return {"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": "Destructive command blocked by policy.",
        }}
    return {}


async def can_use_tool(tool_name, tool_input, context):
    """Called for tools that are NOT pre-approved in allowed_tools."""
    if tool_name in ("Write", "Edit") and not tool_input.get("file_path", "").startswith("/repo/"):
        return PermissionResultDeny(message="Only files inside /repo may be changed.")
    return PermissionResultAllow()


options = ClaudeAgentOptions(
    cwd="/repo",
    allowed_tools=["Read", "Grep", "Glob", "Bash"],   # pre-approved; never reach can_use_tool
    can_use_tool=can_use_tool,                         # decides Write/Edit
    hooks={"PreToolUse": [HookMatcher(matcher="Bash", hooks=[block_dangerous])]},
    max_turns=40,
    max_budget_usd=3.00,
)


async def main() -> None:
    async for message in query(prompt="Upgrade the date library and fix what breaks.", options=options):
        if isinstance(message, ResultMessage):
            print(message.subtype, message.num_turns, message.total_cost_usd)


if __name__ == "__main__":
    asyncio.run(main())
