# Contributing to ANVESHAN

Thank you for contributing to ANVESHAN.

## Core principles

- Security-first
- Evidence-centric workflows (not document-centric)
- Privacy by design
- Least privilege
- Evidence integrity before AI intelligence
- Human investigator remains the decision-maker
- AI outputs must be grounded in evidence
- No real sensitive investigation data in development

## Workflow

1. Fork the repository.
2. Create a focused branch from the default branch.
3. Implement and test your changes.
4. Open a pull request (PR) with a clear summary.

### Branch naming

Use descriptive names with these prefixes:

- `feature/...`
- `fix/...`
- `docs/...`
- `security/...`
- `refactor/...`

## Commits

- Keep commits focused and small.
- Write clear commit messages describing intent.
- Avoid mixing unrelated changes in one commit.

## Pull requests

- Explain what changed and why.
- Link related issues when applicable.
- Include testing notes and any validation steps.
- Update documentation when behavior, configuration, or interfaces change.

## Code review

- All changes should be reviewed before merge.
- Address review feedback constructively and keep discussions technical.
- Prefer secure defaults and explicit threat-aware reasoning in design decisions.

## Testing expectations

- Run relevant existing tests before opening a PR.
- Add or update tests when introducing or changing behavior.
- Ensure changes do not regress existing functionality.

## Security requirements

- Never commit credentials, API keys, tokens, private keys, or other secrets.
- Follow `SECURITY.md` for vulnerability reporting and handling.
- Avoid introducing insecure defaults or bypasses.

## Data handling requirements

- Do not use real investigation/evidence data in development or tests.
- Use synthetic or anonymized datasets only.
- Do not upload sensitive datasets, case records, victim/witness information, or confidential data.
