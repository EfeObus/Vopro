# Contributing to Vopro

Vopro is **proprietary, all-rights-reserved software** — see [`LICENSE`](LICENSE).
This document is for **authorised contributors** (employees, contractors, and
parties operating under a signed agreement). It is **not** an invitation to
the general public to fork or contribute.

If you do not have a signed agreement with the Vopro copyright holder and
would like to contribute, contact **legal@vopro.com** first. Pull requests
opened without prior authorization will be closed without review.

By submitting any change to this repository you confirm that:

1. You are authorised to contribute under the Vopro Proprietary Software
   License or a separate written agreement;
2. The change is your own original work or you have the right to submit it;
3. You assign all right, title, and interest in the change to the Vopro
   copyright holder, who may relicense it at their sole discretion.

## Ground rules

- Be kind. Assume good intent.
- Keep PRs small and focused.
- Tests are required for new behavior in `backend/`, `ai-engine/`, and
  `agent/`. Frontend tests are encouraged.
- Privacy is a feature, not an afterthought. Any change that touches event
  capture, transport, or storage must be reviewed against `docs/PRIVACY.md`.

## Getting set up

```bash
git clone https://github.com/your-org/vopro.git
cd vopro
make up
```

Run individual stacks:

```bash
make frontend   # Vite dev server
make backend    # Rails API
make ai         # Python worker
make agent      # Electron agent
```

## Development workflow

```bash
git checkout -b feature/<short-name>
# ...code...
make test       # runs all unit tests
make lint       # runs all linters
git commit -m "feat(scope): describe the change"
git push origin feature/<short-name>
```

Conventional commit prefixes we use:

- `feat:` new feature
- `fix:` bug fix
- `refactor:` non-behavioral cleanup
- `docs:` docs only
- `test:` tests only
- `chore:` tooling, deps, CI

## Pull requests

- Fill out the PR description (what / why / how to test).
- Link any related issues.
- Make sure CI is green.
- One reviewer minimum, two for changes that touch capture or auth.

## Reporting bugs

Open an issue with:
- What you expected
- What happened
- Repro steps
- Vopro version, OS, browser (if relevant)

## Security disclosures

Please do **not** file public issues for security vulnerabilities. Email
**efe.obukohwo@outlook.com** instead.
