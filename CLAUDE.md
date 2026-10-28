# Claude Code Working Agreement

## Before coding
1. Inspect the existing repository and package scripts.
2. Read `README.md`, `docs/product/PRODUCT.md`, `docs/product/MVP.md`, `docs/design/DESIGN.md`, `docs/engineering/ARCHITECTURE.md`, `docs/engineering/DATA_MODEL.md`, `docs/engineering/API_CONTRACT.md`, and `docs/ai/AI_RULES.md`.
3. Summarise the existing architecture and propose a small implementation plan before large changes.
4. Do not overwrite an existing project or configuration without explaining why.

## Product priorities
- Build the MVP in `docs/product/MVP.md`; do not expand scope silently.
- Optimise for a useful claim → evidence → counter-reading workflow.
- Do not treat the app as a generic rating/review site.
- Do not claim interpretations are objectively correct.
- Do not claim the product is unique without validated research.

## Engineering standards
- Use TypeScript for new frontend/backend code where practical.
- Prefer small, readable modules and explicit types.
- Validate all external and user input.
- Enforce authorization server-side.
- Keep secrets out of the client and repository.
- Use migrations for database changes.
- Add tests for important business rules.
- Include loading, empty, error, and success states.
- Follow the current project's linting and formatting conventions.
- Avoid unnecessary dependencies and premature abstractions.

## Workflow
For each task:
1. State the goal and files likely to change.
2. Implement the smallest complete vertical slice.
3. Run relevant tests, type checks, and lint scripts when available.
4. Report files changed, decisions made, tests run, and remaining risks.
5. Never claim a test passed if it was not run.

## Definition of done
A feature is done when:
- It meets acceptance criteria.
- It handles invalid input and errors.
- Permissions are enforced.
- It is usable on mobile and keyboard-accessible.
- Relevant tests pass or unrun checks are explicitly disclosed.
- Documentation/environment examples are updated when necessary.

## First task prompt
“Read the project documentation and inspect this repository. Do not implement features yet. Tell me the recommended MVP architecture based on the actual repository, identify missing decisions, and propose a week-one implementation plan. Respect the scope and rules in CLAUDE.md.”
