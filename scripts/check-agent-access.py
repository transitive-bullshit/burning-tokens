"""Read-only public ingress check. Never pass a private invitation URL here."""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def python_get(url):
    started = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            return {
                "status": response.status,
                "content_type": response.headers.get("Content-Type", ""),
                "cf_ray": response.headers.get("CF-Ray"),
                "cf_mitigated": response.headers.get("CF-Mitigated"),
                "elapsed_ms": round((time.monotonic() - started) * 1000),
                "body": response.read(32768).decode("utf-8", errors="replace"),
            }
    except urllib.error.HTTPError as error:
        return {
            "status": error.code,
            "cf_ray": error.headers.get("CF-Ray"),
            "cf_mitigated": error.headers.get("CF-Mitigated"),
            "error": "HTTP response rejected",
        }
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return {"status": None, "error": str(error)}


def curl_get(url):
    try:
        result = subprocess.run(
            ["curl", "--silent", "--show-error", "--connect-timeout", "8",
             "--max-time", "20", "--include", "--write-out", "\n%{json}", url],
            capture_output=True, text=True, timeout=25, check=False,
        )
        response, _, stats = result.stdout.rpartition("\n")
        timing = json.loads(stats) if stats else {}
        head, _, body = response.partition("\n\n")
        headers = dict(
            (name.lower(), value.strip())
            for line in head.splitlines()
            if ":" in line
            for name, value in [line.split(":", 1)]
        )
        return {
            "status": timing.get("http_code") or None,
            "content_type": headers.get("content-type", ""),
            "cf_ray": headers.get("cf-ray"),
            "cf_mitigated": headers.get("cf-mitigated"),
            "elapsed_ms": round(timing.get("time_total", 0) * 1000),
            "exit_code": result.returncode,
            "error": result.stderr.strip() or None,
            "body": body[:32768],
        }
    except (OSError, subprocess.TimeoutExpired, ValueError) as error:
        return {"status": None, "error": str(error)}


origin = os.environ.get("RETREAT_TEST_ORIGIN", "https://burning-tokens.transitivebullsh.it")
parsed = urllib.parse.urlsplit(origin)
if (parsed.scheme not in ("https", "http") or not parsed.netloc
        or parsed.username or parsed.password or parsed.query or parsed.fragment
        or parsed.path not in ("", "/")):
    raise SystemExit("RETREAT_TEST_ORIGIN must be an origin, never an invitation URL")
origin = origin.rstrip("/")
results = []
for client, fetch in [("default-python-urllib", python_get), ("default-curl", curl_get)]:
    for path, expected_type, marker in [
        ("/agent", "text/markdown", "# The gate · Burning Tokens"),
        ("/robots.txt", "text/plain", "Allow: /"),
    ]:
        result = fetch(origin + path)
        body = result.pop("body", "")
        result["passed"] = (
            result.get("status") == 200
            and expected_type in result.get("content_type", "")
            and marker in body
            and result.get("cf_mitigated") != "challenge"
            and not result.get("error")
        )
        result.update(client=client, path=path)
        if result["status"] is None:
            control = fetch("https://example.com")
            control.pop("body", None)
            result["network_control"] = control
        results.append(result)
print(json.dumps({"origin": origin, "checks": results}, indent=2))
sys.exit(0 if all(result["passed"] for result in results) else 1)
