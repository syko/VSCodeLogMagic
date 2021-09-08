import {Token, TOKEN_IDENTIFIER, TOKEN_OPERATOR, TOKEN_PUNCTUATION, TOKEN_STRING} from "./tokenizer";
import {ParseResult, ParseStep} from "./parser";

export const getCodeBlockAt = (tokens: Token[], startIndex: number, direction: -1 | 1 = 1): Token[] => {
	const P: string = '{[(<>)]}';
	const initialParen: string = '' + tokens[startIndex].value;
	const includedTokens: Token[] = [tokens[startIndex]];
	let depth = 0;

	const isPuncOrOp = (t: Token): boolean => {
		return t.type == TOKEN_PUNCTUATION || t.type == TOKEN_OPERATOR;
	}

	const isSameParen = (t: Token): boolean => {
		return isPuncOrOp(t) && t.value === initialParen;
	}

	const isOppositeParen = (t: Token): boolean => {
		return isPuncOrOp(t) && t.value === P[P.length - 1 - P.indexOf(initialParen)];
	}

	if (!isPuncOrOp(tokens[startIndex]) || !P.includes(initialParen)) {
		throw new Error(`getCodeBlockAt requires one of ${P} to be at startIndex position`);
	}

	for (let i = startIndex + direction; i > 0 && i < tokens.length; i += direction) {
		includedTokens.push(tokens[i]);
		if (isSameParen(tokens[i])) depth++;
		else if (isOppositeParen(tokens[i])) depth--;
		if (depth === -1) break;
	}

	return includedTokens;
};

export const getExpressionAt = (tokens: Token[], startIndex: number, direction: -1 | 1 = 1): Token[] => {
	const P: string = '{[()]}';
	const openingP: string = '{[(';
	const closingP: string = ')]}';
	const includedTokens: Token[] = [tokens[startIndex]];
	const BREAK_CHARS: string = ',;';

	const isExpressionBreak = (t: Token): boolean => {
		return t.type === TOKEN_PUNCTUATION && BREAK_CHARS.includes('' + t.value);
	}

	const isExpressionBreakByParen = (t: Token): boolean => {
		return t.type === TOKEN_PUNCTUATION && (
			(direction == 1 && closingP.includes('' + t.value))
			|| (direction == -1 && openingP.includes('' + t.value))
		);
	}

	const isParen = (t: Token): boolean => {
		return t.type === TOKEN_PUNCTUATION && P.includes('' + t.value);
	}

	if (isExpressionBreak(tokens[startIndex])) {
		throw new Error("getExpressionAt: token at startIndex is not part of an expression");
	}

	for (let i = startIndex + direction; i >= 0 && i < tokens.length; i += direction) {
		if (isExpressionBreak(tokens[i])) break;
		if (isExpressionBreakByParen(tokens[i])) break;
		if (isParen(tokens[i])) {
			// Include whole code block
			const codeBlock = getCodeBlockAt(tokens, i, direction);
			includedTokens.push.apply(includedTokens, codeBlock);
			i += (codeBlock.length - 1) * direction;
		} else includedTokens.push(tokens[i]);
	}

	return includedTokens;
};

export const quoteString = (str: string): string => {
	return `"${str.replace('"', '\\"')}"`
}

export const combineTokenValues = (tokens: Token[]): string => {
	return tokens.reduce((acc: string, t: Token) => acc + (t.type === TOKEN_STRING ? quoteString('' + t.value) : t.value), '');
};