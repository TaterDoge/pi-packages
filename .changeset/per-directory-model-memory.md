---
"@taterdoge/pi-remember-model": minor
---

Remember the selected model **per directory**. Switching a model in one pi instance no longer changes what a session in another directory opens with on `/new` or `/reload`.

`model_select` still writes `defaultProvider`/`defaultModel` — that stays the fallback for directories with no record — but it now also records the directory's model in `~/.pi/agent/extensions/pi-remember-model/models.json`, keyed by absolute path. On `session_start` the extension applies that record with `pi.setModel()`, which is session-only, so the restore never writes back and session starts cannot drift the global default.

The record is applied only when the session still sits on the global default, so a `--model` flag and a resumed session's own `model_change` both keep priority. Thinking levels stay global in pi's own `modelThinkingLevels` map: a level belongs to a model, not to a directory, so it must survive `/new` anywhere.

Upgrading from 0.1.2 now cleans up after itself: the extension folds any valid entries from the old `~/.pi/agent/extensions/pi-remember-model/thinking-levels.json` into `modelThinkingLevels` and deletes the file. A level re-picked since the upgrade wins; unrecognised entries are dropped. Previously that file was left behind, so a level picked before upgrading was silently lost.
