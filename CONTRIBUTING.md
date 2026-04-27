# Contributing to Vopro

Thanks for your interest in improving Vopro! This guide covers how to set up
your environment, make changes, and submit them for review.

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
