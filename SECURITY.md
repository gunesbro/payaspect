# Security Policy

PayAspect is a privacy-first application: user financial data must never leave the device. Security is a core product requirement, not an afterthought.

## Supported Versions

The project is in early development. Security fixes are applied to the `main` branch.

| Version | Supported |
| ------- | --------- |
| main (pre-1.0) | :white_check_mark: |

## Reporting a Vulnerability

**Please do NOT open a public issue for security vulnerabilities.**

Instead, report privately using GitHub's "Report a vulnerability" feature:

1. Go to the **Security** tab of this repository.
2. Click **Advisories** → **Report a vulnerability**.

Alternatively, contact the maintainers listed in `CODEOWNERS`.

Please include:
- A description of the issue and its impact.
- Steps to reproduce.
- Affected version/commit and platform (Android/iOS).
- Any suggested remediation.

### What to expect

- Acknowledgement within **72 hours**.
- An assessment and remediation plan.
- Coordinated disclosure once a fix is available.
- Credit in the advisory (unless you prefer to stay anonymous).

## Scope & Threat Model (summary)

In scope:
- On-device data storage and encryption (SQLCipher, key handling).
- On-device AI/OCR pipeline.
- Any accidental network egress (the app must not transmit user data).
- Dependency vulnerabilities.
- Native module boundaries.

Out of scope (by design):
- No backend, no cloud, no accounts, no telemetry.
- Bank API integrations (not provided).

## Our Security Commitments

- **No analytics, no crash reporting, no cloud** in the core app.
- **Encrypted local database** (SQLCipher) with keys in Keychain/Keystore.
- **On-device only** OCR and AI inference.
- **Minimal, auditable dependencies**; Dependabot and CodeQL enabled.
- **Secret scanning and push protection** enabled.
- **No secrets in the repository** — ever.

See [`docs/PRIVACY.md`](docs/PRIVACY.md) for the privacy model.
