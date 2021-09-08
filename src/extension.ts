// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {type} from 'os';
import {stringify} from 'querystring';
import * as vscode from 'vscode';
import {InputType} from 'zlib';
import {Parser, createParser} from './parser'

type ParserList = {
	[index: string]: Parser;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	const parsers: ParserList = {}

	async function getParser(language: string): Promise<Parser> {
		if (!parsers[language]) {
			try {
				const { parseSequence, tokenizerConf } = await import('./languages/csharp');
				parsers[language] = createParser(parseSequence, tokenizerConf);
			} catch (e) {
				return getParser('csharp'); // Return default parser if no specific implementation for this language exists
			}
		}
		return parsers[language];
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
		const parse = await getParser(vscode.window.activeTextEditor?.document.languageId || 'javascript');
		try {
			console.log("Result", parse(`if(someVar[123] == 123) { foo(someVar["fo\\"o", "bar"])}`));
		} catch (e) {
			console.error(e);
		}

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
