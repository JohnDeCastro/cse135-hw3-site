#!/usr/bin/env python3
import os, json, datetime
print("Content-Type: application/json")
print()
ip = os.environ.get("REMOTE_ADDR", "unknown")
now = datetime.datetime.now().isoformat()
print(json.dumps({"message":"Hello, Python — John De Castro!","now":now,"ip":ip}))
