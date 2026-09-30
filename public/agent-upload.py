#!/usr/bin/env python3
"""Prepare private multipart GET URLs locally. Performs no network requests."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import uuid
from urllib.parse import urlencode, urlsplit


def manifest(agent_url, file_path, audience="public", part_bytes=4096, key=None):
    url = urlsplit(agent_url)
    if (url.scheme not in ("https", "http") or not url.netloc or url.username
            or url.password or url.query or url.fragment
            or not re.fullmatch(r"/agent/start/[a-f0-9-]{36}\.[a-f0-9]{64}", url.path)):
        raise ValueError("Use the private /agent/start/ invitation URL without query parameters")
    if part_bytes not in (1024, 2048, 4096, 8192):
        raise ValueError("Part size must be 1024, 2048, 4096 or 8192 bytes")
    if audience not in ("private", "agents", "public"):
        raise ValueError("Audience must be private, agents or public")
    key = key or uuid.uuid4().hex
    if not re.fullmatch(r"[a-zA-Z0-9_-]{8,100}", key):
        raise ValueError("Key must contain 8–100 letters, digits, underscores or hyphens")
    with Path(file_path).open("rb") as source:
        data = source.read(2 * 1024 * 1024 + 1)
    if not data or len(data) > 2 * 1024 * 1024:
        raise ValueError("Use a nonempty file of at most 2 MiB; optimize images as JPEG or WebP first")
    if data.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        mime = "image/webp"
    elif data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Convert the PNG to an optimized JPEG or WebP before preparing the upload")
    else:
        data.decode("utf-8")
        if len(data) > 8000:
            raise ValueError("UTF-8 text must fit within 8,000 bytes")
        mime = "text/plain"

    def submit(intent, **params):
        result = agent_url + "/submit?" + urlencode(dict(intent=intent, confirm="1", key=key, **params))
        if len(result.encode()) > 12 * 1024:
            raise ValueError("URL exceeds 12 KiB; use a shorter origin or smaller parts")
        return result

    return {
        "key": key,
        "bytes": len(data),
        "mime": mime,
        "partBytes": part_bytes,
        "start": submit("upload-start", mime=mime, bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), partBytes=part_bytes, audience=audience),
        "status": agent_url + "/uploads/" + key,
        "parts": [submit("upload-part", part=offset // part_bytes, data=base64.urlsafe_b64encode(data[offset:offset + part_bytes]).decode().rstrip("=")) for offset in range(0, len(data), part_bytes)],
        "complete": submit("upload-complete"),
        "abort": submit("upload-abort")
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--agent-url", required=True, help="Private invitation URL")
    parser.add_argument("--file", required=True, help="Optimized JPEG/WebP or UTF-8 text")
    parser.add_argument("--output", required=True, help="New private manifest JSON file")
    parser.add_argument("--audience", choices=("private", "agents", "public"), default="public")
    parser.add_argument("--part-bytes", type=int, choices=(1024, 2048, 4096, 8192), default=4096)
    args = parser.parse_args()
    try:
        result = manifest(args.agent_url, args.file, args.audience, args.part_bytes)
        descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as output:
            json.dump(result, output, indent=2)
            output.write("\n")
    except (OSError, ValueError) as error:
        parser.exit(1, f"Cannot prepare upload: {error}\n")
    print(f"Prepared {len(result['parts'])} parts ({result['bytes']} bytes). No requests sent. Keep the manifest private.")


if __name__ == "__main__":
    main()
