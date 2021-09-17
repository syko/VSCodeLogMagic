// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {createTokenizer, Tokenizer} from './tokenizer';
import {Parser, createParser} from './parser'
import {createLogger, Logger} from './logger';
import {createLogRotator, LogRotator} from './logRotator';

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
 * A mapping between language ids and their corresponding magical items.
 */
type MagicItems = {
	[index: string]: MagicItem;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	const magicItems: MagicItems = {}

	/**
	 * Imports the components, creates and caches the magic for a given language.
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

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('logmagic.logDown', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// const editor = vscode.window.activeTextEditor;
		// if (!editor) return;
		// const {text} = editor.document.lineAt(editor.selection.active.line);
		// javascript, typescript, csharp
		const magic = await getMagicItem(vscode.window.activeTextEditor?.document.languageId || 'javascript');
		try {
			// console.log("Result", magic.log(magic.parse(magic.tokenize(`var foo = 123 + bar;`))));
			console.log("Rot", magic.rotateLog(magic.tokenize('Console.WriteLine("if:" + (someCall(a, b) + 123) + "foo:" + foo + "bar:" + [1,2,3]);') || ''));
		} catch (e) {
			console.error(e);
		}

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
