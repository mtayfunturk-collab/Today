import importlib.util
import json
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    "verify_staging", Path(__file__).resolve().parents[1] / "scripts/verify-staging.py"
)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)

SHA = "a" * 40
OLD = "https://eeeeeeee.today-ai-staging.pages.dev"
NEW = "https://ffffffff.today-ai-staging.pages.dev"
LOGIN = "https://" + verify.LOGIN_HOST + "/cdn-cgi/access/login"
MANIFEST = json.dumps({"commit": SHA, "worker": "foundation-115",
                       "purpose": "isolated-staging-acceptance"}).encode() + b"\n"
WORKER = b'const VERSION = "today-v2-foundation-115";\n'


def project(url, identifier, commit=SHA):
    return {"production_branch": "main", "canonical_deployment": {
        "id": identifier, "url": url, "deployment_trigger": {"metadata": {"commit_hash": commit}}
    }}


class StagingVerification(unittest.TestCase):
    def setUp(self):
        tmp = TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.state = self.root / "previous.json"
        self.summary = self.root / "summary"
        self.output = self.root / "output"
        (self.root / "candidate.json").write_bytes(MANIFEST)
        (self.root / "sw.js").write_bytes(WORKER)
        self.env = {"STAGING_ACCESS_CLIENT_ID": "staging-id",
                    "STAGING_ACCESS_CLIENT_SECRET": "staging-secret",
                    "GITHUB_OUTPUT": str(self.output), "GITHUB_STEP_SUMMARY": str(self.summary)}
        self.urls = []

    def response(self, url, headers, limit=0):
        self.urls.append(url)
        if not headers:
            return 302, LOGIN, b""
        self.assertIn("CF-Access-Client-Secret", headers)
        self.assertTrue(url.startswith((verify.STAGING + "/", OLD + "/", NEW + "/")))
        return 200, None, MANIFEST if url.endswith("/candidate.json") else WORKER

    def run_phase(self, phase, pages, responder=None):
        with patch.dict(os.environ, self.env, clear=True), patch.object(
            sys, "argv", ["verify-staging.py", phase, "--state", str(self.state),
                          "--site", str(self.root), "--commit", SHA]
        ), patch.object(verify, "get_project", return_value=pages), patch.object(
            verify, "request", side_effect=responder or self.response
        ), patch.object(verify.time, "sleep"):
            verify.main()

    def test_preflight_discovers_previous_url_then_verifies_new_url_and_stable_host(self):
        self.run_phase("preflight", project(OLD, "old-deployment"))
        self.assertEqual(self.output.read_text(), "branch=main\n")
        self.assertIn(OLD + "/candidate.json", self.urls)
        self.urls.clear()
        self.run_phase("verify", project(NEW, "new-deployment"))
        self.assertIn(NEW + "/sw.js", self.urls)
        self.assertIn(verify.STAGING + "/sw.js", self.urls)
        self.assertIn(NEW, self.summary.read_text())

    def test_missing_service_credentials_stop_preflight(self):
        del self.env["STAGING_ACCESS_CLIENT_SECRET"]
        with self.assertRaisesRegex(verify.VerificationError, "before upload"):
            self.run_phase("preflight", project(OLD, "old-deployment"))
        self.assertEqual(self.urls, [])

    def test_public_generic_denial_and_wrong_login_cannot_count_as_access(self):
        for response in ((200, None, b""), (403, None, b""),
                         (302, "https://other.cloudflareaccess.com/", b"")):
            with self.subTest(response=response), patch.object(verify, "request", return_value=response):
                with self.assertRaisesRegex(verify.VerificationError, "Expected Cloudflare Access"):
                    verify.check_protection(verify.STAGING)

    def test_discovery_and_authorized_request_reject_external_origins(self):
        bad = "https://today-ai-staging.pages.dev.other.example"
        with self.assertRaises(verify.VerificationError):
            verify.deployment(project(bad, "other"))
        with patch.object(verify, "request") as req:
            with self.assertRaises(verify.VerificationError):
                verify.get_protected(bad, "/candidate.json", self.env, 4096)
            req.assert_not_called()

    def test_failed_postflight_never_reports_verified(self):
        self.run_phase("preflight", project(OLD, "old-deployment"))
        with self.assertRaisesRegex(verify.VerificationError, "different branch or commit"):
            self.run_phase("verify", project(NEW, "new-deployment", "b" * 40))

        for asset in ("/candidate.json", "/sw.js"):
            def changed(url, headers, limit=0):
                status, location, body = self.response(url, headers, limit)
                return status, location, b" " + body[1:] if headers and url.endswith(asset) else body

            with self.subTest(asset=asset), self.assertRaisesRegex(verify.VerificationError, "does not match"):
                self.run_phase("verify", project(NEW, "new-deployment"), changed)
        self.assertFalse(self.summary.exists())

    def test_same_deployment_never_counts_as_a_new_deployment(self):
        current = project(OLD, "old-deployment")
        self.run_phase("preflight", current)
        with self.assertRaisesRegex(verify.VerificationError, "did not report a new"):
            self.run_phase("verify", current)
        self.assertFalse(self.summary.exists())


if __name__ == "__main__":
    unittest.main()
