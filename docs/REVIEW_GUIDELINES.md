# Review Guidelines — Performance & Security Subagents

Every change is evaluated from two independent perspectives before merge.
Treat each perspective as a dedicated reviewer ("subagent") with its own checklist.

---

## 1. Performance Reviewer

Goal: keep the app **fast, smooth, and small** (bundle size, startup, battery).

### Bundle / size
- [ ] No new heavy dependency without justification; prefer on-device/quantized models.
- [ ] Imports are tree-shakeable; avoid importing whole libraries for one function.
- [ ] Models and large assets are **not** bundled in the core; they are lazy/downloaded.
- [ ] Screens/code are lazy-loaded where sensible; no unnecessary code pulled into startup.

### Runtime smoothness
- [ ] Long lists use `FlatList`/`FlashList` with virtualization + `keyExtractor`.
- [ ] Animations use the native driver; avoid JS-thread-bound animations.
- [ ] Heavy work (OCR, classification, DB scans) runs off the UI thread; results memoized.
- [ ] Selectors/subscriptions avoid unnecessary re-renders (e.g. `zustand` selectors).
- [ ] Native resources (model sessions, DB handles) are released after use.

### Data / battery
- [ ] Queries use indexes; no full-table scans for common paths.
- [ ] Pagination/incremental loads for large datasets.
- [ ] No background timers/polling; on-device inference is user-triggered.

---

## 2. Security Reviewer

Goal: **zero data leakage**, hardened storage, minimal attack surface.

### Privacy / network
- [ ] No telemetry, analytics, crash reporting, or cloud calls in the core path.
- [ ] No network egress that transmits user data. Any optional network action (FX rate,
      model download) is user-triggered, minimized, and transmits nothing personal.
- [ ] No third-party SDK added without review.

### Storage / crypto
- [ ] Financial data only in the **encrypted** DB (SQLCipher); keys in Keychain/Keystore.
- [ ] Keys are never logged, printed, or written to plain files.
- [ ] Sensitive data not written to logs; error messages redact PII.

### Input / code
- [ ] SQL uses parameterized queries; no string concatenation of user input.
- [ ] OCR/parsed text treated as untrusted; validated before use.
- [ ] No secrets, tokens, or credentials committed (secret scanning is enforced).
- [ ] Dependencies are up to date; `npm audit` is clean; Dependabot alerts triaged.

### Native boundary
- [ ] Native modules validate inputs and bound memory; sessions disposed on completion.
- [ ] Downloaded models are checksum/signature verified.

---

## How to apply

- The PR template includes both checklists. Every PR must address them.
- A change that fails either perspective is blocked until resolved or explicitly waived
  with a documented rationale.
