import {opendir} from "fs";
import {start} from "repl";
import {CallHierarchyIncomingCall, SemanticTokensBuilder} from "vscode";
import {tokenizerConf} from "./languages/csharp";
import { createTokenizer, Token, Tokenizer, TokenizerConf, TOKEN_COMMENT, TOKEN_IDENTIFIER, TOKEN_IDENTIFIER_CHAIN, TOKEN_KEYWORD, TOKEN_NUMBER, TOKEN_OPERATOR, TOKEN_PUNCTUATION, TOKEN_STRING } from "./tokenizer";
import {combineTokenValues, getCodeBlockAt, getExpressionAt} from './util';

export type ParseResult = {
	logId: string;
	tokens: Token[];
};

export type ParseStep = (result: ParseResult) => void;

export type ParseStepFactory = () => ParseStep;

export type ParseSequence = ParseStep[];

export type Parser = (input: string) => ParseResult;


// ======================
// Common Parse Functions
// ======================

export const common = {

	removeComments: <ParseStep>(result: ParseResult): void => {
		result.tokens = result.tokens.filter((t) => t.type !== TOKEN_COMMENT);
	},

	combineIdentifierChains: <ParseStep>(result: ParseResult): void => {
		const tokens = result.tokens;
		const newTokens: Token[] = [];
		let chain: Token[] | null = null;
		let seenDot = false;

		// n%2 fn in this array returns whether the given token is good for being the next link in the chain
		const isChainLink: {(t: Token): boolean}[] = [
			(t: Token) => t.type === TOKEN_IDENTIFIER,
			(t: Token) => t.type === TOKEN_PUNCTUATION && t.value === TOKEN_IDENTIFIER_CHAIN
		];

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (token.type === TOKEN_IDENTIFIER) {
				// Identifier detected, start accumulating a chain
				chain = [];
				for (let j = i; j < tokens.length; j++) {
					if (isChainLink[chain.length % 2](tokens[j])) chain.push(tokens[j]);
					else break;
				}
				if (isChainLink[1](chain[chain.length - 1])) chain.pop(); // Identifier can't end with a dot
				newTokens.push({type: TOKEN_IDENTIFIER, value: combineTokenValues(chain)});
				i += chain.length - 1;
			} else {
				newTokens.push(token);
			}
		}

		result.tokens = newTokens;
	},

	combineBracketNotation: <ParseStep>(result: ParseResult): void => {
		const tokens = result.tokens;
		for (let i = 0; i < tokens.length - 3; i++) {
			const token: Token = tokens[i];
			if (token.type !== TOKEN_IDENTIFIER) continue;
			if (tokens[i + 1].type !== TOKEN_PUNCTUATION || tokens[i + 1].value !== '[') continue;
			const block: Token[] = getCodeBlockAt(tokens, i + 1);
			if (block[block.length - 1].type !== TOKEN_PUNCTUATION || block[block.length - 1].value !== ']') continue;
			token.value += combineTokenValues(block);
			if (!block.find((t: Token) => t.type === TOKEN_IDENTIFIER)) tokens.splice(i + 1, block.length);
		}
	},

	removeLambdas: <ParseStep>(result: ParseResult): void => {
		// Remove complete lambdas that may have a defined parameter list
		const tokens = result.tokens;
		let skippedLambdaIndex = 0;

		const findNextLambdaOperatorIndex = (tokens: Token[], fromIndex: number) => {
			return tokens.findIndex((t: Token, i: number) => i >= fromIndex && t.type === TOKEN_OPERATOR && t.value === '=>');
		}

		while (true) {
			let startIndex: number, endIndex: number;
			let t: Token;
			const operatorIndex: number = findNextLambdaOperatorIndex(tokens, skippedLambdaIndex + 1);
			if (operatorIndex == -1) break;

			// Set endIndex to point to the end of the lambda expression
			t = tokens[operatorIndex + 1];
			if (t?.type === TOKEN_PUNCTUATION && t?.value === '{') endIndex = operatorIndex + getCodeBlockAt(tokens, operatorIndex + 1).length;
			else endIndex = operatorIndex + getExpressionAt(tokens, operatorIndex + 1).length;

			if (tokens[endIndex].type === TOKEN_PUNCTUATION && tokens[endIndex].value === '{') {
				// This is an open multiline lambda / function definition. Let's not remove that
				skippedLambdaIndex = operatorIndex;
				continue;
			}

			// Set startIndex to point to the start of the lambda expression
			t = tokens[operatorIndex - 1];
			if (t?.type === TOKEN_PUNCTUATION && t?.value === ')') startIndex = operatorIndex - getCodeBlockAt(tokens, operatorIndex - 1, -1).length;
			else if (t?.type === TOKEN_IDENTIFIER) startIndex = operatorIndex - 1;
			else startIndex = operatorIndex; // Dunno wth is preceding the lambda operator - just leave it be

			tokens.splice(startIndex, endIndex - startIndex + 1);
		}
	},

	removeFunctionNames: <ParseStep>(result: ParseResult): void => {
		const isParen = (t?: Token) => !!t && t.type == TOKEN_PUNCTUATION && t.value === '(';
		result.tokens = result.tokens.filter((t: Token, i: number) => t.type !== TOKEN_IDENTIFIER || !isParen(result.tokens[i + 1]));
	},

	removeLiterals: <ParseStep>(result: ParseResult): void => {
		result.tokens = result.tokens.filter((t: Token) => t.type !== TOKEN_STRING && t.type !== TOKEN_NUMBER);
	},

	removePunctuation: <ParseStep>(result: ParseResult): void => {
		result.tokens = result.tokens.filter((t: Token) => t.type !== TOKEN_PUNCTUATION);
	},

	removeOperators: <ParseStep>(result: ParseResult): void => {
		result.tokens = result.tokens.filter((t: Token) => t.type !== TOKEN_OPERATOR);
	},

	removeNonIdentifiers: <ParseStep>(result: ParseResult): void => {
		result.tokens = result.tokens.filter((t: Token) => t.type === TOKEN_IDENTIFIER);
	},

	getCombineCommonMultiWordKeywordsFn: <ParseStepFactory> (keywords: string[][]) => {
		return <ParseStep>(result: ParseResult): void => {
			const tokens = result.tokens;
			for (let i = 0; i < tokens.length; i++) {
				const foundKeyword: string[] | undefined = keywords.find((kw: string[]) => kw.every((w, j) => {
					return tokens[i + j]?.type == TOKEN_KEYWORD && tokens[i + j]?.value === w;
				}));
				if (foundKeyword) {
					tokens[i].value = foundKeyword.join(' ');
					tokens.splice(i + 1, foundKeyword.length - 1);
				}
			}
		}
	},

	getSetDefaultIdFn: <ParseStepFactory>(interestingKeywords: string[]) => {
		return <ParseStep>(result: ParseResult): void => {
			// Either use first interesting keyword or first identifier
			let t: Token | undefined = result.tokens.find((t: Token) => t.type === TOKEN_KEYWORD && interestingKeywords.includes('' + t.value));
			if (!t) t = result.tokens.find((t: Token) => t.type === TOKEN_IDENTIFIER);
			if (t) result.logId = '' + t.value;
		}
	}
};

export function createParser(sequence: ParseSequence, tokenConf: TokenizerConf): Parser {

    const tokenize: Tokenizer = createTokenizer(tokenConf);

    // Main

	function parse(input: string) {
        const result: ParseResult = { logId: '', tokens: tokenize(input) };
		sequence.forEach((fn: ParseStep) => fn(result));
        return result;

	}

	return parse;
}