// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {createTokenizer, Tokenizer, TOKEN_STRING} from './tokenizer';
import {Parser, createParser, ParseResult} from './parser'
import {createLogger, LogFormat, Logger, LoggerConfig, validateLoggerConfig} from './logger';
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
	getCaretPosition: (logStatement: string) => number;
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
 * @param languageId The language id
 * @returns The MagicItem for the language
 */
async function getMagicItem(languageId: string, fallbackId: string = 'javascript'): Promise<MagicItem> {
	if (!magicItems[languageId]) {
		try {
			const { parseSequence, tokenizerConfig, loggerConfig, getCaretPosition } = await import('./languages/' + languageId);
			magicItems[languageId] = <MagicItem>{
				tokenize: createTokenizer(tokenizerConfig),
				parse: createParser(parseSequence),
				log: createLogger(loggerConfig[0]),
				rotateLog: createLogRotator(loggerConfig),
				getCaretPosition: getCaretPosition || createDefaultGetCaretPositionFn(loggerConfig)
			};
		} catch (e) {
			return getMagicItem(fallbackId); // Return default parser if no direct implementation for this language exists
		}
	}
	return magicItems[languageId];
}

/**
 * A function for converting an editor default language setting value to its corresponding
 * languageId / module name. (eg. converts 'C#' into 'csharp')
 *
 * @param setting The setting value
 * @returns The corresponding module name (file from ./languages)
 */
function languageSettingToModuleName(setting: string | undefined) {
	if (!setting) return setting;
	return {
		'javascript': 'javascript',
		'C#': 'csharp'
	}[setting];
}

/**
 * A function for determining where the caret should be positioned after logging the line.
 * Each language can implement and export their own getDefaultCaretPosition function but if none
 * is provided this default function is used instead.
 *
 * The default function puts the caret at the end of the log statement just before the log suffix.
 *
 * @param logStatement The  log statement where the caret goes
 * @returns A position index where the caret should be placed in the given log statement
 */
const createDefaultGetCaretPositionFn = (loggerConfig: LoggerConfig) => {
	return (logStatement: string): number => {
		for (let i = 0; i < loggerConfig.length; i++) {
			const logFormat: LogFormat = loggerConfig[i];
			if(logStatement.endsWith(logFormat.logSuffix)) return logStatement.length - logFormat.logSuffix.length;
		}
		return logStatement.length - 1;
	};
}

function getIndentStr(editor: vscode.TextEditor, n: number): string {
	return editor.options.insertSpaces ? '                                '.substr(0, editor.options.tabSize as number * n) : '\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t'.substr(0, n);
}

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
 * @param editor The vscode TextEditor
 * @param logDirection The invoked logMagic direction
 * @returns The first meaningful line of code found
 */
function findContentfulLine(document: vscode.TextDocument, selection: vscode.Selection, logDirection: -1 | 1): vscode.TextLine {
	let line;
	let lineNr = selection.active.line;
	do {
		line = document.lineAt(lineNr);
		lineNr -= 1;
	} while (/^\s*[\{\[\()]+\s*$/.test(line.text) && lineNr >= 0);
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
	else if (logDirection === -1 && isClosingCodeBlock(logAnchor.text)) indent += 1;
	return getIndentStr(editor, indent);
}

function writeStatement(editBuilder: vscode.TextEditorEdit, statement: string, anchor: vscode.TextLine, logDirection = 1 | -1) {
	if(logDirection === 1) editBuilder.insert(anchor.range.end, '\n' + statement);
	else editBuilder.insert(anchor.range.start, statement + '\n');
}

function replaceStatement(editBuilder: vscode.TextEditorEdit, newStatement: string, line: vscode.TextLine) {
	editBuilder.replace(line.range, newStatement);
}

function createLogMagicFn(logDirection: -1 | 1) {
	return async function() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		
		const _ensureLogId = (parseResult: ParseResult): ParseResult => ensureLogId(parseResult, editor.selection.active.line);

		const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('logMagic', editor.document);
		const defaultLanguage = languageSettingToModuleName(configuration.get('defaultLanguage')) || 'javascript';
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
					rotateLog: createLogRotator(loggerConfigOverride)
				}
			} else {
				vscode.window.setStatusBarMessage('LogMagic: Using default configuration since the provided configuration is invalid: ' + errorMsg, 5000);
			}
		}

		// Sort selections so we can use their indexes so in case of multiple cursors we know how much previous log statements have offset the line numbers
		const selections = editor.selections.sort((a: vscode.Selection, b: vscode.Selection) => a.active.line - b.active.line);
		// Callbacks for changing caret positions after outputting the log statements
		const selectionChanges: ((i: number) => vscode.Selection)[] = [];
		
		const success = await editor.edit((editBuilder: vscode.TextEditorEdit): void => {
			selections.forEach(selection => {
				try {
					
					const lineToLog: vscode.TextLine = findContentfulLine(editor.document, selection, logDirection);
					const logAnchor: vscode.TextLine = findAnchorLine(editor.document, selection, lineToLog, logDirection);
					const indent = getIndentForLogStatement(editor, lineToLog, logAnchor, logDirection);

					// First try rotating the log statement. If it fails, create a new log statement

					let logStatement: string | null = magic.rotateLog(magic.tokenize(lineToLog.text.trim()), logDirection);
					if (logStatement) {
						replaceStatement(editBuilder, indent + logStatement, lineToLog);
						selectionChanges.push((selectionIndex: number) => {
							const localCaretPos = magic.getCaretPosition(logStatement!);
							const caretPos: vscode.Position = logAnchor.range.start.translate(selectionIndex, indent.length + localCaretPos);
							return new vscode.Selection(caretPos, caretPos);
						});
					} else {
						logStatement = (magicOverride?.log || magic.log)(_ensureLogId(magic.parse(magic.tokenize(lineToLog.text.trim()))));
						writeStatement(editBuilder, indent + logStatement, logAnchor, logDirection);
						selectionChanges.push((selectionIndex: number) => {
							const localCaretPos = magic.getCaretPosition(logStatement!);
							const downardsOffset = Math.max(0, logDirection) + selectionIndex;
							const caretPos: vscode.Position = logAnchor.range.start.translate(downardsOffset, indent.length + localCaretPos);
							return new vscode.Selection(caretPos, caretPos);
						});
					}

					// TODO: cleanup README & stuff
					// TODO: javascript
					// LAUNCHABLE
					// TODO: remove all log lines command
					// TODO: Shorten keys
					// TODO: How to detect unity?
					// TODO: unify function declaration syntaxes
					// TODO: tests
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
