import asyncio
import json

from conftest import fake_async_client, fake_client, response, text, tool_use

import agent_loop
import tool_runner
import workflows


def test_agent_loop_parallel_calls_errors_and_stop():
    fake = fake_client([
        response(text("Checking."), tool_use("t1", "get_order", order_id="A-1042"),
                 tool_use("t2", "get_order", order_id="ZZZ"), stop="tool_use"),
        response(tool_use("t3", "refund_order", order_id="A-1042", reason="damaged"), stop="tool_use"),
        response(text("Refunded A-1042.")),
    ])
    agent_loop.client = fake
    assert agent_loop.run_agent("refund A-1042") == "Refunded A-1042."

    second_call = fake.messages.calls[1]["messages"]
    results = second_call[-1]["content"]
    assert second_call[-1]["role"] == "user" and len(results) == 2      # both results, one message
    assert results[0]["is_error"] is False and json.loads(results[0]["content"])["status"] == "delivered"
    assert results[1]["is_error"] is True and "re-check" in results[1]["content"]
    assert len(fake.messages.calls) == 3


def test_agent_loop_turn_limit():
    agent_loop.client = fake_client(lambda kw: response(tool_use("t", "get_order", order_id="A-1042"),
                                                        stop="tool_use"))
    assert agent_loop.run_agent("loop forever", max_turns=4) == "Stopped: turn limit reached."


def test_tool_runner_generates_schema_from_signature():
    schema = tool_runner.get_order.to_dict()
    assert schema["name"] == "get_order"
    assert schema["input_schema"]["required"] == ["order_id"]
    assert "Order ID" in json.dumps(schema)


def test_routing_and_evaluator():
    def responder(kw):
        system = kw["system"]
        if system.startswith("Classify"):
            assert kw["model"] == workflows.FAST
            return response(text('{"category": "billing"}'))
        if "billing specialist" in system:
            return response(text("Refund issued for the duplicate charge."))
        if "demanding reviewer" in system:
            passed = "v2" in kw["messages"][0]["content"]
            return response(text(json.dumps({"passed": passed, "feedback": "Add an example."})))
        return response(text("draft v2" if "Reviewer feedback" in kw["messages"][0]["content"] else "draft v1"))

    workflows.client = fake_client(responder)
    assert workflows.handle_ticket("I was charged twice") == "Refund issued for the duplicate charge."
    assert workflows.write_with_review("Explain caching", "Must include an example") == "draft v2"


def test_chain_gate_blocks_bad_outline():
    workflows.client = fake_client(lambda kw: response(text("- only one bullet")))
    try:
        workflows.launch_post("notes")
    except ValueError as e:
        assert "gate" in str(e)
    else:
        raise AssertionError("gate should fail")


def test_parallel_voting_and_orchestrator():
    votes = iter(["PHISHING", "SAFE", "PHISHING"])
    workflows.aclient = fake_async_client(lambda kw: response(text(next(votes))))
    assert asyncio.run(workflows.is_phishing("click here")) is True

    plan = {"subtasks": [{"title": "Prices", "instructions": "x"}, {"title": "Reviews", "instructions": "y"}]}
    workflows.client = fake_client(lambda kw: response(text(
        json.dumps(plan) if "output_config" in kw else "FINAL: " + kw["messages"][0]["content"][-40:])))
    workflows.aclient = fake_async_client(lambda kw: response(text("summary")))
    out = asyncio.run(workflows.research("Compare kettles"))
    assert out.startswith("FINAL") and "Reviews" in out


def test_agent_sdk_options_build():
    import agent_sdk
    assert agent_sdk.options.agents["test-runner"].model == "haiku"
    assert "Agent" in agent_sdk.options.allowed_tools
