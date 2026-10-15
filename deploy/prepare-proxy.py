"""Add Dino Games to a copy of NCN's nginx template without changing its servers."""

import pathlib
import sys

if len(sys.argv) != 3:
    raise SystemExit("Usage: python3 prepare-proxy.py ORIGINAL_TEMPLATE OUTPUT_TEMPLATE")

source = pathlib.Path(sys.argv[1]).read_text()
include = "  include /etc/nginx/dino-games.conf;"

if include not in source:
    position = source.rfind("}")
    if position < 0 or "http {" not in source:
        raise SystemExit("Expected an Nginx configuration with an http block")
    source = source[:position] + include + "\n" + source[position:]

pathlib.Path(sys.argv[2]).write_text(source)
