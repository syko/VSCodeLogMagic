// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {type} from 'os';
import {stringify} from 'querystring';
import * as vscode from 'vscode';
import {InputType} from 'zlib';
import {Parser, createParser} from './parser'
import {parseSequence, tokenizerConf} from './languages/csharp';

type ParserList = {
	[index: string]: Parser;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	const parsers: ParserList = {}

	function getParser(language: string) {
		if (!parsers[language]) parsers[language] = createParser(parseSequence, tokenizerConf);
		return parsers[language];
	}

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('logmagic.logDown', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// const editor = vscode.window.activeTextEditor;
		// if (!editor) return;
		// const {text} = editor.document.lineAt(editor.selection.active.line);
		// javascript, typescript, csharp
		const parse = getParser(vscode.window.activeTextEditor?.document.languageId || 'javascript');
		console.log("Result", parse(`} else if(123) { let varname = someFnCall(foo, _ => someCall(var1, var2), (foo) => foo + 123, (boo) => { return boo + 123 }, 999);`));

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
