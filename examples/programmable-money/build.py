"""Inline the tested sources into the topic page: python3 build.py [output.html]"""
import html, re, sys, pathlib
root = pathlib.Path(__file__).parent
tpl = (root / "page.template.html").read_text()
def render(path):
    src = (root / path).read_text().rstrip("\n")
    out = []
    for line in src.split("\n"):
        m = re.search(r"(^|\s)(//.*)$", line)
        if m:
            code, com = line[:m.start(2)], m.group(2)
            out.append(html.escape(code, quote=False) + '<span class="c">' + html.escape(com, quote=False) + "</span>")
        else:
            out.append(html.escape(line, quote=False))
    return "\n".join(out)
page, n = re.subn(r"\{\{code:([^}]+)\}\}", lambda m: render(m.group(1)), tpl)
assert "{{" not in page
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "../../topics/programmable-money.html"
out.write_text(page)
print("inlined", n, "code blocks")
