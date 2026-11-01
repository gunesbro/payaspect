## Summary

<!-- What does this PR do and why? -->

## Type of change

- [ ] feat: new feature
- [ ] fix: bug fix
- [ ] docs: documentation
- [ ] chore: tooling / build / deps
- [ ] refactor: internal change
- [ ] security: security-related

## Checklist

- [ ] Code follows the project's privacy principles (no telemetry, no cloud, on-device only)
- [ ] No secrets, keys, or personal data committed
- [ ] Typechecks pass (`core` typecheck)
- [ ] Tests added/updated (where applicable)
- [ ] Docs updated (if behavior changed)

## Security review

- [ ] No telemetry / analytics / cloud in the core path
- [ ] No network egress transmitting user data (optional actions user-triggered)
- [ ] Financial data only in encrypted DB; keys in Keychain/Keystore
- [ ] Parameterized SQL; OCR/parsed input validated as untrusted
- [ ] No secrets/keys/PII committed or logged
- [ ] `npm audit` clean; Dependabot alerts triaged

## Performance review

- [ ] No heavy dependency without justification; imports tree-shakeable
- [ ] Models/assets not bundled in core (lazy/downloaded)
- [ ] Lists virtualized; animations on native driver
- [ ] Heavy work off the UI thread; results memoized; native resources released
- [ ] Queries indexed; no full-table scans on common paths

## Impact on size / performance

<!-- Note any effect on app size, startup, or battery. -->

## Screenshots / notes

<!-- Optional. -->

