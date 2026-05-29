# Cloudflare R2 document storage

This backend can store patient documents in Cloudflare R2 using its S3-compatible API.

## Cloudflare setup

1. In Cloudflare, open **Storage & databases > R2**.
2. Create a bucket, for example `orthoflow-documents`.
3. Open **R2 > Overview > Manage API Tokens**.
4. Create an API token with **Object Read & Write** permission scoped only to this bucket.
5. Copy the **Access Key ID**, **Secret Access Key**, and S3 endpoint.

The S3 endpoint format is:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

## Render backend environment variables

Add these to the backend service:

```env
FILE_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_BUCKET=orthoflow-documents
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_REGION=auto
R2_FORCE_PATH_STYLE=true
```

You can use these generic S3 names instead if you later move to another provider:

```env
FILE_STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_BUCKET=orthoflow-documents
S3_ACCESS_KEY_ID=your_access_key_id
S3_SECRET_ACCESS_KEY=your_secret_access_key
S3_REGION=auto
S3_FORCE_PATH_STYLE=true
```

## Deployment notes

- Existing local filesystem documents remain local and will still be downloaded from their saved file path if the file exists.
- New uploads go to R2 only after `FILE_STORAGE_PROVIDER=r2` is set.
- The database stores R2 object metadata in `medical_documents.storage_provider`, `storage_bucket`, and `storage_key`.
- The app serves downloads through the backend, so the R2 bucket can stay private.
- No browser CORS setup is required because the frontend does not upload directly to R2.

