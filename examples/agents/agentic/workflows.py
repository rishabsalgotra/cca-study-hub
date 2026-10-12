"""The five workflow patterns. Your code owns the control flow; the model fills in steps."""
import asyncio
import json
from collections import Counter

import anthropic

client = anthropic.Anthropic()
aclient = anthropic.AsyncAnthropic()
SMART, FAST = "claude-opus-5-5", "claude-haiku-5-5"


def text_of(response) -> str:
    return "".join(b.text for b in response.content if b.type == "text")


def ask(system: str, prompt: str, model: str = SMART) -> str:
    r = client.messages.create(model=model, max_tokens=16000, system=system,
                               messages=[{"role": "user", "content": prompt}])
    return text_of(r)


def ask_json(system: str, prompt: str, schema: dict, model: str = SMART) -> dict:
    """Structured output: the reply is guaranteed to match `schema`."""
    r = client.messages.create(
        model=model, max_tokens=16000, system=system,
        output_config={"format": {"type": "json_schema", "schema": schema}},
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(text_of(r))


# 1. Prompt chaining: fixed steps, with a programmatic gate between them ------------
def launch_post(product_notes: str) -> str:
    outline = ask("You write product marketing.",
                  f"Write a 5-bullet outline (one '- ' bullet per line) for:\n{product_notes}")
    if sum(line.startswith("- ") for line in outline.splitlines()) < 5:   # gate
        raise ValueError("Outline gate failed; not worth spending tokens on a draft.")
    draft = ask("You write product marketing.", f"Expand into a 300-word post:\n{outline}")
    return ask("You are a strict copy editor. Return only the edited post.", draft)


# 2. Routing: classify once, then send to a specialised prompt (or cheaper model) ---
ROUTES = {
    "billing": "You are a billing specialist. Be precise about amounts and dates.",
    "technical": "You are a senior support engineer. Ask for logs if needed.",
    "general": "You are a friendly support agent.",
}
ROUTE_SCHEMA = {
    "type": "object",
    "properties": {"category": {"type": "string", "enum": list(ROUTES)}},
    "required": ["category"],
    "additionalProperties": False,
}


def handle_ticket(ticket: str) -> str:
    category = ask_json("Classify the support ticket.", ticket, ROUTE_SCHEMA, model=FAST)["category"]
    return ask(ROUTES[category], ticket)


# 3a. Parallelization, sectioning: independent sub-tasks at the same time -----------
async def review_diff(diff: str) -> dict[str, str]:
    focuses = {
        "security": "Review ONLY for security issues.",
        "performance": "Review ONLY for performance issues.",
        "tests": "Review ONLY for missing or weak tests.",
    }

    async def one(name: str, system: str) -> tuple[str, str]:
        r = await aclient.messages.create(model=SMART, max_tokens=16000, system=system,
                                          messages=[{"role": "user", "content": diff}])
        return name, text_of(r)

    return dict(await asyncio.gather(*(one(n, s) for n, s in focuses.items())))


# 3b. Parallelization, voting: same question N times, take the majority ------------
async def is_phishing(email: str, votes: int = 3) -> bool:
    async def vote() -> str:
        r = await aclient.messages.create(
            model=FAST, max_tokens=256,
            system="Answer with exactly one word: PHISHING or SAFE.",
            messages=[{"role": "user", "content": email}])
        return text_of(r).strip().upper()

    tally = Counter(await asyncio.gather(*(vote() for _ in range(votes))))
    return tally["PHISHING"] > votes // 2


# 4. Orchestrator-workers: the model decides the sub-tasks at runtime ---------------
PLAN_SCHEMA = {
    "type": "object",
    "properties": {"subtasks": {"type": "array", "items": {
        "type": "object",
        "properties": {"title": {"type": "string"}, "instructions": {"type": "string"}},
        "required": ["title", "instructions"],
        "additionalProperties": False,
    }}},
    "required": ["subtasks"],
    "additionalProperties": False,
}


async def research(goal: str) -> str:
    plan = ask_json("Split the goal into 2-5 independent research sub-tasks.", goal, PLAN_SCHEMA)

    async def worker(task: dict) -> str:        # fresh, isolated context per worker
        r = await aclient.messages.create(
            model=FAST, max_tokens=16000,
            system="Complete the sub-task. Reply with a dense summary under 200 words.",
            messages=[{"role": "user", "content": f"{task['title']}\n\n{task['instructions']}"}])
        return f"## {task['title']}\n{text_of(r)}"

    findings = await asyncio.gather(*(worker(t) for t in plan["subtasks"]))
    return ask("Synthesize the findings into one answer. Cite sub-task titles.",
               f"Goal: {goal}\n\n" + "\n\n".join(findings))


# 5. Evaluator-optimizer: generate, grade against criteria, revise -----------------
VERDICT_SCHEMA = {
    "type": "object",
    "properties": {"passed": {"type": "boolean"}, "feedback": {"type": "string"}},
    "required": ["passed", "feedback"],
    "additionalProperties": False,
}


def write_with_review(task: str, criteria: str, max_rounds: int = 3) -> str:
    draft = ask("You are a technical writer.", task)
    for _ in range(max_rounds):                 # bounded: the loop must end
        verdict = ask_json(f"You are a demanding reviewer. Criteria:\n{criteria}",
                           draft, VERDICT_SCHEMA)
        if verdict["passed"]:
            break
        draft = ask("You are a technical writer.",
                    f"{task}\n\nPrevious draft:\n{draft}\n\nReviewer feedback:\n{verdict['feedback']}"
                    "\n\nRewrite the draft to address every point.")
    return draft
