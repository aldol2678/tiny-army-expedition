#!/usr/bin/env python3
"""Assemble local v0.8.2 sources with a separately supplied portrait registry."""
from pathlib import Path
import argparse
import hashlib
import re

ROOT = Path(__file__).resolve().parent
PROCEDURAL = {"relic-art", "rarity-art", "skill-effects"}
MARKER = re.compile(r"@@([a-z-]+)@@")


def assemble(registry: Path) -> str:
    if not registry.is_file():
        raise ValueError(
            "Missing separately supplied portrait registry. See README.md; "
            "assets-local/portrait-sheets.js is intentionally excluded."
        )
    text = (ROOT / "src" / "template.html").read_text(encoding="utf-8")
    names = MARKER.findall(text)
    if len(names) != len(set(names)) or "portrait-sheets" not in names:
        raise ValueError("Expected exactly one marker per assembly module")
    for name in names:
        if name == "portrait-sheets":
            source = registry
        elif name in PROCEDURAL:
            source = ROOT / "procedural-art" / (name + ".js")
        else:
            source = ROOT / "src" / (name + ".js")
        code = source.read_text(encoding="utf-8")
        if not code.strip():
            raise ValueError("Empty assembly module: " + name)
        code = re.sub(r"</script", r"<\/script", code, flags=re.I)
        text = text.replace("@@" + name + "@@", code)
    if MARKER.search(text):
        raise ValueError("Unresolved assembly marker")
    if re.search(r'<(?:script|link)[^>]+(?:src|href)=["\']https?://', text, re.I):
        raise ValueError("External script or stylesheet reference")
    return text


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--portrait-registry", type=Path,
                        default=ROOT / "assets-local" / "portrait-sheets.js")
    parser.add_argument("--check", action="store_true",
                        help="Validate and hash the assembly without writing output")
    args = parser.parse_args()
    try:
        data = assemble(args.portrait_registry).encode("utf-8")
    except (OSError, ValueError) as error:
        parser.exit(1, str(error) + "\n")
    digest = hashlib.sha256(data).hexdigest()
    if args.check:
        print(f"Assembly valid: {len(data)} bytes; SHA-256 {digest}; no output written")
        return 0
    output = ROOT / "dist" / "index.html"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)
    print(f"Built dist/index.html: {len(data)} bytes; SHA-256 {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
