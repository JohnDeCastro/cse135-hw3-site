#!/usr/bin/env python3
import os, sys
print("Content-Type: text/plain; charset=utf-8")
print()
method = os.environ.get("REQUEST_METHOD","")
print(f"Method: {method}")
length = int(os.environ.get("CONTENT_LENGTH") or 0)
body = sys.stdin.read(length) if length > 0 else ""
print("Raw body:")
print(body)
