"""Cache-friendly request layout: stable things first, growing things last, never edit the past."""
import anthropic

from my_tools import TOOLS as MY_TOOLS     # your tool definitions

client = anthropic.Anthropic()
SYSTEM_PROMPT = open("SYSTEM.md").read()        # frozen for the whole session: no timestamps!
TOOLS = sorted(MY_TOOLS, key=lambda t: t["name"])   # deterministic order on every request

messages = []                                   # append-only transcript


def turn(user_text: str):
    messages.append({"role": "user", "content": user_text})
    response = client.messages.create(
        model="claude-opus-5-5",
        max_tokens=16000,
        tools=TOOLS,                                              # 1. rendered first
        system=[{"type": "text", "text": SYSTEM_PROMPT,
                 "cache_control": {"type": "ephemeral"}}],        # 2. breakpoint: tools + system
        cache_control={"type": "ephemeral"},                      # 3. auto-cache the growing tail
        messages=messages,
    )
    messages.append({"role": "assistant", "content": response.content})
    u = response.usage
    print(f"cache read={u.cache_read_input_tokens} written={u.cache_creation_input_tokens} "
          f"uncached={u.input_tokens}")                           # watch your hit rate
    return response


def add_instruction(text: str):
    """Mid-session instruction WITHOUT editing the system prompt (keeps the cache valid)."""
    messages.append({"role": "system", "content": text})
