"""The agent loop, written by hand: the model decides, your code executes."""
import json

import anthropic

client = anthropic.Anthropic()
MODEL = "claude-opus-5-5"

TOOLS = [
    {
        "name": "get_order",
        "description": (
            "Look up a customer order by ID. Returns status, items and ship date as JSON. "
            "Use it whenever the customer mentions an order number such as 'A-1042'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"order_id": {"type": "string", "description": "Order ID, e.g. A-1042"}},
            "required": ["order_id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "refund_order",
        "description": "Refund a delivered order. Only call after get_order confirms it was delivered.",
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string"},
                "reason": {"type": "string", "enum": ["damaged", "late", "not_as_described"]},
            },
            "required": ["order_id", "reason"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]

ORDERS = {"A-1042": {"status": "delivered", "items": ["kettle"], "shipped": "2026-10-01"}}


def run_tool(name: str, args: dict) -> str:
    if name == "get_order":
        order = ORDERS.get(args["order_id"])
        if order is None:
            raise LookupError(f"No order {args['order_id']}. Ask the customer to re-check the ID.")
        return json.dumps(order)
    if name == "refund_order":
        return json.dumps({"refunded": True, "order_id": args["order_id"], "reason": args["reason"]})
    raise ValueError(f"Unknown tool: {name}")


def run_agent(task: str, max_turns: int = 10) -> str:
    messages = [{"role": "user", "content": task}]
    for _ in range(max_turns):                      # 1. hard stop: never loop forever
        response = client.messages.create(
            model=MODEL,
            max_tokens=16000,
            system="You are a support agent. Always verify an order before refunding it.",
            tools=TOOLS,
            messages=messages,
        )
        messages.append({"role": "assistant", "content": response.content})  # 2. keep ALL blocks

        if response.stop_reason != "tool_use":      # 3. end_turn, max_tokens, refusal ...
            return "".join(b.text for b in response.content if b.type == "text")

        results = []
        for block in response.content:              # 4. there may be several calls (parallel)
            if block.type != "tool_use":
                continue
            try:
                output, failed = run_tool(block.name, block.input), False
            except Exception as exc:                # 5. errors go back to the model, not up the stack
                output, failed = f"Error: {exc}", True
            results.append({"type": "tool_result", "tool_use_id": block.id,
                            "content": output, "is_error": failed})
        messages.append({"role": "user", "content": results})  # 6. all results in ONE message
    return "Stopped: turn limit reached."


if __name__ == "__main__":
    print(run_agent("My kettle from order A-1042 arrived cracked. Can I get a refund?"))
