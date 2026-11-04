---
type: patch
areas:
  - tooling
---

## Intent

Prevent Vendure INEX product images from disappearing after Hostinger redeployments by moving uploaded file bytes to a durable private directory outside `hbuilds`.

## Invariants

- Image upload storage is configurable through `ASSET_UPLOAD_DIR`, without changing product, stock or price data.
- Absolute paths under `hbuilds` and `public_html` are rejected in production.
- Existing backend deployments do not crash if the new environment variable is not yet set; a runtime warning documents that the legacy path is temporary.
- Asset metadata rows are not deleted or migrated blindly. A missing original image must be restored from backups or reuploaded.
- No API credentials or database passwords are committed.

## Integration guidance

See `commerce-backend/HOSTINGER-DEPLOY.md`. Create `storage/vendure-assets` at the API site's domain root (outside the auto-deployed folders), set the absolute `ASSET_UPLOAD_DIR` on the **Vendure API** Hostinger Node.js website, deploy, and reupload the missing original asset. Verify that its source link still works after a subsequent backend redeploy.

## Verification

Backend TypeScript and Dashboard builds, isolated MySQL startup check with a configured external asset directory, and a file-system test covering valid persistent paths and invalid ephemeral ones. Manual Hostinger writable path and asset reupload checks remain mandatory.
