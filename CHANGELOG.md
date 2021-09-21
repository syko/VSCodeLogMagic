# Change Log

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
