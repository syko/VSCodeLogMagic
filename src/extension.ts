// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {createTokenizer, Tokenizer, TOKEN_STRING} from './tokenizer';
import {Parser, createParser, ParseResult} from './parser'
import {createLogger, Logger, LoggerConfig, validateLoggerConfig} from './logger';
import {createLogRotator, LogRotator} from './logRotator';
import {ensureLogId, isClosingCodeBlock, isOpeningCodeBlock} from './util';

/**
 * A magical item allowing us to output a log statement with a single keypress.
 */
type MagicItem = {
	tokenize: Tokenizer;
	parse: Parser;
	log: Logger;
	rotateLog: LogRotator;
}
/**
 * A magical item allowing us to output a log statement with a single keypress.
 */
type MagicItemOverride = {
	log: Logger;
	rotateLog: LogRotator;
}

/**
 * A mapping between language ids and their corresponding magical items.
 */
type MagicItems = {
	[index: string]: MagicItem;
}

let magicItems: MagicItems = {}

/**
 * Imports the components, creates and caches the magic for a given language.
 * The MagicItems only include default log formats. User-defined configuration is not included.
 *
 * @param language The language id
 * @returns The MagicItem for the language
 */
async function getMagicItem(language: string): Promise<MagicItem> {
	if (!magicItems[language]) {
		try {
			const { parseSequence, tokenizerConfig, loggerConfig } = await import('./languages/csharp');
			// setUserSettings(loggerConfig, getVSCodeSettings(language));
			magicItems[language] = <MagicItem>{
				tokenize: createTokenizer(tokenizerConfig),
				parse: createParser(parseSequence),
				log: createLogger(loggerConfig[0]),
				rotateLog: createLogRotator(loggerConfig)
			};
		} catch (e) {
			return getMagicItem('csharp'); // Return default parser if no specific implementation for this language exists
		}
	}
	return magicItems[language];
}

function languageSettingToModuleName(setting: string | undefined) {
	if (!setting) return setting;
	return {
		'javascript': 'javascript',
		'C#': 'csharp'
	}[setting];
}

function getIndentStr(editor: vscode.TextEditor, n: number): string {
	return editor.options.insertSpaces ? '                                '.substr(0, editor.options.tabSize as number * n) : '\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t'.substr(0, n);
}

function detectIndent(editor: vscode.TextEditor, line: vscode.TextLine) {
	return Math.round(line.firstNonWhitespaceCharacterIndex / getIndentStr(editor, 1).length);
}

/**
 * A function that starts inspecting the lines at the current cursor position and looks for a line of code
 * that has content beyond "}" or similar and returns it.
 *
 * It only looks beyond the current line if logDirection is 1 since when loggin upwards it doesn't make sense
 * grab stuff from down below, but when logging downwards we want to grab the closest interesting
 * stuff from previous lines. We cannot just consider the current line because of inexplicable syntax conventions that put
 * opening braces on separate lines.
 * 
 * @param editor THe vscode TextEditor
 * @param logDirection The invoked logMagic direction
 * @returns The first meaningful line of code found
 */
function findContentfulLine(document: vscode.TextDocument, selection: vscode.Selection, logDirection: -1 | 1): vscode.TextLine {
	let line;
	let lineNr = selection.active.line;
	do {
		line = document.lineAt(lineNr);
		lineNr -= 1;
	} while (!/\w/.test(line.text) && logDirection === 1 && lineNr >= 0);
	return line;
}

function findAnchorLine(document: vscode.TextDocument, selection: vscode.Selection, lineToLog: vscode.TextLine, logDirection = 1 | -1): vscode.TextLine {
	if (logDirection === -1) return lineToLog;

	const currentLine = document.lineAt(selection.active.line);
	if (selection.active.line > lineToLog.lineNumber) return currentLine;
	if (document.lineCount - 1 == selection.active.line) return currentLine;

	const nextLine = document.lineAt(lineToLog.lineNumber + 1);
	if (/^\s*[\{\[\(]\s*$/.test(nextLine.text)) return nextLine;
	else return currentLine;
}

function getIndentForLogStatement(editor: vscode.TextEditor, lineToLog: vscode.TextLine, logAnchor: vscode.TextLine, logDirection: 1 | -1): string {
	let indent: number = detectIndent(editor, lineToLog);
	if (logDirection === 1 && isOpeningCodeBlock(logAnchor.text)) indent += 1;
	else if (logDirection === -1 && isClosingCodeBlock(logAnchor.text)) indent -= 1;
	return getIndentStr(editor, indent);
}

function writeStatement(editBuilder: vscode.TextEditorEdit, statement: string, anchor: vscode.TextLine, logDirection = 1 | -1) {
	if(logDirection === 1) editBuilder.insert(anchor.range.end, '\n' + statement);
	else editBuilder.insert(anchor.range.start, statement + '\n');
}

function replaceStatement(editBuilder: vscode.TextEditorEdit, line: vscode.TextLine, newStatement: string) {
	editBuilder.replace(line.range, newStatement);
}

function createLogMagicFn(logDirection: -1 | 1) {
	return async function() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('logMagic', editor.document);

		const _ensureLogId = (parseResult: ParseResult): ParseResult => ensureLogId(parseResult, editor.selection.active.line);

		const documentLanguage = editor.document.languageId || languageSettingToModuleName(configuration.get('defaultLanguage')) || 'javascript';
		const magic = await getMagicItem(documentLanguage);

		// Fetch configuration overrides

		const loggerConfigOverride: LoggerConfig | undefined = configuration.get('logFormats');
		let magicOverride: MagicItemOverride | null = null;
		if (loggerConfigOverride?.length) {
			const errorMsg = validateLoggerConfig(loggerConfigOverride);
			if (!errorMsg) {
				magicOverride = <MagicItemOverride>{
					log: createLogger(loggerConfigOverride[0]),
					rotateLog: createLogRotator(loggerConfigOverride)
				}
			} else {
				vscode.window.setStatusBarMessage('LogMagic: Using default configuration since the provided configuration is invalid: ' + errorMsg, 5000);
			}
		}
		
		editor.edit((editBuilder: vscode.TextEditorEdit): void => {
			editor.selections.forEach(selection => {
				try {
					
					const lineToLog: vscode.TextLine = findContentfulLine(editor.document, selection, logDirection);
					const logAnchor: vscode.TextLine = findAnchorLine(editor.document, selection, lineToLog, logDirection);
					const indent = getIndentForLogStatement(editor, lineToLog, logAnchor, logDirection);

					const rotatedStatement = magic.rotateLog(magic.tokenize(lineToLog.text));
					if (rotatedStatement) {
						replaceStatement(editBuilder, lineToLog, rotatedStatement);
					} else {
						const logStatement = indent + (magicOverride?.log || magic.log)(_ensureLogId(magic.parse(magic.tokenize(lineToLog.text.trim()))));
						writeStatement(editBuilder, logStatement, logAnchor, logDirection);
					}

					// indent = contentful line firstNonWhitespaceCharacterIndex
					// DOWN:
					// line to log after = current or next if next line == {,[,(
					// detect if line to log after contains extra { or ends with:, indent++
					// insert at range end: newline + indent + statement
					// UP:
					// line to log before = current
					// detect if line to log before contains extra },],), indent--
					// insert at range start: indent + statement + newline
					// TODO: cleanup README & stuff
					// TODO: csharp
					// TODO: javascript
					// LAUNCHABLE
					// TODO: remove all log lines command
					// TODO: How to detect unity?
					// TODO: unify function declaration syntaxes
					// TODO: tests
				} catch (e) {
					console.error(e);
				}
			});
		});

	}
}

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('logmagic.logDown', createLogMagicFn(1));
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('logmagic.logUp', createLogMagicFn(-1));
	context.subscriptions.push(disposable);
}

export function deactivate() {
	magicItems = {};
}
