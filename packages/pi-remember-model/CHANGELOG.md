# @taterdoge/pi-remember-model

## 0.1.0

### Initial Release

- Persist the last selected model (`defaultProvider` / `defaultModel`) and thinking level (`defaultThinkingLevel`) to Pi's global settings.json
- Read-merge-write patching that preserves unrelated settings keys
- Ignores session-restore model events so opened sessions never rewrite the default
