---
"@taterdoge/pi-remember-model": patch
---

Leave an explicit `--model` / `--models` alone instead of letting the directory record override it.

The 0.2.0 notes said a `--model` flag keeps priority, but the code only checked `onGlobalDefault()` — "the session still holds `defaultProvider`/`defaultModel`". A flag never writes settings.json, so that check cannot see one, and it passed whenever the settings default happened to hold the same model the flag named. A manual switch in any pi instance writes that default, so the flag was honored on most starts and silently overridden on others.

The one that breaks in practice is a subagent: `pi-subagents` starts every background child as `pi --model <provider/id>` from the agent's own model, so a `reviewer`/`oracle` pinned to a strong model was pulled back to whatever model that directory last used, thinking level included. `session_start` now scans argv first and returns when a model was named on the command line. A directory record is still applied on `startup`, `new` and `fork`, and a resumed session's own `model_change` still wins as before.
