# LogMagic for Visual Studio Code

Easily print variables and parameters with keyboard shortcuts for quick debugging.

## Features

### Log quickly

Any log statement is just a keyboard shortuct away

![Log anything quickly](images/log-anything.gif "Log anything quickly")

### Log anything

LogMagic inspects the current line and tries to extract interesting information from it:
- variable assignments
- function parameters in a function definition
- parameters in a function call
- ignores literals and keywords such as strings, numbers, `true,` `false`, `null`, `undefined`, etc
- falls back to printing `L<line number>` if it fails to parse anything meaningful

### Cycle through log types

Press the same keyboard shortcuts when already on a log statement to cycle through `log`,
`info`, `warn` and `error`.

![Log cycle](images/log-cycle.gif "Cycling through log levels is a breeze")

### Up / Down support

You can add the log statement on the previous or the next line. This is especially helpful in case of return
statements.

![Log upwards](images/log-up.gif "Log upwards!")

### COMING SOON: Remove all log statements

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
