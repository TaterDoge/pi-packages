# @taterdoge/pi-status

## 1.2.1

### Patch Changes

- [`a1b68fd`](https://github.com/TaterDoge/pi-packages/commit/a1b68fd363cb6cb395b8fc17c7aa627d845babe9) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Stop the git status poll from taking `index.lock`. The poll now runs `git --no-optional-locks status`, so refreshing the index cache no longer blocks a concurrent `git commit`, `git add` or rebase with `fatal: Unable to create '.../index.lock': File exists.` The status output is unchanged.

## 1.2.0

### Minor Changes

- Added configurable context bar style presets
- Moved global config to Pi's extension config directory

## 1.1.0

### Minor Changes

- Added cost component to display session usage fees in the status bar

## 1.0.1

### Patch Changes

- Cleaned up usage statistics quality hints

## 1.0.0

### Initial Release

- Configurable status bar with border decorations around the Editor for Pi
