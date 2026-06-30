"""
UIDAI Offline e-KYC verification (ADR-002).

Offline Aadhaar XML is a ZIP containing signed XML, downloadable by any
resident from https://myaadhaar.uidai.gov.in with a share-code they set.
UIDAI signs it with their private key; the corresponding public certificate
is published openly — anyone can verify the signature without ANY API call
or licensing relationship with UIDAI. This is categorically different from
live e-KYC (which requires AUA/KUA licensing) and is the legally correct
"real" implementation accessible to an unlicensed product.

The Secure QR Code on physical/PDF Aadhaar is a similar signed, offline,
verifiable artifact (digitally signed by UIDAI, decodable without an API).

This module verifies the *cryptographic signature* and extracts demographic
fields for cross-check against OCR'd document data. It NEVER persists the
full Aadhaar number — only last 4 digits, per UIDAI circular guidance on
data minimization (and good practice independent of that).
"""
import io
import re
import zipfile
from dataclasses import dataclass

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.x509 import load_pem_x509_certificate
from lxml import etree


@dataclass
class AadhaarOfflineResult:
    signature_valid: bool
    masked_aadhaar_last4: str | None
    name: str | None
    dob: str | None
    cert_serial: str | None
    raw_demographic: dict


class InvalidOfflineAadhaarError(Exception):
    pass


def _extract_xml_from_zip(zip_bytes: bytes, share_code: str) -> bytes:
    """Offline Aadhaar ZIP is itself password-protected with the user-chosen
    share code — this is the FIRST gate (proves the uploader has the actual
    download, not just a copied XML file)."""
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            zf.setpassword(share_code.encode("utf-8"))
            xml_name = next(n for n in zf.namelist() if n.lower().endswith(".xml"))
            return zf.read(xml_name)
    except (zipfile.BadZipFile, RuntimeError, StopIteration) as exc:
        raise InvalidOfflineAadhaarError(
            "Could not open Offline Aadhaar ZIP — wrong share code or corrupted file."
        ) from exc


def verify_offline_aadhaar(zip_bytes: bytes, share_code: str, uidai_public_cert_pem: bytes) -> AadhaarOfflineResult:
    """
    Verifies UIDAI's digital signature on the offline XML using their
    published public certificate, then parses demographic fields.

    `uidai_public_cert_pem` must be loaded from UIDAI's officially published
    certificate (rotate-aware: fetch the current cert from UIDAI's site at
    deploy time, don't hardcode an expired one — certs are periodically
    reissued).
    """
    xml_bytes = _extract_xml_from_zip(zip_bytes, share_code)
    root = etree.fromstring(xml_bytes)

    signature_node = root.find(".//{http://www.w3.org/2000/09/xmldsig#}Signature")
    if signature_node is None:
        raise InvalidOfflineAadhaarError("No digital signature found in XML — not a genuine UIDAI artifact.")

    signed_info = signature_node.find(".//{http://www.w3.org/2000/09/xmldsig#}SignedInfo")
    signature_value_node = signature_node.find(".//{http://www.w3.org/2000/09/xmldsig#}SignatureValue")
    if signed_info is None or signature_value_node is None:
        raise InvalidOfflineAadhaarError("Malformed signature block.")

    canonical_signed_info = etree.tostring(signed_info, method="c14n")
    signature_bytes = signature_value_node.text.strip().encode("utf-8")

    cert = load_pem_x509_certificate(uidai_public_cert_pem)
    public_key = cert.public_key()

    try:
        public_key.verify(
            signature_bytes,
            canonical_signed_info,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        signature_valid = True
    except InvalidSignature:
        signature_valid = False

    pdata = root.find(".//PoiData") if root.find(".//PoiData") is not None else root.find(".//Poi")
    name = pdata.get("name") if pdata is not None else None
    dob = pdata.get("dob") if pdata is not None else None
    uid_attr = root.find(".//UidData")
    full_uid = uid_attr.get("uid") if uid_attr is not None else None
    masked_last4 = full_uid[-4:] if full_uid and re.fullmatch(r"\d{12}", full_uid) else None

    return AadhaarOfflineResult(
        signature_valid=signature_valid,
        masked_aadhaar_last4=masked_last4,
        name=name,
        dob=dob,
        cert_serial=str(cert.serial_number),
        raw_demographic={"name": name, "dob": dob},
    )
