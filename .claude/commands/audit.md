Run a comprehensive audit of the DIROPS-SGA codebase.

Launch 3 parallel agents:

1. **Bundle & Dependencies** — Check for unused deps, heavy eager imports, largest chunks, dead code
2. **Data Fetching** — Find .list() without filters, N+1 patterns, missing pagination, pages without TanStack Query
3. **Code Quality** — Files >800 lines, console.log in production, TODO/FIXME, empty catch blocks, hardcoded secrets

Compare findings against the previous audit (in .planning/reports/) and report:
- What was RESOLVED since last audit
- What is NEW
- What REMAINS from before
- Top 5 quick wins with estimated impact
