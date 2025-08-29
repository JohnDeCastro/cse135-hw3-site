#!/usr/bin/env python3
import os, datetime
print("Content-Type: text/html; charset=utf-8")
print()
ip = os.environ.get("REMOTE_ADDR", "unknown")
now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
print(f"""<!doctype html>
<meta charset="utf-8">
<title>Python Hello</title>
<h1>Hello, Python — John De Castro!</h1>
<p>Now: {now}</p>
<p>Your IP: {ip}</p>
""")
