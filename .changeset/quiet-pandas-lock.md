---
"@taterdoge/pi-status": patch
---

Stop the git status poll from taking `index.lock`. The poll now runs `git --no-optional-locks status`, so refreshing the index cache no longer blocks a concurrent `git commit`, `git add` or rebase with `fatal: Unable to create '.../index.lock': File exists.` The status output is unchanged.
