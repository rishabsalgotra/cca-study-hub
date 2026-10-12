"""Same agent, but the SDK's tool runner owns the loop. You only write tools."""
import json

import anthropic
from anthropic import beta_tool

client = anthropic.Anthropic()
ORDERS = {"A-1042": {"status": "delivered", "items": ["kettle"]}}


@beta_tool
def get_order(order_id: str) -> str:
    """Look up a customer order by ID and return its status as JSON.

    Args:
        order_id: Order ID, e.g. A-1042.
    """
    return json.dumps(ORDERS.get(order_id, {"error": f"no order {order_id}"}))


@beta_tool
def refund_order(order_id: str, reason: str) -> str:
    """Refund a delivered order. Only call after get_order confirms delivery.

    Args:
        order_id: Order ID, e.g. A-1042.
        reason: One of damaged, late, not_as_described.
    """
    return json.dumps({"refunded": True, "order_id": order_id})


if __name__ == "__main__":
    runner = client.beta.messages.tool_runner(
        model="claude-opus-5-5",
        max_tokens=16000,
        tools=[get_order, refund_order],
        messages=[{"role": "user", "content": "Order A-1042 arrived damaged. Refund it please."}],
    )
    for message in runner:          # one iteration per model turn; stops when Claude is done
        for block in message.content:
            if block.type == "text":
                print(block.text)
