# Taste
- Communicates in Chinese and expects responses in Chinese. Confidence: 0.65
- Wants git commits written in conventional-commit style (`type: summary` + descriptive body), splitting changes into logically separated, single-purpose commits by type (e.g. `fix:` / `docs:` / `chore:`). Confidence: 0.7
- Prefers committing all related changed files (including tool/config preference files) so the working tree ends clean, rather than leaving files uncommitted. Confidence: 0.55
- Evaluates UI/UX from the end user's perspective and treats usability problems as real defects, not polish (e.g. reporting a non-responsive control like a failed "mark as read" as a genuine bug). Confidence: 0.75
- Insists every page/screen provide a way to navigate back (no dead-end screens); explicitly flags pages that trap the user as "wrong". Confidence: 0.7
- Wants in-progress user state to persist across navigation — data picked up/fetched on one page must remain reachable when returning, not silently disappear. Confidence: 0.7
- Expects interactions to give immediate visible feedback and every UI path that implies a state change to apply it consistently (e.g. clicking a single notification should mark it read, same as a "mark all" action). Confidence: 0.6
- Prefers to close out loose ends first — commit/push pending changes and confirm CI is green — before starting new feature work ("先收尾，然后…"). Confidence: 0.55
- Prioritizes a unified product/matching pool and worries that segmenting users creates unbalanced matching; willing to strip out even safety/compliance scaffolding (e.g. the age-tiered guardian mode and 13+ gate) when it divides the pool. Confidence: 0.55
