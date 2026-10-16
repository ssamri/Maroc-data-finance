"""Synthetic fixtures test the extraction boundary; none are published observations."""
import csv
import hashlib
import importlib.util
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import ingest


class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.manifest = {
            "document": {
                "sourceId": "mef",
                "sourceUrl": "https://www.finances.gov.ma/synthetic-test-only.pdf",
                "title": "Synthetic unit-test document (not official data)",
                "publicationDate": "2025-06-01",
            }
        }
        self.row = {
            "indicatorId": "debt_treasury", "exactValue": "1 234,50", "unit": "MAD",
            "scale": "1000000", "scope": "treasury", "period": "2024",
            "referenceDate": "2024-12-31", "status": "observed",
        }

    def tearDown(self):
        self.directory.cleanup()

    def csv_file(self, rows=None):
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=list(self.row))
        writer.writeheader()
        writer.writerows(rows or [self.row])
        path = self.root / "synthetic.csv"
        path.write_text(output.getvalue(), encoding="utf-8")
        return path

    def test_csv_preserves_exact_decimal_provenance_and_requires_review(self):
        path = self.csv_file()
        job = ingest.extract(path, self.manifest, "table")
        row = job["candidates"][0]
        self.assertEqual(row["exactValue"], "1234.50")
        self.assertEqual(row["provenance"]["originalValue"], "1 234,50")
        self.assertEqual(row["validationStatus"], "pending_review")
        self.assertEqual(job["document"]["sha256"], hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertFalse(job["document"]["authenticityVerified"])
        self.assertEqual(row["documentLocator"], "CSV row 2")

    def test_rejects_ambiguous_numeric_separators(self):
        with self.assertRaises(ingest.IngestionError):
            ingest.normalize_decimal("1,234.50")

    def test_rejects_incomparable_economic_scope(self):
        self.row["scope"] = "general_government"
        with self.assertRaisesRegex(ingest.IngestionError, "requires unit"):
            ingest.extract(self.csv_file(), self.manifest, "table")

    def test_forecasts_cannot_enter_observation_imports(self):
        self.row["status"] = "forecast"
        with self.assertRaisesRegex(ingest.IngestionError, "observed or provisional"):
            ingest.extract(self.csv_file(), self.manifest, "table")

    def test_rejects_nonofficial_and_insecure_urls(self):
        for url in ("https://finances.gov.ma.attacker.test/a", "http://finances.gov.ma/a", "https://user:secret@finances.gov.ma/a"):
            self.manifest["document"]["sourceUrl"] = url
            with self.subTest(url=url), self.assertRaises(ingest.IngestionError):
                ingest.extract(self.csv_file(), self.manifest, "table")

    def test_rejects_checksum_mismatch(self):
        self.manifest["document"]["expectedSha256"] = "0" * 64
        with self.assertRaisesRegex(ingest.IngestionError, "SHA-256"):
            ingest.extract(self.csv_file(), self.manifest, "table")

    def test_rejects_duplicates_and_impossible_dates(self):
        with self.assertRaisesRegex(ingest.IngestionError, "Duplicate"):
            ingest.extract(self.csv_file([self.row, self.row]), self.manifest, "table")
        self.row["referenceDate"] = "2024-02-30"
        with self.assertRaisesRegex(ingest.IngestionError, "Invalid referenceDate"):
            ingest.extract(self.csv_file(), self.manifest, "table")

    def test_cli_does_not_overwrite_existing_outputs(self):
        path = self.csv_file()
        manifest = self.root / "manifest.json"
        manifest.write_text(json.dumps(self.manifest), encoding="utf-8")
        output = self.root / "existing.json"
        output.write_text("preserve", encoding="utf-8")
        result = subprocess.run([sys.executable, str(Path(ingest.__file__)), "table", str(path),
                                 "--manifest", str(manifest), "--output", str(output)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(output.read_text(), "preserve")

    @unittest.skipUnless(importlib.util.find_spec("openpyxl"), "Optional openpyxl package not installed")
    def test_xlsx_extracts_values_and_rejects_formulas(self):
        import openpyxl
        book = openpyxl.Workbook()
        sheet = book.active
        sheet.title = "Test"
        sheet.append(list(self.row))
        sheet.append(list(self.row.values()))
        path = self.root / "synthetic.xlsx"
        book.save(path)
        self.manifest["sheet"] = "Test"
        job = ingest.extract(path, self.manifest, "table")
        self.assertEqual(job["candidates"][0]["exactValue"], "1234.50")
        sheet.cell(2, 2).value = "=1+2"
        book.save(path)
        book.close()
        with self.assertRaisesRegex(ingest.IngestionError, "Formula cells"):
            ingest.extract(path, self.manifest, "table")

    @unittest.skipUnless(importlib.util.find_spec("pypdf"), "Optional pypdf package not installed")
    def test_pdf_explicit_mapping_and_ambiguous_match_rejection(self):
        from pypdf import PdfWriter
        from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
        writer = PdfWriter()
        page = writer.add_blank_page(width=600, height=800)
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"),
                                 NameObject("/Subtype"): NameObject("/Type1"),
                                 NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
        stream = DecodedStreamObject()
        stream.set_data(b"BT /F1 12 Tf 30 700 Td (Synthetic Debt: 1234.50) Tj ET")
        page[NameObject("/Contents")] = stream
        path = self.root / "synthetic.pdf"
        with path.open("wb") as output:
            writer.write(output)
        mapping = {**self.row, "documentPage": 1, "pattern": r"Debt: (?P<value>\d+\.\d+)"}
        mapping.pop("exactValue")
        self.manifest["entries"] = [mapping]
        job = ingest.extract(path, self.manifest, "pdf")
        self.assertEqual(job["candidates"][0]["exactValue"], "1234.50")
        self.assertEqual(job["candidates"][0]["documentPage"], 1)
        self.assertIn("Synthetic Debt", job["candidates"][0]["provenance"]["excerpt"])
        self.manifest["entries"][0]["pattern"] = r"(?P<value>\d+)"
        with self.assertRaisesRegex(ingest.IngestionError, "unambiguous"):
            ingest.extract(path, self.manifest, "pdf")


if __name__ == "__main__":
    unittest.main()
