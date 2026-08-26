## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Code quality

- All code changes must be clean and easy to read, with descriptive names, small single-purpose functions or components, clear module boundaries, and consistent formatting.
- Do not leave dense one-line implementations, duplicated business rules, unexplained magic values, dead code, or unnecessary abstractions in touched code.
- Keep shared domain rules in one reusable source of truth.
- Improve readability within the touched scope without expanding into unrelated rewrites.
- Comments must explain intent or non-obvious constraints, not restate the implementation.
- Run the relevant lint or formatter check, type-check, and tests before declaring a code change complete; report any remaining failure honestly.
