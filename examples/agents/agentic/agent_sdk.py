"""A full agent with built-in tools and a subagent, using the Claude Agent SDK."""
import asyncio

from claude_agent_sdk import AgentDefinition, ClaudeAgentOptions, ResultMessage, query

options = ClaudeAgentOptions(
    model="claude-opus-5-5",
    system_prompt="You are a careful senior engineer. Read code before changing it.",
    allowed_tools=["Read", "Grep", "Glob", "Edit", "Bash", "Agent"],
    permission_mode="acceptEdits",       # edits auto-approved; other risky tools still ask
    max_turns=40,                        # hard stop for the loop
    max_budget_usd=2.00,                 # hard stop for spend
    agents={
        "test-runner": AgentDefinition(
            description="Runs the test suite and reports failures. Use after every code change.",
            prompt="Run the tests. Report ONLY failing tests as file:line plus the error message.",
            tools=["Bash", "Read"],
            model="haiku",               # cheaper model for a narrow job
        ),
    },
)


async def main() -> None:
    async for message in query(prompt="Fix the failing date-parsing test in src/", options=options):
        if isinstance(message, ResultMessage):
            print(message.result)
            print(f"turns={message.num_turns} cost=${message.total_cost_usd}")


if __name__ == "__main__":
    asyncio.run(main())
