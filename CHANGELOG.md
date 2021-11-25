# Change Log

## [1.5.1] - 2021-11-25

## Changed
- Updated README

## [1.5.0] - 2021-11-25

## Added
- Added support for any number of consecutive bracket notations (`foo[1][2][3]` will be considered a single identifier)

## Fixed
- Javascript: Fixed `false` not being recognized as a keyword
- C#: `get` and `set` can now be log ids
- Keywords / Std class names no longer break identifier chains
- Bracket notation no longer breaks identifier chains (`foo[1][2].chained[3]` will be considered a single identifier)s

## Changed
- All setting types are now `resource` so they can be overridden at any configuration level
- Improved README

## [1.4.1] - 2021-11-19

## Fixed
- Fixed exception if logging on lines with very large indentation
- Fixed indent when logging after switch cases (`case foo:`)
- Fixed exception when a line of code ends with the lambda operator `=>`
- Removed chained identifiers from log statements (eg. should not try to log `someProp` if the line is `foo(a, b).someProp`)

## [1.4.0] - 2021-11-19

## Added
- Long log item keys are now shortened ('someVeryLongIdentifier:' becomes 'someVery..entifier:')

## [1.3.0] - 2021-11-18

### Fixed
- Fixed erronesouly logging object keys as variables
- Javascript: Improved the list of known keywords

## Added
- Javascript: Added support for destructuring syntax

## [1.2.2] - 2021-09-30

### Fixed
- Fixed log rotator not identifying log suffix and treating it as a log item producing ` + ););` or similar when rotating.

## [1.2.1] - 2021-09-28

### Fixed
- Number parsing for C# and javascript now supports prefixes (like 0x, 0b), separators (_), scientific notation and suffixes (like f, u, l, etc in C# and n in javascript).

## [1.2.0] - 2021-09-23

### Added
- Added an `insertSpaces` attribute to log formats which controls whether logged strings are padded with spaces for logging
- C# now uses `insertSpaces: true` so in the log output items are now nicely separated by a single space.
- Added logo

### Fixed
- Removed `value` as a keyword from csharp as it is a popular variable name and C# allows for it. More often than not we probably want to log it.

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
