#!/usr/bin/env python3
import os, sys, urllib.parse
print("Content-Type: text/plain; charset=utf-8")
print()
length = int(os.environ.get("CONTENT_LENGTH") or 0)
body = sys.stdin.read(length) if length > 0 else ""
print("POST raw body:")
print(body)
print("\nPOST params:")
params = urllib.parse.parse_qs(body, keep_blank_values=True)
for k, vs in params.items():
    for v in vs:
        print(f"{k} = {v}")
