#!/usr/bin/env python3
"""Bounded official-source collection. Archives and review queues, never publication."""
from __future__ import annotations

import argparse
import hashlib
import io
import ipaddress
import json
import re
import ssl
import subprocess
import sys
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from http.client import HTTPException
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urldefrag, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener

OFFICIAL_DOMAINS = {
    "mef": "finances.gov.ma", "tgr": "tgr.gov.ma", "bam": "bkam.ma",
    "hcp": "hcp.ma", "oc": "oc.gov.ma", "cour": "courdescomptes.ma",
    "opendata": "data.gov.ma", "imf": "imf.org", "worldbank": "worldbank.org",
}
FORMAT_MIME = {"pdf": "application/pdf", "csv": "text/csv", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
SAFE_HEADERS = {"content-type", "content-length", "last-modified", "etag", "date"}
MAX_MANIFEST_BYTES = 1024 * 1024
MAX_HTML_BYTES = 2 * 1024 * 1024
MAX_DOCUMENT_BYTES = 32 * 1024 * 1024


class CollectionError(ValueError):
    def __init__(self, message: str, status: int | None = None, headers: dict[str, str] | None = None):
        super().__init__(message)
        self.status = status
        self.headers = headers or {}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def safe_headers(headers: Any) -> dict[str, str]:
    return {str(key).lower(): str(value)[:2048] for key, value in headers.items() if str(key).lower() in SAFE_HEADERS}


def official_url(url: str, hosts: set[str]) -> str:
    if not isinstance(url, str) or len(url) > 4096 or re.search(r"[\x00-\x20\x7f]", url):
        raise CollectionError("Invalid URL")
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as error:
        raise CollectionError("Invalid URL port") from error
    if parsed.scheme != "https" or parsed.username or parsed.password or port not in (None, 443):
        raise CollectionError("Only unauthenticated HTTPS URLs on port 443 are permitted")
    if parsed.hostname not in hosts:
        raise CollectionError("URL or redirect is outside this source's explicit host allowlist")
    if any(key.lower() in {"token", "access_token", "api_key", "apikey", "authorization", "secret", "signature"} for key in parse_qs(parsed.query)):
        raise CollectionError("Authenticated query parameters are not permitted")
    return urldefrag(url)[0]


def read_json(path: Path, max_bytes: int = MAX_MANIFEST_BYTES) -> dict[str, Any]:
    if path.stat().st_size > max_bytes:
        raise CollectionError("JSON file exceeds its byte limit")
    contents = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(contents, dict):
        raise CollectionError("Manifest must be a JSON object")
    return contents


def bounded_int(value: Any, name: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise CollectionError(f"{name} must be between {minimum} and {maximum}")
    return value


def load_manifest(path: Path) -> dict[str, Any]:
    manifest = read_json(path)
    if manifest.get("schemaVersion") != 1:
        raise CollectionError("Unsupported collection manifest version")
    sources = manifest.get("sources")
    if not isinstance(sources, list) or not 1 <= len(sources) <= 9:
        raise CollectionError("Configure between 1 and 9 official sources")
    seen = set()
    for source in sources:
        if not isinstance(source, dict) or source.get("id") not in OFFICIAL_DOMAINS or source["id"] in seen:
            raise CollectionError("Unknown or duplicate official institution")
        seen.add(source["id"])
        domain = OFFICIAL_DOMAINS[source["id"]]
        hosts = source.get("allowedHosts")
        if not isinstance(hosts, list) or not 1 <= len(hosts) <= 10:
            raise CollectionError("Each source requires explicit allowedHosts")
        for host in hosts:
            if not isinstance(host, str) or not re.fullmatch(r"[a-z0-9.-]+", host) or not (host == domain or host.endswith("." + domain)):
                raise CollectionError("Host must be an exact hostname on the official institution domain")
            try:
                ipaddress.ip_address(host)
            except ValueError:
                pass
            else:
                raise CollectionError("IP destinations are forbidden")
        pages = source.get("landingPages", [])
        documents = source.get("documents", [])
        if not isinstance(pages, list) or not isinstance(documents, list) or len(pages) > 5 or len(documents) > 20 or not (pages or documents):
            raise CollectionError("Source requires at most 5 landing pages and/or 20 explicit document URLs")
        for page in pages:
            official_url(page, set(hosts))
        for document in documents:
            if not isinstance(document, dict) or document.get("format") not in FORMAT_MIME:
                raise CollectionError("Document requires a URL and format pdf/csv/xlsx")
            official_url(document.get("url"), set(hosts))
            mapping = document.get("extractionManifest")
            if mapping is not None:
                if not isinstance(mapping, str) or Path(mapping).is_absolute():
                    raise CollectionError("extractionManifest must be a relative path")
                resolved = (path.parent / mapping).resolve()
                if not resolved.is_relative_to(path.parent.resolve()) or not resolved.is_file():
                    raise CollectionError("Extraction manifest must exist inside the collection manifest directory")
        terms = source.get("discoveryTerms", [])
        if not isinstance(terms, list) or len(terms) > 40 or any(not isinstance(term, str) or not term or len(term) > 100 for term in terms):
            raise CollectionError("discoveryTerms must be a bounded list of explicit terms")
    limits = manifest.get("limits", {})
    if not isinstance(limits, dict):
        raise CollectionError("limits must be an object")
    manifest["limits"] = {
        "timeoutSeconds": bounded_int(limits.get("timeoutSeconds", 15), "timeoutSeconds", 1, 30),
        "maxPagesPerSource": bounded_int(limits.get("maxPagesPerSource", 3), "maxPagesPerSource", 1, 8),
        "maxDocumentsPerSource": bounded_int(limits.get("maxDocumentsPerSource", 3), "maxDocumentsPerSource", 1, 20),
        "maxDocumentBytes": bounded_int(limits.get("maxDocumentBytes", MAX_DOCUMENT_BYTES), "maxDocumentBytes", 1, MAX_DOCUMENT_BYTES),
        "workers": bounded_int(limits.get("workers", 3), "workers", 1, 4),
    }
    return manifest


class SafeRedirects(HTTPRedirectHandler):
    max_redirections = 5
    max_repeats = 2

    def __init__(self, hosts: set[str]):
        super().__init__()
        self.hosts = hosts

    def redirect_request(self, request: Request, response: Any, code: int, message: str, headers: Any, new_url: str) -> Request | None:
        official_url(new_url, self.hosts)
        return super().redirect_request(request, response, code, message, headers, new_url)


class NetworkFetcher:
    offline = False

    def fetch(self, url: str, hosts: set[str], max_bytes: int, timeout: int) -> dict[str, Any]:
        url = official_url(url, hosts)
        opener = build_opener(SafeRedirects(hosts), HTTPSHandler(context=ssl.create_default_context()))
        request = Request(url, headers={"User-Agent": "MarocEnChiffres-SourceCollector/1.0", "Accept-Encoding": "identity"})
        deadline = time.monotonic() + timeout
        try:
            with opener.open(request, timeout=timeout) as response:
                final_url = official_url(response.geturl(), hosts)
                status = response.status
                headers = safe_headers(response.headers)
                if response.headers.get("Content-Encoding", "identity").lower() not in ("", "identity"):
                    raise CollectionError("Compressed HTTP bodies are not accepted", status, headers)
                length = response.headers.get("Content-Length")
                if length and (not length.isdigit() or int(length) > max_bytes):
                    raise CollectionError("Response exceeds configured byte limit or has invalid length", status, headers)
                chunks: list[bytes] = []
                size = 0
                while True:
                    if time.monotonic() > deadline:
                        raise CollectionError("Response exceeded its elapsed-time deadline", status, headers)
                    # read1 performs one underlying buffered read. A slow-drip server
                    # cannot indefinitely extend a single read(max_bytes) operation.
                    chunk = response.read1(min(65536, max_bytes + 1 - size))
                    if time.monotonic() > deadline:
                        raise CollectionError("Response exceeded its elapsed-time deadline", status, headers)
                    if not chunk:
                        break
                    chunks.append(chunk)
                    size += len(chunk)
                    if size > max_bytes:
                        raise CollectionError("Response exceeds configured byte limit", status, headers)
                body = b"".join(chunks)
                if length and len(body) != int(length):
                    raise CollectionError("Response length differs from Content-Length", status, headers)
                if not 200 <= status < 300:
                    raise CollectionError(f"HTTP {status}", status, headers)
                return {"url": final_url, "status": status, "headers": headers, "body": body}
        except HTTPError as error:
            raise CollectionError(f"HTTP {error.code}", error.code, safe_headers(error.headers)) from error
        except URLError as error:
            detail = str(error.reason)[:300]
            # CONNECT 403 is a transport/proxy refusal, not a response from the institution.
            status = 403 if "403" in detail and "Tunnel connection" in detail else None
            raise CollectionError(f"HTTPS transport failed: {detail}", status) from error
        except (OSError, HTTPException) as error:
            raise CollectionError(f"HTTPS transport failed: {str(error)[:300]}") from error


class OfflineFetcher:
    offline = True

    def __init__(self, path: Path):
        self.root = path.parent.resolve()
        fixtures = read_json(path)
        self.responses = fixtures.get("responses")
        if not isinstance(self.responses, dict):
            raise CollectionError("Offline fixtures require a responses object")

    def fetch(self, url: str, hosts: set[str], max_bytes: int, timeout: int) -> dict[str, Any]:
        official_url(url, hosts)
        response = self.responses.get(url)
        if not isinstance(response, dict):
            raise CollectionError("Offline fixture missing; no network request performed")
        final_url = official_url(response.get("finalUrl", url), hosts)
        status = response.get("status", 200)
        headers = safe_headers(response.get("headers", {}))
        if not isinstance(status, int) or not 200 <= status < 300:
            raise CollectionError(f"Offline HTTP fixture {status}", status, headers)
        if ("bodyFile" in response) == ("bodyText" in response):
            raise CollectionError("Offline response requires exactly one bodyFile or bodyText")
        if "bodyFile" in response:
            path = (self.root / response["bodyFile"]).resolve()
            if not path.is_relative_to(self.root) or path.stat().st_size > max_bytes:
                raise CollectionError("Offline body path/size exceeds fixture bounds")
            body = path.read_bytes()
        else:
            body = response["bodyText"].encode("utf-8")
        if len(body) > max_bytes:
            raise CollectionError("Offline response exceeds configured byte limit", status, headers)
        return {"url": final_url, "status": status, "headers": headers, "body": body}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[dict[str, str]] = []
        self.current: dict[str, str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "a" and attributes.get("href") and len(self.links) < 200:
            self.current = {"href": attributes["href"] or "", "label": "", "type": attributes.get("type") or ""}
            self.links.append(self.current)

    def handle_data(self, data: str) -> None:
        if self.current is not None:
            self.current["label"] = (self.current["label"] + data)[:300]

    def handle_endtag(self, tag: str) -> None:
        if tag == "a":
            self.current = None


def document_format(url: str, label: str = "", mime: str = "") -> str | None:
    match = re.search(r"\.(pdf|csv|xlsx)(?:$|[?&#\s])", unquote(url), re.IGNORECASE)
    if match:
        return match.group(1).lower()
    for suffix, content_type in FORMAT_MIME.items():
        if mime.lower() == content_type or label.strip().lower().endswith("." + suffix):
            return suffix
    return None


def validate_document(body: bytes, format_name: str) -> None:
    if not body:
        raise CollectionError("Empty document")
    if format_name == "pdf":
        if not body.startswith(b"%PDF-"):
            raise CollectionError("Document does not have a PDF signature")
    elif format_name == "xlsx":
        try:
            with zipfile.ZipFile(io.BytesIO(body)) as archive:
                items = archive.infolist()
                if len(items) > 10000 or sum(item.file_size for item in items) > 100 * 1024 * 1024:
                    raise CollectionError("XLSX archive exceeds decompression limits")
                if not {"[Content_Types].xml", "xl/workbook.xml"}.issubset(archive.namelist()):
                    raise CollectionError("Document is not an XLSX workbook")
        except zipfile.BadZipFile as error:
            raise CollectionError("Document is not a valid XLSX container") from error
    elif format_name == "csv":
        try:
            text = body.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise CollectionError("CSV archive must be UTF-8; configure a reviewed conversion separately") from error
        if "\x00" in text or text.lstrip().lower().startswith(("<!doctype html", "<html", "<?xml")):
            raise CollectionError("Document is not a plain UTF-8 CSV")


def collect_source(source: dict[str, Any], limits: dict[str, int], fetcher: Any, output: Path, manifest_path: Path, extract: bool) -> dict[str, Any]:
    hosts = set(source["allowedHosts"])
    result: dict[str, Any] = {"sourceId": source["id"], "attempts": [], "discoveredLinks": [], "documents": [], "errors": []}
    visited: set[str] = set()
    document_urls: set[str] = set()
    documents = list(source.get("documents", []))
    pages = [(url, 0) for url in source.get("landingPages", [])]
    terms = [term.casefold() for term in source.get("discoveryTerms", [])]
    page_count = 0

    def fetch(url: str, kind: str, max_bytes: int) -> dict[str, Any] | None:
        attempt: dict[str, Any] = {"requestedUrl": url, "kind": kind, "attemptedAt": now(), "status": None, "headers": {}, "success": False}
        result["attempts"].append(attempt)
        try:
            response = fetcher.fetch(url, hosts, max_bytes, limits["timeoutSeconds"])
            attempt.update({"finalUrl": response["url"], "status": response["status"], "headers": response["headers"], "byteSize": len(response["body"]), "success": True})
            return response
        except (CollectionError, OSError, ValueError) as error:
            attempt.update({"status": getattr(error, "status", None), "headers": getattr(error, "headers", {}), "error": str(error)[:500]})
            result["errors"].append({"url": url, "phase": kind, "message": str(error)[:500]})
            return None

    while pages and page_count < limits["maxPagesPerSource"]:
        url, depth = pages.pop(0)
        if url in visited:
            continue
        visited.add(url)
        page_count += 1
        response = fetch(url, "landing_page", MAX_HTML_BYTES)
        if response is None:
            continue
        if "text/html" not in response["headers"].get("content-type", "").lower():
            result["errors"].append({"url": url, "phase": "discovery", "message": "Landing page was not served as HTML"})
            continue
        parser = LinkParser()
        parser.feed(response["body"].decode("utf-8", errors="replace"))
        for link in parser.links:
            try:
                target = official_url(urljoin(response["url"], link["href"]), hosts)
            except CollectionError:
                continue
            format_name = document_format(target, link["label"], link["type"])
            relevant = not terms or any(term in (unquote(target) + " " + link["label"]).casefold() for term in terms)
            if not relevant and not (depth == 1 and format_name):
                continue
            result["discoveredLinks"].append({"url": target, "label": link["label"].strip(), "fromPage": response["url"], "format": format_name, "reviewStatus": "unreviewed"})
            if format_name:
                documents.append({"url": target, "format": format_name})
            elif depth == 0 and target not in visited and len(pages) < 200:
                pages.append((target, 1))

    for document in documents:
        url = document["url"]
        if url in document_urls:
            continue
        document_urls.add(url)
        if len(document_urls) > limits["maxDocumentsPerSource"]:
            break
        response = fetch(url, "document", limits["maxDocumentBytes"])
        if response is None:
            continue
        try:
            validate_document(response["body"], document["format"])
        except CollectionError as error:
            result["errors"].append({"url": url, "phase": "document_validation", "message": str(error)})
            continue
        digest = hashlib.sha256(response["body"]).hexdigest()
        local = output / "raw" / f"{source['id']}-{digest[:24]}.{document['format']}"
        try:
            with local.open("xb") as handle:
                handle.write(response["body"])
        except FileExistsError:
            if hashlib.sha256(local.read_bytes()).hexdigest() != digest:
                raise CollectionError("Existing archive path has a different checksum")
        archived: dict[str, Any] = {
            "sourceId": source["id"], "requestedUrl": url, "finalUrl": response["url"],
            "retrievedAt": now(), "httpStatus": response["status"], "httpHeaders": response["headers"],
            "format": document["format"], "sha256": digest, "byteSize": len(response["body"]),
            "localPath": str(local.relative_to(output)), "origin": "offline_fixture" if fetcher.offline else "official_https_download",
            "authenticityVerified": False, "publicationDate": None, "reviewStatus": "pending_review",
            "extraction": {"status": "not_configured" if not document.get("extractionManifest") else "not_requested"},
        }
        result["documents"].append(archived)
        if extract and document.get("extractionManifest"):
            try:
                mapping_path = (manifest_path.parent / document["extractionManifest"]).resolve()
                mapping = read_json(mapping_path)
                metadata = mapping.get("document", {})
                if metadata.get("sourceId") != source["id"] or metadata.get("sourceUrl") not in (url, response["url"]):
                    raise CollectionError("Extraction mapping must cite this exact institution and document URL")
                job_path = output / "review" / f"{source['id']}-{digest[:24]}.json"
                script = Path(__file__).resolve().with_name("ingest.py")
                command = [sys.executable, str(script), "pdf" if document["format"] == "pdf" else "table", str(local), "--manifest", str(mapping_path), "--output", str(job_path)]
                process = subprocess.run(command, capture_output=True, text=True, timeout=60, check=False)
                if process.returncode != 0:
                    raise CollectionError((process.stderr or process.stdout or "Extraction failed")[:1000])
                job = read_json(job_path, 32 * 1024 * 1024)
                if job.get("status") != "pending_review" or any(candidate.get("validationStatus") != "pending_review" for candidate in job.get("candidates", [])):
                    raise CollectionError("Ingestion output breached the review-only boundary")
                archived["publicationDate"] = metadata.get("publicationDate")
                archived["extraction"] = {"status": "pending_review", "jobPath": str(job_path.relative_to(output)), "candidateCount": job.get("candidateCount", 0)}
            except (CollectionError, OSError, ValueError, subprocess.TimeoutExpired) as error:
                archived["extraction"] = {"status": "failed", "error": str(error)[:1000]}
                result["errors"].append({"url": url, "phase": "extraction", "message": str(error)[:1000]})
    result["available"] = any(attempt["success"] for attempt in result["attempts"])
    return result


def collect(manifest_path: Path, output: Path, fetcher: Any, extract: bool = False) -> tuple[dict[str, Any], int]:
    manifest_path = manifest_path.resolve()
    manifest = load_manifest(manifest_path)
    output.mkdir(parents=True, exist_ok=False)
    (output / "raw").mkdir()
    (output / "review").mkdir()
    started = now()
    with ThreadPoolExecutor(max_workers=manifest["limits"]["workers"]) as pool:
        results = list(pool.map(lambda source: collect_source(source, manifest["limits"], fetcher, output, manifest_path, extract), manifest["sources"]))
    available = sum(result["available"] for result in results)
    documents = sum(len(result["documents"]) for result in results)
    extraction_errors = sum(error["phase"] == "extraction" for result in results for error in result["errors"])
    errors = sum(len(result["errors"]) for result in results)
    if not available:
        status, exit_code = "all_sources_unavailable", 2
    elif not documents:
        status, exit_code = "no_documents_collected", 3
    elif extraction_errors:
        status, exit_code = "extraction_failed", 4
    else:
        status, exit_code = ("partial_collection" if errors else "documents_collected"), 0
    report = {
        "schemaVersion": 1, "startedAt": started, "finishedAt": now(), "status": status,
        "offlineFixtures": fetcher.offline, "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "availableSourceCount": available, "documentCount": documents, "errorCount": errors,
        "approvedObservationCount": 0, "publicationPerformed": False,
        "freshnessVerified": False, "sources": results,
        "reviewRequired": "Archives and extraction candidates require source, publication date, economic scope, units, period and value verification before approval. Offline fixtures are synthetic and cannot establish official facts.",
    }
    (output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report, exit_code


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("data/collection-manifest.json"))
    parser.add_argument("--output-dir", type=Path, required=True, help="New directory; never overwrites an existing run")
    parser.add_argument("--offline-fixtures", type=Path, help="Fixture responses JSON; completely disables network access")
    parser.add_argument("--extract", action="store_true", help="Run only explicitly configured mappings into pending_review jobs")
    arguments = parser.parse_args()
    try:
        fetcher = OfflineFetcher(arguments.offline_fixtures) if arguments.offline_fixtures else NetworkFetcher()
        report, code = collect(arguments.manifest, arguments.output_dir, fetcher, arguments.extract)
        print(json.dumps({"status": report["status"], "documentCount": report["documentCount"], "approvedObservationCount": 0, "report": str(arguments.output_dir / "report.json")}, ensure_ascii=False))
        return code
    except (CollectionError, OSError, ValueError) as error:
        print(f"Collection configuration failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
