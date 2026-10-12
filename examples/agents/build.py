"""Build topic pages: inline example code into templates/*.html -> ../../topics/*.html

Usage: python3 build.py            (all templates)
Placeholders: {{code:relative/path}} is replaced with the escaped file, comments dimmed.
"""
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
OUT = ROOT.parent.parent / "topics"
COMMENT = {".py": r"(^|\s)(#.*)$", ".js": r"(^|\s)(//.*)$", ".ts": r"(^|\s)(//.*)$"}


def render(path: str) -> str:
    src = (ROOT / path).read_text().rstrip("\n")
    pattern = COMMENT.get(pathlib.Path(path).suffix)
    lines = []
    for line in src.split("\n"):
        m = re.search(pattern, line) if pattern else None
        if m and line[: m.start(2)].count('"') % 2 == 0 and line[: m.start(2)].count("'") % 2 == 0:
            lines.append(html.escape(line[: m.start(2)], quote=False)
                         + '<span class="c">' + html.escape(m.group(2), quote=False) + "</span>")
        else:
            lines.append(html.escape(line, quote=False))
    return "\n".join(lines)


for template in sorted((ROOT / "templates").glob("*.html")):
    page, n = re.subn(r"\{\{code:([^}]+)\}\}", lambda m: render(m.group(1)), template.read_text())
    assert "{{" not in page, f"unresolved placeholder in {template.name}"
    (OUT / template.name).write_text(page)
    print(f"{template.name}: inlined {n} code blocks")
