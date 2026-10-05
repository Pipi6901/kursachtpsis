import datetime as dt
import ipaddress
import os
import ssl
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import serialization
from cryptography.x509.oid import ExtendedKeyUsageOID

import make_certs as mc


def test_certificate_contents(tmp_path: Path):
    cert_path, key_path = mc.generate(tmp_path, hosts=["ml.example.org", "10.0.0.5"], days=30)
    cert = x509.load_pem_x509_certificate(cert_path.read_bytes())
    san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
    assert "localhost" in san.get_values_for_type(x509.DNSName)
    assert "ml.example.org" in san.get_values_for_type(x509.DNSName)
    ips = san.get_values_for_type(x509.IPAddress)
    assert ipaddress.ip_address("127.0.0.1") in ips and ipaddress.ip_address("10.0.0.5") in ips
    assert cert.extensions.get_extension_for_class(x509.BasicConstraints).value.ca is False
    eku = cert.extensions.get_extension_for_class(x509.ExtendedKeyUsage).value
    assert ExtendedKeyUsageOID.SERVER_AUTH in eku
    lifetime = cert.not_valid_after_utc - cert.not_valid_before_utc
    assert dt.timedelta(days=29) < lifetime < dt.timedelta(days=31)
    key = serialization.load_pem_private_key(key_path.read_bytes(), password=None)
    assert key.public_key().public_numbers() == cert.public_key().public_numbers()
    assert key.key_size == 2048


@pytest.mark.skipif(os.name == "nt", reason="права доступа POSIX")
def test_private_key_is_owner_only(tmp_path: Path):
    _, key_path = mc.generate(tmp_path)
    assert (key_path.stat().st_mode & 0o077) == 0


def test_certificates_are_unique(tmp_path: Path):
    first, _ = mc.generate(tmp_path / "a")
    second, _ = mc.generate(tmp_path / "b")
    assert first.read_bytes() != second.read_bytes()


def test_https_server_with_generated_certificate(tmp_path: Path):
    """Сертификат действительно принимается TLS-клиентом по имени localhost и не принимается без доверия к нему."""
    cert_path, key_path = mc.generate(tmp_path)

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert_path, key_path)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        port = server.server_address[1]
        import urllib.request
        trusting = ssl.create_default_context(cafile=str(cert_path))
        assert urllib.request.urlopen(f"https://localhost:{port}/", context=trusting, timeout=5).read() == b"ok"
        strict = ssl.create_default_context()
        with pytest.raises(Exception, match="CERTIFICATE_VERIFY_FAILED|certificate verify failed"):
            urllib.request.urlopen(f"https://localhost:{port}/", context=strict, timeout=5)
    finally:
        server.shutdown()


@pytest.mark.skipif(mc.find_keytool() is None, reason="keytool (JDK) не найден")
def test_truststore_contains_the_certificate(tmp_path: Path):
    cert_path, _ = mc.generate(tmp_path)
    store = mc.make_truststore(cert_path, tmp_path, "secret12")
    assert store is not None and store.is_file()
    listing = subprocess.run([mc.find_keytool(), "-list", "-keystore", str(store), "-storepass", "secret12"],
                             capture_output=True, text=True)
    assert listing.returncode == 0 and mc.ALIAS in listing.stdout
    assert "trustedCertEntry" in listing.stdout
    wrong = subprocess.run([mc.find_keytool(), "-list", "-keystore", str(store), "-storepass", "bad-pass"],
                           capture_output=True, text=True)
    assert wrong.returncode != 0
