"""Bad vs good tool definitions for the same capability."""

# BAD: vague name, no guidance, free-text everything, leaks implementation details
BAD = {
    "name": "query",
    "description": "Runs a query.",
    "input_schema": {
        "type": "object",
        "properties": {"q": {"type": "string"}, "opts": {"type": "string"}},
    },
}

# GOOD: says what, when, when NOT, what comes back; constrained, documented inputs
GOOD = {
    "name": "crm_search_customers",                    # namespaced: service_resource_action
    "description": (
        "Search customers in the CRM by name, email or company. "
        "Use this to find a customer_id before calling crm_get_customer or billing_* tools. "
        "Do NOT use it for orders; use orders_search instead. "
        "Returns at most `limit` matches, each with customer_id, name, email, company and plan. "
        "If more matches exist, the response includes next_cursor; pass it back to get more."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Name, email or company. Partial matches allowed."},
            "plan": {"type": "string", "enum": ["free", "pro", "enterprise"],
                     "description": "Optional filter by subscription plan."},
            "limit": {"type": "integer", "minimum": 1, "maximum": 50,
                      "description": "Max results. Default 10; keep small to save context."},
            "response_format": {"type": "string", "enum": ["concise", "detailed"],
                                "description": "concise = id+name+email only (default)."},
            "cursor": {"type": "string", "description": "next_cursor from a previous call."},
        },
        "required": ["query"],
        "additionalProperties": False,
    },
}

# GOOD error result: says what went wrong AND what to do next
GOOD_ERROR = {
    "type": "tool_result",
    "tool_use_id": "toolu_01A",
    "is_error": True,
    "content": ("No customer matches 'Acme Corp'. Did you mean 'ACME Corporation' (customer_id C-88)? "
                "Retry with that name, or search by email instead."),
}
