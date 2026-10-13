"""Build the site search index.

    python3 tools/build_search_index.py

Reads every topic page, splits it into one chunk per <h2 id> section (plus the page
intro), and writes:

  assets/search-index.json   canonical index: used by any server-side / agentic search
  assets/search-index.js     same data as `window.__SEARCH_INDEX__`, so the static
                             search also works when the site is opened from disk (file://)

Chunk ids are stable ("<topic>#<section-id>"), so a future agent can cite them and the
browser can link straight to them. No third-party dependencies.
"""
import json
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = {"script", "style", "svg", "nav", "footer", "button", "select", "option", "form", "noscript"}
BLOCK = {"p", "li", "td", "th", "div", "pre", "h1", "h2", "h3", "h4", "figcaption", "dd", "dt", "tr", "summary", "label"}
VOID = {"br", "img", "input", "meta", "link", "hr", "source", "wbr", "col", "area", "base", "embed", "param", "track"}


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = self.topic = self.description = ""
        self.h1 = ""
        self.chunks = []                      # list of dicts being built
        self.cur = None
        self.skip = 0
        self.in_article = 0
        self.capture = None                   # "title" | "h1" | "h2" | "h3"
        self.buf = []

    def new_chunk(self, sid, section, keywords=""):
        self.cur = {"sid": sid, "section": section, "keywords": keywords, "headings": [], "text": []}
        self.chunks.append(self.cur)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "body":
            self.topic = a.get("data-topic", "")
        if tag == "meta" and a.get("name") == "description":
            self.description = a.get("content", "")
        if tag == "title":
            self.capture, self.buf = "title", []
        if tag == "article":
            self.in_article += 1
            if self.cur is None:
                self.new_chunk("", "")
        if tag in VOID:
            return
        if self.skip or tag in SKIP:
            self.skip += 1
            return
        if not self.in_article:
            return
        if tag == "h1":
            self.capture, self.buf = "h1", []
        elif tag == "h2" and a.get("id"):
            self.new_chunk(a["id"], "", a.get("data-keywords", ""))
            self.capture, self.buf = "h2", []
        elif tag == "h3":
            self.capture, self.buf = "h3", []
        if tag in BLOCK and self.cur is not None:
            self.cur["text"].append(" ")

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if self.skip:
            self.skip -= 1
            return
        if tag == "title" and self.capture == "title":
            self.title, self.capture = " ".join("".join(self.buf).split()), None
        elif tag == "h1" and self.capture == "h1":
            self.h1, self.capture = " ".join("".join(self.buf).split()), None
        elif tag == "h2" and self.capture == "h2":
            self.cur["section"], self.capture = " ".join("".join(self.buf).split()), None
        elif tag == "h3" and self.capture == "h3":
            self.cur["headings"].append(" ".join("".join(self.buf).split()))
            self.capture = None
        if tag == "article":
            self.in_article -= 1
        if tag in BLOCK and self.cur is not None:
            self.cur["text"].append(" ")

    def handle_data(self, data):
        if self.capture == "title":
            self.buf.append(data)
            return
        if self.skip or not self.in_article or self.cur is None:
            return
        if self.capture in ("h1", "h2", "h3"):
            self.buf.append(data)
        if self.capture not in ("h2",):        # section titles are a separate field
            self.cur["text"].append(data)


def build():
    docs, pages = [], []
    for path in sorted((ROOT / "topics").glob("*.html")):
        if path.name.startswith("_"):
            continue
        p = PageParser()
        p.feed(path.read_text(encoding="utf-8"))
        url = f"topics/{path.name}"
        pages.append({"topic": p.topic, "title": p.title, "url": url, "description": p.description})
        for c in p.chunks:
            text = re.sub(r"\s+", " ", "".join(c["text"])).strip()
            text = text.replace("Mark section as reviewed", "").strip()
            if not text and not c["section"]:
                continue
            docs.append({
                "id": f"{p.topic}#{c['sid']}" if c["sid"] else p.topic,
                "topic": p.topic,
                "url": f"{url}#{c['sid']}" if c["sid"] else url,
                "page": p.title,
                "section": c["section"] or p.h1 or p.title,
                "headings": c["headings"],
                "keywords": c["keywords"],
                "text": text,
            })
    index = {"version": 1, "generated": date.today().isoformat(), "pages": pages, "docs": docs}
    out = ROOT / "assets"
    payload = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    (out / "search-index.json").write_text(payload + "\n", encoding="utf-8")
    (out / "search-index.js").write_text(
        "/* Generated by tools/build_search_index.py. Do not edit. */\n"
        f"window.__SEARCH_INDEX__ = {payload};\n", encoding="utf-8")
    size = len(payload.encode("utf-8"))
    print(f"{len(pages)} pages, {len(docs)} sections, {size / 1024:.0f} KiB")


if __name__ == "__main__":
    build()
