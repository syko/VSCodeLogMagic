# LogMagic for Visual Studio Code

Easily print variables and parameters with keyboard shortcuts for quick debugging.

## Features

### Log Quickly

Any log statement is just a keyboard shortuct away

![Log anything quickly](images/log-anything.gif "Log anything quickly")

### Log Anything

LogMagic inspects the current line and tries to extract interesting information from it:
- variable assignments
- function parameters in a function definition
- parameters in a function call
- ignores literals and keywords such as strings, numbers, `true,` `false`, `null`, `undefined`, etc
- falls back to printing `L<line number>` if it fails to parse anything meaningful

### Up / Down Support

You can add the log statement on the previous or the next line. This is especially helpful in case of return
statements.

### Cycle Through Different Kinds of Log Statements

Press the same keyboard shortcuts when already on a log statement to cycle through different kinds of log statements.
In javascript for example you can cycle through `log`, `info`, `warn` and `error` levels. In C# you can cycle through
`System.Write`, `System.Write` and unity's `Debug.Log` options.

![Log cycle](images/log-cycle.gif "Cycling through log levels is a breeze")

### Add Your Own Log Statements

For each language you can configure your own log statements to cycle through. You can even wrap logged identifiers in
your own decorator functions or append `.toString` for example.

### Remove All Log Statements

With one command you can remove all log statements from the current file.

![Remove all log statements](images/remove-all.gif "Remove all log statements")

## Extension Settings

This extension contributes the following settings:

- `logMagic.defaultLanguage`: Specifies the language to fall back to if LogMagic does not have a direct implementation for the currently active programming language
- `logMagic.logFormats`: 

## Release Notes

### 1.0.0

Initial release with support for
- javascript
- C#
