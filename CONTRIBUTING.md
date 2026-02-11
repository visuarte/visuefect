# Contributing to Visuefect

Thanks for considering contributing! A few guidelines to keep development smooth:

- Run tests locally: `npm run test:run` (single run) or `npm run test:watch` (watch mode; press `p` to change pattern if you see "No test files found").
- Linting: `npm run lint`; to auto-fix where possible: `npm run lint -- --fix`.
- Before opening a PR, ensure tests pass and the linter is clean (or leave notes if you intentionally skip rules).
- PR guidelines:
  - Create a feature branch named `feat/<short-name>` or `fix/<short-name>` from `main`.
  - Open PR targeting `main` and include a short description and test coverage when applicable.
  - Use a clear commit message and squash related commits when appropriate.

If you're uncertain, open a draft PR and request a review.
