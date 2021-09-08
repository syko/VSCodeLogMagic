import {Token, TOKEN_IDENTIFIER, TOKEN_OPERATOR, TOKEN_PUNCTUATION, TOKEN_STRING} from "./tokenizer";
import {ParseResult, ParseStep} from "./parser";

/**
 * Return a code block (a section of code wrapped in (), [], {} or <>) start starts or ends at startIndex.
 * Nested code blocks are ignored.
 * 
 * @param tokens Array of tokens in which the code block is searched for
 * @param startIndex The index at which the code block starts or ends (based on direction)
 * @param direction The direction in which to look for the code block starting from startIndex. -1 or 1.
 * @returns Array of tokens that form the code block, including the wrapping characters.
 */
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

/**
 * Return an expression start starts or ends at startIndex. An expression is considered anything that starts
 * at startIndex, which is not an expression-break character and expands in the given direction until
 * an expression-break character is found: either , or ; or a paren/bracket/brace that ends/begins the current code block.
 * 
 * @param tokens Array of tokens in which the expression is searched for
 * @param startIndex The index at which the expression starts or ends (based on direction)
 * @param direction The direction in which to look for the expression starting from startIndex. -1 or 1.
 * @returns Array of tokens that form the expression, including the wrapping characters.
 */
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
 
/**
 * Wraps the given string in quotation marks and also escapes the same quotation marks in the string.
 * 
 * @param str The string to wrap in quotation marks
 * @returns The quoted string
 */
export const quoteString = (str: string, quoteChar: string = '"'): string => {
	return `${quoteChar}${str.replace('${quoteChar}', '\\${quoteChar}')}${quoteChar}`
}

/**
 * Return a concatenated token value of the given array of tokens. Quotes string values as necessary.
 * 
 * @param tokens The tokens whose values to combine
 * @returns A string of concatenated token values
 */
export const combineTokenValues = (tokens: Token[]): string => {
	return tokens.reduce((acc: string, t: Token) => acc + (t.type === TOKEN_STRING ? quoteString('' + t.value) : t.value), '');
};