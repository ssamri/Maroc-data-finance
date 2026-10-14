"""Offline, synthetic source fixtures; never official or approved observations."""
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch
from urllib.error import URLError
from urllib.request import Request

import collect_sources as collector


class CollectionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.home = "https://www.finances.gov.ma/"
        self.document = "https://www.finances.gov.ma/synthetic-test-only.csv"
        self.manifest = {
            "schemaVersion": 1,
            "limits": {"workers": 1, "maxPagesPerSource": 3, "maxDocumentsPerSource": 2},
            "sources": [{"id": "mef", "allowedHosts": ["www.finances.gov.ma"], "landingPages": [self.home], "documents": [], "discoveryTerms": ["dette"]}],
        }
        self.csv = "indicatorId,exactValue,unit,scale,scope,period,referenceDate,status\ndebt_treasury,1234.50,MAD,1000000,treasury,2024,2024-12-31,observed\n"
        self.responses = {
            self.home: {"headers": {"Content-Type": "text/html"}, "bodyText": '<a href="/synthetic-test-only.csv">Dette (synthetic test)</a>'},
            self.document: {"headers": {"Content-Type": "text/csv", "ETag": '"test-only"', "Authorization": "must-not-be-recorded"}, "bodyText": self.csv},
        }
        self.run_number = 0

    def tearDown(self):
        self.directory.cleanup()

    def run_collection(self, extract=False):
        self.run_number += 1
        manifest_path = self.root / "collection.json"
        manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        fixtures = self.root / "fixtures.json"
        fixtures.write_text(json.dumps({"responses": self.responses}), encoding="utf-8")
        output = self.root / f"run-{self.run_number}"
        with patch.object(collector.NetworkFetcher, "fetch", side_effect=AssertionError("Offline mode attempted network")):
            report, code = collector.collect(manifest_path, output, collector.OfflineFetcher(fixtures), extract)
        return report, code, output

    def test_archives_sha256_and_http_provenance_without_claiming_approval_or_freshness(self):
        report, code, output = self.run_collection()
        self.assertEqual(code, 0)
        self.assertEqual(report["documentCount"], 1)
        document = report["sources"][0]["documents"][0]
        self.assertEqual(document["sha256"], hashlib.sha256(self.csv.encode()).hexdigest())
        self.assertEqual((output / document["localPath"]).read_text(), self.csv)
        self.assertEqual(document["httpStatus"], 200)
        self.assertEqual(document["httpHeaders"]["etag"], '"test-only"')
        self.assertNotIn("authorization", document["httpHeaders"])
        self.assertEqual(document["origin"], "offline_fixture")
        self.assertIsNone(document["publicationDate"])
        self.assertEqual(document["reviewStatus"], "pending_review")
        self.assertFalse(document["authenticityVerified"])
        self.assertEqual(report["approvedObservationCount"], 0)
        self.assertFalse(report["publicationPerformed"])
        self.assertFalse(report["freshnessVerified"])
        self.assertTrue((output / "report.json").exists())

    def test_crawls_only_one_level_and_ignores_external_and_third_level_links(self):
        landing = self.home + "dette"
        self.responses[self.home]["bodyText"] = '<a href="/dette">Dette</a><a href="https://example.org/dette.pdf">Dette</a>'
        self.responses[landing] = {"headers": {"Content-Type": "text/html"}, "bodyText": '<a href="/synthetic-test-only.csv">Download</a><a href="/dette/level-two">Dette</a>'}
        report, code, _ = self.run_collection()
        self.assertEqual(code, 0)
        urls = [attempt["requestedUrl"] for attempt in report["sources"][0]["attempts"]]
        self.assertEqual(urls, [self.home, landing, self.document])

    def test_all_unavailable_is_failure_with_report_and_actual_status(self):
        self.responses = {self.home: {"status": 403}}
        report, code, output = self.run_collection()
        self.assertEqual(code, 2)
        self.assertEqual(report["status"], "all_sources_unavailable")
        self.assertEqual(report["documentCount"], 0)
        self.assertEqual(report["sources"][0]["attempts"][0]["status"], 403)
        self.assertTrue((output / "report.json").exists())

    def test_accessible_homepage_without_document_is_not_collection_success(self):
        self.responses[self.home]["bodyText"] = "<html>Home without document links</html>"
        report, code, _ = self.run_collection()
        self.assertEqual(code, 3)
        self.assertEqual(report["status"], "no_documents_collected")
        self.assertEqual(report["availableSourceCount"], 1)

    def test_partial_source_failure_retains_useful_documents_and_warning(self):
        self.manifest["sources"].append({"id": "tgr", "allowedHosts": ["www.tgr.gov.ma"], "landingPages": ["https://www.tgr.gov.ma/"], "documents": []})
        self.responses["https://www.tgr.gov.ma/"] = {"status": 503}
        report, code, _ = self.run_collection()
        self.assertEqual(code, 0)
        self.assertEqual(report["status"], "partial_collection")
        self.assertEqual(report["documentCount"], 1)
        self.assertEqual(report["errorCount"], 1)

    def test_byte_bounds_and_document_signatures_reject_unusable_payloads(self):
        self.manifest["limits"]["maxDocumentBytes"] = 10
        report, code, _ = self.run_collection()
        self.assertEqual(code, 3)
        self.assertIn("byte limit", report["sources"][0]["errors"][0]["message"])
        self.manifest["limits"].pop("maxDocumentBytes")
        pdf = self.home + "dette.pdf"
        self.responses[self.home]["bodyText"] = '<a href="/dette.pdf">Dette</a>'
        self.responses[pdf] = {"headers": {"Content-Type": "application/pdf"}, "bodyText": "<html>Captcha is not a PDF</html>"}
        report, code, _ = self.run_collection()
        self.assertEqual(code, 3)
        self.assertIn("PDF signature", report["sources"][0]["errors"][0]["message"])

    def test_document_attempts_are_capped_even_when_many_links_exist(self):
        self.responses[self.home]["bodyText"] = "".join(f'<a href="/dette-{number}.csv">Dette</a>' for number in range(10))
        for number in range(10):
            self.responses[self.home + f"dette-{number}.csv"] = self.responses[self.document]
        report, code, _ = self.run_collection()
        self.assertEqual(code, 0)
        self.assertEqual(report["documentCount"], 2)
        self.assertEqual(len(report["sources"][0]["discoveredLinks"]), 10)

    def test_explicit_extraction_mapping_produces_pending_review_only(self):
        mapping = {"document": {"sourceId": "mef", "sourceUrl": self.document, "title": "Synthetic fixture only", "publicationDate": "2025-01-01"}}
        (self.root / "mapping.json").write_text(json.dumps(mapping), encoding="utf-8")
        self.manifest["sources"][0]["documents"] = [{"url": self.document, "format": "csv", "extractionManifest": "mapping.json"}]
        report, code, output = self.run_collection(extract=True)
        self.assertEqual(code, 0)
        extracted = report["sources"][0]["documents"][0]["extraction"]
        self.assertEqual(extracted["status"], "pending_review")
        job = json.loads((output / extracted["jobPath"]).read_text())
        self.assertEqual(job["candidates"][0]["exactValue"], "1234.50")
        self.assertEqual(job["candidates"][0]["validationStatus"], "pending_review")
        self.assertFalse(job["document"]["authenticityVerified"])

    def test_failed_configured_checksum_keeps_archive_and_fails_extraction(self):
        mapping = {"document": {"sourceId": "mef", "sourceUrl": self.document, "title": "Synthetic fixture only", "publicationDate": "2025-01-01", "expectedSha256": "0" * 64}}
        (self.root / "mapping.json").write_text(json.dumps(mapping), encoding="utf-8")
        self.manifest["sources"][0]["documents"] = [{"url": self.document, "format": "csv", "extractionManifest": "mapping.json"}]
        report, code, output = self.run_collection(extract=True)
        self.assertEqual(code, 4)
        self.assertEqual(report["status"], "extraction_failed")
        document = report["sources"][0]["documents"][0]
        self.assertEqual(document["extraction"]["status"], "failed")
        self.assertTrue((output / document["localPath"]).exists())

    def test_rejects_downgrade_authentication_cross_host_and_redirects(self):
        hosts = {"www.finances.gov.ma"}
        for url in ["http://www.finances.gov.ma/a.pdf", "https://evil.example/a.pdf", "https://user:password@www.finances.gov.ma/a.pdf", "https://www.finances.gov.ma:8443/a.pdf", "https://www.finances.gov.ma/a.pdf?token=secret", "https://[bad"]:
            with self.subTest(url=url), self.assertRaises(collector.CollectionError):
                collector.official_url(url, hosts)
        with self.assertRaises(collector.CollectionError):
            collector.SafeRedirects(hosts).redirect_request(Request(self.home), None, 302, "redirect", {}, "https://evil.example/a.pdf")

    def test_proxy_refusal_is_recorded_without_disabling_tls(self):
        opener = Mock()
        opener.open.side_effect = URLError("Tunnel connection failed: 403 Forbidden")
        with patch.object(collector, "build_opener", return_value=opener), patch.object(collector.ssl, "create_default_context", wraps=collector.ssl.create_default_context) as trust:
            with self.assertRaises(collector.CollectionError) as raised:
                collector.NetworkFetcher().fetch(self.home, {"www.finances.gov.ma"}, 100, 1)
        self.assertEqual(raised.exception.status, 403)
        trust.assert_called_once()
        self.assertIn("transport failed", str(raised.exception))

    def test_network_reader_rejects_truncation_size_overflow_and_slow_drip(self):
        for failure in ["truncation", "size", "deadline"]:
            response = Mock()
            response.status = 200
            response.geturl.return_value = self.home
            response.headers = {"Content-Type": "text/csv", "Content-Length": "5"} if failure == "truncation" else {"Content-Type": "text/csv"}
            response.read1.side_effect = [b"123", b""]
            opener = MagicMock()
            opener.open.return_value.__enter__.return_value = response
            clock = [0, 0, 16] if failure == "deadline" else [0, 0, 0, 0, 0]
            with self.subTest(failure=failure), patch.object(collector, "build_opener", return_value=opener), patch.object(collector.time, "monotonic", side_effect=clock):
                with self.assertRaises(collector.CollectionError) as raised:
                    collector.NetworkFetcher().fetch(self.home, {"www.finances.gov.ma"}, 2 if failure == "size" else 100, 15)
                self.assertEqual(raised.exception.status, 200)


    def test_existing_output_is_never_overwritten(self):
        _, _, output = self.run_collection()
        original = (output / "report.json").read_bytes()
        with self.assertRaises(FileExistsError):
            collector.collect(self.root / "collection.json", output, collector.OfflineFetcher(self.root / "fixtures.json"))
        self.assertEqual((output / "report.json").read_bytes(), original)

    def test_manifest_rejects_unofficial_hosts_unbounded_limits_and_mapping_escape(self):
        for modification in ["host", "limit", "mapping"]:
            invalid = copy.deepcopy(self.manifest)
            if modification == "host":
                invalid["sources"][0]["allowedHosts"] = ["evil.example"]
            elif modification == "limit":
                invalid["limits"]["timeoutSeconds"] = 1000
            else:
                invalid["sources"][0]["documents"] = [{"url": self.document, "format": "csv", "extractionManifest": "../outside.json"}]
            path = self.root / "invalid.json"
            path.write_text(json.dumps(invalid), encoding="utf-8")
            with self.subTest(modification=modification), self.assertRaises(collector.CollectionError):
                collector.load_manifest(path)


if __name__ == "__main__":
    unittest.main()
