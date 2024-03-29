# Change Log

## [1.7.6] - 2023-04-05

### Fixed
- Typescript: `type` really is now an allowed variable name (no really, this time I promise)
- Typescript: `module`, `set`, `symbol`, `byte` and `final` are also now allowed variable names
- Javascript: `byte` and `final` are also now allowed variable names

## [1.7.5] - 2023-03-01

### Fixed
- Typescript: `type` is now an allowed variable name

## [1.7.4] - 2023-01-18

### Added
- Nothing

## [1.7.3] - 2023-01-18

### Fixed
- Javascript & Typescript: `undefined` is now treated as a keyword

## [1.7.2] - 2022-08-29

### Fixed
- Typescript: No longer outputting the type of a destructuring expression (`({a, b}: Type) => { ... })`)

## [1.7.1] - 2022-08-29

### Fixed
- Typescript React files (.tsx) now use Typescript mode automatically
- Fixed missing option of setting Typescript as the default language

## [1.7.0] - 2022-01-11

### Added
- Typescript support!
- Javascript: BigInt now recognized as a keyword

## [1.6.0] - 2021-12-17

### Added
- Javascript: Added support for splat syntax (`...params` now outputs `params` for the log statement)
- Added unit tests and linting for smoother development

### Changed
- Log ID is no longer used if it matches an item key (eg. `var a = 1` will output `a:` as an item key rather than `a` as the log id)
- The first found string is now also considered for the log id

## [1.5.3] - 2021-12-10

### Fixed
- Javascript: Fixed first identifier being omitted from output if the line contains a colon

## [1.5.2] - 2021-12-08

### Fixed
- Javascript: Fixed trying to log object key in cases like `someKey: function(p) {`

## [1.5.1] - 2021-11-25

### Changed
- Updated README

## [1.5.0] - 2021-11-25

### Added
- Added support for any number of consecutive bracket notations (`foo[1][2][3]` will be considered a single identifier)

### Fixed
- Javascript: Fixed `false` not being recognized as a keyword
- C#: `get` and `set` can now be log ids
- Keywords / Std class names no longer break identifier chains
- Bracket notation no longer breaks identifier chains (`foo[1][2].chained[3]` will be considered a single identifier)s

### Changed
- All setting types are now `resource` so they can be overridden at any configuration level
- Improved README

## [1.4.1] - 2021-11-19

### Fixed
- Fixed exception if logging on lines with very large indentation
- Fixed indent when logging after switch cases (`case foo:`)
- Fixed exception when a line of code ends with the lambda operator `=>`
- Removed chained identifiers from log statements (eg. should not try to log `someProp` if the line is `foo(a, b).someProp`)

## [1.4.0] - 2021-11-19

### Added
- Long log item keys are now shortened ('someVeryLongIdentifier:' becomes 'someVery..entifier:')

## [1.3.0] - 2021-11-18

### Fixed
- Fixed erronesouly logging object keys as variables
- Javascript: Improved the list of known keywords

### Added
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

### Added
- Initial release with support for C#, javascript and javascriptreact
