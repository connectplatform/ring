### AI Context Ingestion Guide (Ring)

- Read `AI-CONTEXT-INDEX.json`.
- Include files matching:
  - `docs/AI-*.md`
  - `docs/domains/**/AI-INSTRUCTION-PROMPT.md`
  - `services/**/AI-CONTEXT-DETAILS*.json`
  - `features/**/AI-CONTEXT-DETAILS*.json`
  - `integrations/**/AI-CONTEXT*.json`
- Exclude `**/node_modules/**`, `**/.next/**`.
- For each domain in `index.domains`, load `index_file` then merge `details` arrays (later wins on conflicts).
- Also read `global_docs` for platform-level patterns.
- Optionally ingest `ring-docs` Docusaurus content under `docs/**/*.md` for human-facing docs.

This guide standardizes how AI agents load context across Ring domains.


