/* eslint-disable import/no-unresolved */
import * as vscode from 'vscode';
/* eslint-enable import/no-unresolved */
import { ParseResult } from './parser';
import {
  createLogger, Logger, LoggerConfig, validateLoggerConfig,
} from './logger';
import { createLogRotator, LogRotator } from './logRotator';
import { ensureLogId, isClosingCodeBlock, isOpeningCodeBlock } from './util';
import { clearCache, getMagicItem } from './magic';

/**
 * A magical item allowing us to output a log statement with a single keypress.
 */
export type MagicItemOverride = {
  log: Logger;
  rotateLog: LogRotator;
}

/**
 * A function for converting an editor default language setting value to its corresponding
 * languageId. (eg. converts 'C#' into 'csharp')
 *
 * @param setting The setting value
 * @returns The corresponding module name (file from ./languages)
 */
function languageSettingToLanguageId(setting: string | undefined): string | undefined {
  if (!setting) return setting;
  return {
    'C#': 'csharp',
  }[setting] || setting; // Pass through if no override found
}

/**
 * A function for creating an indentation string from the indent size number.
 *
 * @param editor The active vscode editor
 * @param n The indent size
 * @returns A string that can be prepended to a statement as indentation
 */
function getIndentStr(editor: vscode.TextEditor, n: number): string {
  const indentChar = editor.options.insertSpaces ? ' ' : '\t';
  return indentChar.repeat(n * (editor.options.insertSpaces ? editor.options.tabSize as number : 1));
}

/**
 * Detect indentation size from a line of code and return the indent size.
 *
 * @param editor The active vscode editor
 * @param line The line of code to process
 * @returns A number representing the indentation size
 */
function detectIndent(editor: vscode.TextEditor, line: vscode.TextLine) {
  return Math.round(line.firstNonWhitespaceCharacterIndex / getIndentStr(editor, 1).length);
}

/**
 * A function that starts inspecting the lines at the current cursor position and looks for a line of code
 * that has content beyond "{" or similar and returns it.
 *
 * It only looks beyond the current line if logDirection is 1 since when loggin upwards it doesn't make sense
 * grab stuff from down below, but when logging downwards we want to grab the closest interesting
 * stuff from previous lines. We cannot just consider the current line because of inexplicable syntax conventions that put
 * opening braces on separate lines.
 *
 * @param document The vscode document
 * @param selection The selection representing the caret position
 * @returns The first meaningful line of code found
 */
function findContentfulLine(document: vscode.TextDocument, selection: vscode.Selection): vscode.TextLine {
  let line;
  let lineNr = selection.active.line;
  do {
    line = document.lineAt(lineNr);
    lineNr -= 1;
  } while (/^\s*[{[()]+\s*$/.test(line.text) && lineNr >= 0);
  return line;
}

/**
 * A function for determining where the log statement should appear.
 * Normally it would be the line before/after the caret but since for some odd reason some languages prefer to
 * put the opening braces on their own separate lines, we have to identify a lineToLog that may not be one the
 * same line as the caret and an 'anchor line' that indicates where the log statement should go so that we avoid
 * placing a log statement between a function declaration and its opening brace.
 *
 * @param document The vscode document
 * @param selection The selection representing the caret position
 * @param lineToLog The line of code that was identified as best for logging
 * @param logDirection The direction we're trying to log in
 * @returns A TextLine representing the line of code after/before which the log statement should appear
 */
function findAnchorLine(document: vscode.TextDocument, selection: vscode.Selection, lineToLog: vscode.TextLine, logDirection = 1 | -1): vscode.TextLine {
  if (logDirection === -1) return lineToLog;

  const currentLine = document.lineAt(selection.active.line);
  if (selection.active.line > lineToLog.lineNumber) return currentLine;
  if (document.lineCount - 1 === selection.active.line) return currentLine;

  const nextLine = document.lineAt(lineToLog.lineNumber + 1);
  if (/^\s*[{[(]\s*$/.test(nextLine.text)) return nextLine;
  return currentLine;
}

/**
 * A function for getting the correct indentation for the log statement.
 * First it detects the current indent size from lineToLog.
 * If the anchor line contains opening or closing code blocks the indent size is adjust accordingly.
 *
 * @param editor THe active editor
 * @param lineToLog The line of code that was identified as best for logging
 * @param logAnchor The line of code that was identified as the line before/after the log statement should go
 * @param logDirection The direction of logging
 * @returns A string that can be prepended to the logStatement giving it the correct indentation
 */
function getIndentForLogStatement(editor: vscode.TextEditor, lineToLog: vscode.TextLine, logAnchor: vscode.TextLine, logDirection: 1 | -1): string {
  let indent: number = detectIndent(editor, lineToLog);
  if (logDirection === 1 && isOpeningCodeBlock(logAnchor.text)) indent += 1;
  else if (logDirection === -1 && isClosingCodeBlock(logAnchor.text)) indent += 1;
  return getIndentStr(editor, indent);
}

/**
 * Write the given statement to the document.
 *
 * @param editBuilder The current edit in process
 * @param statement The line of code to write
 * @param anchor The line of code before/after the new line of code should be written
 * @param logDirection Whether the line should be written before (-1) or after(1) the anchor line
 */
function writeStatement(editBuilder: vscode.TextEditorEdit, statement: string, anchor: vscode.TextLine, logDirection = 1 | -1) {
  if (logDirection === 1) editBuilder.insert(anchor.range.end, '\n' + statement);
  else editBuilder.insert(anchor.range.start, statement + '\n');
}

/**
 * Replace an exisitng line of code with a new statement.
 *
 * @param editBuilder The current edit in process
 * @param newStatement The statement to replace the line with
 * @param line The line of code that should be replaced
 */
function replaceStatement(editBuilder: vscode.TextEditorEdit, newStatement: string, line: vscode.TextLine) {
  editBuilder.replace(line.range, newStatement);
}

/**
 * A factory function that creates a LogMagic function that creats new log statements and rotates
 * existing ones in the given direction.
 *
 * @param logDirection Whether the function should log downwards (1) or upwards(-1)
 * @returns a LogMagic function
 */
function createLogMagicFn(logDirection: -1 | 1) {
  return async function logMagic() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const boundEnsureLogId = (parseResult: ParseResult): ParseResult => ensureLogId(parseResult, editor.selection.active.line, logDirection);

    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('logMagic', editor.document);
    const defaultLanguage = languageSettingToLanguageId(configuration.get('defaultLanguage')) || 'javascript';
    const documentLanguage = editor.document.languageId || defaultLanguage;

    const magic = await getMagicItem(documentLanguage, defaultLanguage);

    // Fetch configuration overrides

    const loggerConfigOverride: LoggerConfig | undefined = configuration.get('logFormats');
    let magicOverride: MagicItemOverride | null = null;
    if (loggerConfigOverride?.length) {
      const errorMsg = validateLoggerConfig(loggerConfigOverride);
      if (!errorMsg) {
        magicOverride = <MagicItemOverride>{
          log: createLogger(loggerConfigOverride[0]),
          rotateLog: createLogRotator(loggerConfigOverride),
        };
      } else {
        vscode.window.showErrorMessage('LogMagic: Using default configuration since the provided configuration is invalid.\n' + errorMsg);
      }
    }

    // Sort selections so we can use their indexes so in case of multiple cursors we know how much previous log statements have offset the line numbers
    const selections = editor.selections.sort((a: vscode.Selection, b: vscode.Selection) => a.active.line - b.active.line);
    // Callbacks for changing caret positions after outputting the log statements
    const selectionChanges: ((i: number) => vscode.Selection)[] = [];

    const success = await editor.edit((editBuilder: vscode.TextEditorEdit): void => {
      selections.forEach((selection) => {
        try {
          const lineToLog: vscode.TextLine = findContentfulLine(editor.document, selection);
          const logAnchor: vscode.TextLine = findAnchorLine(editor.document, selection, lineToLog, logDirection);
          const indent = getIndentForLogStatement(editor, lineToLog, logAnchor, logDirection);

          // First try rotating the log statement. If it fails, create a new log statement

          let logStatement: string | null = (magicOverride?.rotateLog || magic.rotateLog)(magic.tokenize(lineToLog.text.trim()), logDirection);
          if (logStatement) {
            replaceStatement(editBuilder, indent + logStatement, lineToLog);
            selectionChanges.push((selectionIndex: number) => {
              const localCaretPos = magic.getCaretPosition(logStatement!);
              const caretPos: vscode.Position = logAnchor.range.start.translate(selectionIndex, indent.length + localCaretPos);
              return new vscode.Selection(caretPos, caretPos);
            });
          } else {
            logStatement = (magicOverride?.log || magic.log)(boundEnsureLogId(magic.parse(magic.tokenize(lineToLog.text.trim()))));
            writeStatement(editBuilder, indent + logStatement, logAnchor, logDirection);
            selectionChanges.push((selectionIndex: number) => {
              const localCaretPos = magic.getCaretPosition(logStatement!);
              const downardsOffset = Math.max(0, logDirection) + selectionIndex;
              const caretPos: vscode.Position = logAnchor.range.start.translate(downardsOffset, indent.length + localCaretPos);
              return new vscode.Selection(caretPos, caretPos);
            });
          }
        } catch (e) {
          console.error(e);
        }
      });
    });

    // Move carets

    if (success) {
      const newSelections: vscode.Selection[] = [];
      for (let i = 0; i < selections.length; i++) {
        const change = selectionChanges[i];
        if (!change) continue;
        newSelections.push(change(i));
      }
      editor.selections = newSelections;
    }
  };
}

async function removeAllLogStatements() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('logMagic', editor.document);
  const defaultLanguage = languageSettingToLanguageId(configuration.get('defaultLanguage')) || 'javascript';
  const documentLanguage = editor.document.languageId || defaultLanguage;

  const magic = await getMagicItem(documentLanguage, defaultLanguage);

  await editor.edit((editBuilder: vscode.TextEditorEdit): void => {
    for (let i = 0; i < editor.document.lineCount; i++) {
      const line = editor.document.lineAt(i);
      if (magic.isLogStatement(line.text)) {
        editBuilder.delete(line.rangeIncludingLineBreak);
      }
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('logmagic.logDown', createLogMagicFn(1)));
  context.subscriptions.push(vscode.commands.registerCommand('logmagic.logUp', createLogMagicFn(-1)));
  context.subscriptions.push(vscode.commands.registerCommand('logmagic.removeAllLogStatements', removeAllLogStatements));
}

export function deactivate() {
  clearCache();
}
