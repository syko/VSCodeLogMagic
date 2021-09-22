# Change Log

## [1.1.1] - 2021-09-22

### Fixed
- Escaping quotation marks in strings when outputting log statements now works correctly.
- Multi-token log items aand log items containing punctuation are now preserved correctly when rotating log statements.
- Fixed extension activation events. Logging down or removing all log statements now works without having to log downwards first.

## [1.1.0] - 2021-09-21

### Added
- Javascript: Don't log the assignee for function declaration statements like `const myFunc = function(...) {` and `const myFunc = (...) => {`.

### Changed
- There is no longer a colon at the end of the logId string.
- Fixed a potential bug where the logId parsing could fail when cycling log statements.

## [1.0.1] - 2021-09-21

### Changed
- Drop vscode version support to 1.49.3

## [1.0.0] - 2021-09-21

- Initial release with support for C#, javascript and javascriptreact
