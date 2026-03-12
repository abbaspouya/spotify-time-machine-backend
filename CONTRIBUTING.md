# Contributing

## Branch Workflow

- Keep `main` as the only long-lived branch.
- Create short-lived branches from `main` for each task or feature.
- Branch names should describe the change, not the layer.

Examples:

- `feat/frontend-auth-ui`
- `fix/backend-snapshot-import`
- `feat/fullstack-login-flow`
- `chore/restructure-repo`

## Commit Prefixes

Use one clear prefix per commit:

- `feat`: new behavior
- `fix`: bug fix
- `chore`: structure, tooling, or setup
- `docs`: README or documentation-only changes
- `refactor`: internal cleanup without behavior change

## Commit Guidance

- Prefer small, focused commits.
- Split unrelated changes into separate commits.
- If a change touches both frontend and backend for one feature, one commit is fine if the work is still cohesive.
