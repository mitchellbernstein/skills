
Andon:
Halts new spawns across the whole tree. Raise only with concrete evidence that continued spawning produces garbage: upstream output is wrong and downstream tasks will fail against it, verifier cascade shows acceptance was wrong, auth or infra is unrecoverable. A task hitting its own snag is a `Status: blocked` handoff, not Andon.

  {{orch}} andon raise --reason "<why>" {{workspace}}
