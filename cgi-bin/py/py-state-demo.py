#!/usr/bin/env python3
import os, sys, http.cookies, uuid, pathlib, urllib.parse

SESSDIR = "/var/www/johndecastro.site/cgi-bin/py/sessions"
pathlib.Path(SESSDIR).mkdir(parents=True, exist_ok=True)

def read_body():
    length = int(os.environ.get("CONTENT_LENGTH") or 0)
    return sys.stdin.read(length) if length > 0 else ""

def get_sid():
    cookies = http.cookies.SimpleCookie(os.environ.get("HTTP_COOKIE",""))
    return cookies.get("SID").value if "SID" in cookies else uuid.uuid4().hex

def load_name(sid):
    p = pathlib.Path(SESSDIR)/sid
    return p.read_text().strip() if p.exists() else ""

def save_name(sid, name):
    (pathlib.Path(SESSDIR)/sid).write_text(name)

def destroy(sid):
    p = pathlib.Path(SESSDIR)/sid
    if p.exists(): p.unlink()

method = os.environ.get("REQUEST_METHOD","GET")
qs = os.environ.get("QUERY_STRING","")
destroy_flag = "destroy=1" in qs
sid = get_sid()

if method == "POST":
    body = read_body()
    data = urllib.parse.parse_qs(body, keep_blank_values=True)
    name = (data.get("name",[""])[0]).strip()
    if name:
        save_name(sid, name)
elif destroy_flag:
    destroy(sid)

name = load_name(sid)

print("Content-Type: text/html; charset=utf-8")
print(f"Set-Cookie: SID={sid}; Path=/; HttpOnly; SameSite=Lax")
print()
print("<!doctype html><meta charset='utf-8'><title>Python State Demo</title>")
print("<h1>Python State Demo</h1>")
if destroy_flag:
    print("<p>Session destroyed.</p>")
elif name:
    print(f"<p>Welcome back, <strong>{name}</strong>!</p>")
    print("<p><a href='?destroy=1'>Destroy session</a></p>")
else:
    print("""
<form method="post">
  <label>Name: <input name="name" required></label>
  <button>Save</button>
</form>
""")
