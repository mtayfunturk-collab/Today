"""Package versioned, static Staging assets without using a working-tree checkout."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile
from zipfile import ZIP_DEFLATED, ZipFile

ASSETS = [
    "index.html", "backup.html", "sw.js", "manifest.json", "nutrition-unit-rules.json",
    "today-icon-v9-192.png", "today-icon-v9-512.png", "apple-touch-icon-v9.png",
    "modules", "assets", "vendor", "data", "contracts", "Today-AI-Engine/src",
]
HEADERS = """/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/candidate.json
  Cache-Control: no-cache
"""


def package(commit, destination):
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Provide a full commit SHA")
    data = subprocess.check_output(["git", "archive", commit, "--", *ASSETS])
    with tarfile.open(fileobj=io.BytesIO(data)) as source:
        files = {}
        for member in source:
            if member.isdir():
                continue
            if (not member.isfile() or member.size > 25 * 1024 * 1024
                    or any(part.startswith(".") for part in member.name.split("/"))):
                raise ValueError(f"Invalid Staging asset: {member.name}")
            files[member.name] = source.extractfile(member).read()

    worker = files["sw.js"].decode()
    revision = re.search(r'const VERSION = "today-v2-(foundation-\d+)";', worker)[1]
    shell = json.loads(re.search(r"const APP_SHELL = (\[[\s\S]+?\]);", worker)[1])
    missing = [name for name in shell if name != "./" and name.removeprefix("./") not in files]
    if missing:
        raise ValueError(f"Missing Service Worker assets: {missing}")
    files["candidate.json"] = (json.dumps({"commit": commit, "worker": revision,
                                           "purpose": "isolated-staging-acceptance"}) + "\n").encode()
    files["_headers"] = HEADERS.encode()
    if len(files) > 1000:
        raise ValueError("Direct Upload dashboard limit exceeded")

    destination.mkdir(parents=True, exist_ok=True)
    archive_path = destination / f"today-staging-worker{revision.split('-')[1]}-{commit[:7]}.zip"
    with ZipFile(archive_path, "w", compression=ZIP_DEFLATED) as archive:
        for name, content in sorted(files.items()):
            archive.writestr(name, content)
    with ZipFile(archive_path) as archive:
        if archive.testzip() is not None:
            raise ValueError("Staging ZIP integrity check failed")
    print(archive_path, len(files), f"shell {len(shell)}/{len(shell)}", hashlib.sha256(archive_path.read_bytes()).hexdigest())


if __name__ == "__main__":
    args = argparse.ArgumentParser()
    args.add_argument("commit")
    args.add_argument("destination", type=Path)
    options = args.parse_args()
    package(options.commit, options.destination)
