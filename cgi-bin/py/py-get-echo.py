#!/usr/bin/env python3
import os, urllib.parse
print("Content-Type: text/plain; charset=utf-8")
print()
qs = os.environ.get("QUERY_STRING","")
params = urllib.parse.parse_qs(qs, keep_blank_values=True)
print("GET params:")
for k, vs in params.items():
    for v in vs:
        print(f"{k} = {v}")
