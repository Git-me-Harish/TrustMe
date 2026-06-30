"""
Object storage wrapper. All biometric/document evidence goes through here —
never write raw image bytes into the DB (see ARCHITECTURE.md §4). MinIO is
S3-API-compatible, so this same client code targets a real S3/GCS bucket in
deploy by just changing endpoint/credentials — no code change.
"""
import uuid
from functools import lru_cache

import boto3
from botocore.client import Config

from app.core.config import get_settings

settings = get_settings()


@lru_cache(maxsize=1)
def _get_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.OBJECT_STORE_ENDPOINT,
        aws_access_key_id=settings.OBJECT_STORE_ACCESS_KEY,
        aws_secret_access_key=settings.OBJECT_STORE_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        use_ssl=settings.OBJECT_STORE_USE_SSL,
    )


def ensure_bucket() -> None:
    client = _get_client()
    existing = {b["Name"] for b in client.list_buckets().get("Buckets", [])}
    if settings.OBJECT_STORE_BUCKET not in existing:
        client.create_bucket(Bucket=settings.OBJECT_STORE_BUCKET)


def upload_bytes(data: bytes, prefix: str) -> str:
    key = f"{prefix}/{uuid.uuid4()}"
    _get_client().put_object(
        Bucket=settings.OBJECT_STORE_BUCKET,
        Key=key,
        Body=data,
        ServerSideEncryption="AES256",
    )
    return key


def download_bytes(key: str) -> bytes:
    response = _get_client().get_object(Bucket=settings.OBJECT_STORE_BUCKET, Key=key)
    return response["Body"].read()
