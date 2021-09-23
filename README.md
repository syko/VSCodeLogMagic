# LogMagic for Visual Studio Code

Easily print variables and parameters with keyboard shortcuts for quick debugging.

## Features

### Log Quickly

Any log statement is just a keyboard shortuct away

![Log anything quickly](images/log-anything.gif "Log anything quickly")

### Log Anything

Just hit `alt+j` and let LogMagic do the work.

### Up / Down Support

You can also log upwards with `alt+k`. This is especially helpful in case of return
statements.

### Cycle Through Different Kinds of Log Statements

Press the same keyboard shortcuts when already on a log statement to cycle through different kinds of log statements.
In javascript for example you can cycle through `log`, `info`, `warn` and `error` levels. In C# you can cycle through
`System.WriteLine`, `System.Write` and unity's `Debug.Log` options.

![Log cycle](images/log-cycle.gif "Cycling through log levels is a breeze")

### Add Your Own Log Statements

For each language you can configure your own log statements to cycle through. You can even wrap logged identifiers in
your own decorator functions or append `.toString()` for example.

### Remove All Log Statements

Pressing `ctrl + alt + j` (or `cmd + alt +j` on a mac) removes all log statements from the current file.

![Remove all log statements](images/remove-all.gif "Remove all log statements")

### Generates a Unique Identifier if Nothing to Log

If LogMagic can't find anything meaningful to log it falls back to printing `L<line number>`.
It always puts your caret at the end of the generated log statement for easy manual additions if needed.

### Decorate Logged Identifiers With Custom Prefixes and Suffixes

You can use the `logMagix.logFormats` configuration to create all sorts of custom log statements and cycle through them with ease.

## Extension Settings

This extension contributes the following settings:

- `logMagic.defaultLanguage`: Specifies the language to fall back to if LogMagic does not have a direct implementation for the currently active programming language
- `logMagic.logFormats`: An array of log formats. With this you can override the log formats on a global or per-language level. Each log format should be an object with the following string properties:
  - `logPrefix`: A log-function call including the opening parenthesesis like _print(_
  - `parameterSeparator`: A parameter separator, like a comma
  - `identifierPrefix`: Anything to prefix each identifier with. You can use this along with _identifierSuffix_ to wrap identifiers in decorator functions for example.
  - `identifierSuffix`: Anything to suffix identifiers with. You can call _.toString()_ on each identifier for example.
  - `logSuffix`: An ending suffix to complete the log statement, like _);_. The caret is placed right before the suffix by default.
  - `quoteCharacter`: The quote character to use when outputting strings.
  - `insertSpaces`: A boolean indicating whether logged strings should be wrapped in spaces for padding.

## Release Notes

See CHANGELOG.md