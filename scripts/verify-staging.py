"""Verify Today Staging via Cloudflare Pages metadata and protected HTTP responses."""
import argparse
import json
import os
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

STAGING = "https://today-ai-staging.pages.dev"
PROJECT = "today-ai-staging"
LOGIN_HOST = "today-ai-staging-pages.cloudflareaccess.com"
ROUTES = ("/", "/index.html", "/sw.js", "/candidate.json")
SHA = r"[a-f0-9]{40}"
WORKER = r"foundation-\d+"
HASH_URL = r"https://[a-f0-9]{8}\.today-ai-staging\.pages\.dev/?"


class VerificationError(ValueError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(url, headers, limit=0):
    # Pages Browser Integrity Check blocks some default library user agents.
    req = Request(url, headers={"User-Agent": "Today-Staging-CI/1.0", **headers})
    try:
        with build_opener(NoRedirect()).open(req, timeout=15) as response:
            return response.status, response.headers.get("Location"), response.read(limit + 1) if limit else b""
    except HTTPError as error:
        with error:
            return error.code, error.headers.get("Location"), b""
    except (URLError, TimeoutError, OSError):
        raise VerificationError("HTTP request did not complete") from None


def get_project(account, api_token):
    if not re.fullmatch(r"[a-f0-9]{32}", account) or not api_token:
        raise VerificationError("Staging Pages API credentials are missing or invalid")
    endpoint = f"https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/{PROJECT}"
    status, _, raw = request(endpoint, {"Authorization": "Bearer " + api_token}, 1_048_576)
    if status != 200:
        raise VerificationError(f"Staging Pages API returned HTTP {status}")
    response = json.loads(raw)
    project = response.get("result") or {}
    if response.get("success") is not True or project.get("subdomain") != STAGING.removeprefix("https://"):
        raise VerificationError("Pages project does not match Today Staging")
    return project


def deployment(project):
    branch = project.get("production_branch", "")
    record = project.get("canonical_deployment") or {}
    identifier = record.get("id", "")
    url = record.get("url", "")
    metadata = (record.get("deployment_trigger") or {}).get("metadata") or {}
    if (not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9/_.-]{0,127}", branch)
            or not re.fullmatch(r"[A-Za-z0-9-]{1,64}", identifier)
            or not re.fullmatch(HASH_URL, url)):
        raise VerificationError("Invalid current Staging branch or deployment address")
    return {"branch": branch, "id": identifier, "url": url.rstrip("/"),
            "commit": metadata.get("commit_hash")}


def check_protection(origin):
    for route in ROUTES:
        status, location, _ = request(origin + route, {})
        login = urlsplit(location or "")
        if status not in {302, 303, 307, 308} or login.scheme != "https" or login.netloc != LOGIN_HOST:
            raise VerificationError(f"Expected Cloudflare Access redirect at {origin}{route} (HTTP {status})")


def get_protected(origin, route, headers, limit):
    if origin != STAGING and not re.fullmatch(HASH_URL, origin):
        raise VerificationError("Blocked a request outside Today Staging")
    status, _, body = request(origin + route, {**headers, "Cache-Control": "no-cache"}, limit)
    if status != 200 or len(body) > limit:
        raise VerificationError(f"Authorized request failed at {origin}{route} (HTTP {status})")
    return body


def manifest(raw):
    value = json.loads(raw)
    if (not isinstance(value, dict) or not re.fullmatch(SHA, value.get("commit", ""))
            or not re.fullmatch(WORKER, value.get("worker", ""))
            or value.get("purpose") != "isolated-staging-acceptance"):
        raise VerificationError("Invalid Staging candidate metadata")
    return value


def verify_assets(origin, headers, expected_manifest, expected_worker):
    if get_protected(origin, "/candidate.json", headers, 4096) != expected_manifest:
        raise VerificationError(f"Published candidate.json does not match the package at {origin}")
    if get_protected(origin, "/sw.js", headers, len(expected_worker)) != expected_worker:
        raise VerificationError(f"Published Service Worker does not match the package at {origin}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("preflight", "verify"))
    parser.add_argument("--state", required=True, type=Path)
    parser.add_argument("--site", required=True, type=Path)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()

    client_id = os.getenv("STAGING_ACCESS_CLIENT_ID", "")
    client_secret = os.getenv("STAGING_ACCESS_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise VerificationError("Configure Today Staging Access service credentials before upload")
    headers = {"CF-Access-Client-Id": client_id, "CF-Access-Client-Secret": client_secret}
    account = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
    api_token = os.getenv("CLOUDFLARE_API_TOKEN", "")
    raw = (args.site / "candidate.json").read_bytes()
    worker = (args.site / "sw.js").read_bytes()
    expected = manifest(raw)
    version = re.search(rb'const VERSION = "today-v2-(foundation-\d+)";', worker)
    if expected["commit"] != args.commit or not version or version[1].decode() != expected["worker"]:
        raise VerificationError("Packaged candidate SHA or Worker version differs from the requested candidate")

    if args.phase == "preflight":
        current = deployment(get_project(account, api_token))
        for origin in (STAGING, current["url"]):
            check_protection(origin)
            manifest(get_protected(origin, "/candidate.json", headers, 4096))
        args.state.write_text(json.dumps(current), encoding="utf-8")
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            print(f'branch={current["branch"]}', file=output)
        print("Existing Staging addresses are protected and accessible to the Staging service token")
        return

    previous = json.loads(args.state.read_text(encoding="utf-8"))
    for attempt in range(10):
        current = deployment(get_project(account, api_token))
        if current["id"] != previous["id"]:
            break
        if attempt < 9:
            time.sleep(5)
    else:
        raise VerificationError("Cloudflare Pages did not report a new Staging deployment")
    if current["branch"] != previous["branch"] or current["commit"] != args.commit:
        raise VerificationError("Cloudflare Pages reported a different branch or commit")
    for origin in (STAGING, current["url"]):
        check_protection(origin)
        verify_assets(origin, headers, raw, worker)

    summary = (f'Verified Today Staging: [{current["url"]}]({current["url"]})\n\n'
               f'Commit: `{expected["commit"]}` · Worker: `{expected["worker"]}`\n\n'
               'Cloudflare Access protected both origins. Published candidate.json and sw.js '
               'matched the approved package byte for byte.')
    print(summary)
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
        print(summary, file=output)


if __name__ == "__main__":
    try:
        main()
    except (VerificationError, ValueError, AttributeError, TypeError, OSError) as error:
        # Never print remote bodies, headers, credentials or raw parser exceptions.
        message = str(error) if isinstance(error, VerificationError) else "Staging verification input is invalid"
        raise SystemExit(message) from None
