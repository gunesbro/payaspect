# Contributing to PayAspect

Thanks for your interest! PayAspect is privacy-first and fully on-device. Please keep that principle in every contribution.

## Ground rules

- **No telemetry, analytics, crash reporting, or cloud** in the core app.
- **No network egress** that transmits user data. Optional features (e.g. FX rate fetch, model download) must be user-triggered and transmit nothing personal.
- **No secrets** in the repo. Use environment variables and `.env.example`.
- Keep the app **small and battery-friendly**: avoid heavy dependencies, prefer quantized/on-device models.

## Workflow

1. Fork the repo and create a branch: `feat/...`, `fix/...`, `docs/...`.
2. Make your change with tests where useful.
3. Verify from the repo root: `npm ci`, `npm run typecheck`, `npm run test`, `npm --workspace payaspect-app run typecheck`.
4. If you touched app code or build config, check that the app still bundles: `npm --workspace payaspect-app run bundle:check`.
5. Open a Pull Request using the template. Describe the change and any size/perf impact.
6. CI (typecheck, tests, Metro bundle, CodeQL) must pass before merge.

## Reporting security issues

See [`SECURITY.md`](SECURITY.md). Do not open public issues for vulnerabilities.

## License

By contributing, you agree that your contributions are licensed under the MIT License.
