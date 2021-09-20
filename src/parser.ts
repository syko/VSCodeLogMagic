import {LogFormat} from "./logger";
import {
	Token,
	TokenType,
	TOKEN_COMMENT,
	TOKEN_IDENTIFIER,
	TOKEN_KEYWORD,
	TOKEN_NUMBER,
	TOKEN_OPERATOR,
	TOKEN_PUNCTUATION,
	TOKEN_STRING,
	TOKEN_WHITESPACE
} from "./tokenizer";
import {serializeTokens, getCodeBlockAt, getExpressionAt, isCompleteCodeBlock} from './util';

/**
 * A parse result is an objecting containing all the current parsed info at any point in the parse process.
 *
 * tokens: The current Token objects. The Tokenizer creates the initial array of tokens and parse steps
 *         normally remove tokens until there are only interesting ones left.
 * logItems: An array of arrays of Tokens. Each subarray is one "log item". When logging a random line of code
 *           each individual token left after parsing is its own "log item" (converted to a single-item array).
 *           The Log Rotator, however, tries to preserve multi-token log items and makes use of this.
 *           A "key:" is generated in front of each log item when generating the log line.
 * logId: A string token representing the "identifier" for the log statement. The logId is the first thing that
 *        is logged and a key is not generated for it. Usually a keyword or the name of the first identifier.
 * logFormat: When the ParseResult is given to a Logger function, it will use this LogFormat unless one is
              specified directly.
 */
;
export type ParseResult = {
	tokens: Token[];
	logItems: Token[][];
	logId?: Token;
	logFormat?: LogFormat;
};

/**
 * A function that takes a ParseResult and modifies it in place to achieve a slightly more parsed result.
 */
export type ParseStep = (result: ParseResult) => void;
// export interface ParseStep {(result: ParseResult): void};

/**
 * A function that returns a ParseStep.
 */
export type ParseStepFactory = (...parameters: any) => ParseStep;

/**
 * An array of ParseStep functions. The ParseStep functions are executed in sequence on the same ParseResult.
 * Once all steps have been executed, the string is considered fully parsed.
 */
export type ParseSequence = ParseStep[];

/**
 * A function that takes an array of Token objects and executes all the given parse steps on it in sequence.
 */
export type Parser = (tokens: Token[]) => ParseResult;

/**
 * A Custom Error class for cathcing parse errors.
 */
export class ParseError extends Error {
}

/**
 * Common parse functions for use in various ParseSequences. These are useful for many languages.
 */
export const common = {

	/**
	 * Return a ParseStep function that combines chained identifiers into one
	 * (eg. somePackage.someNamespace.someVariable becomes a single identifier token)
	 *
	 * @param chainingCharacters An array of characters that can chain identifiers together (probably ['.'] in most cases)
	 * @returns A ParseStep function
	 */
	getCombineIdentifierChainsFn: (chainingCharacters: string[]): ParseStep => {
		return (result: ParseResult): void => {
			const tokens = result.tokens;
			const newTokens: Token[] = [];
			let chain: Token[] | null = null;
			let seenDot = false;

			// n%2 fn in this array returns whether the given token is good for being the next link in the chain
			const isChainLink: {(t: Token): boolean}[] = [
				(t: Token) => t.type === TOKEN_IDENTIFIER,
				(t: Token) => t.type === TOKEN_PUNCTUATION && chainingCharacters.includes('' + t.value)
			];

			for (let i = 0; i < tokens.length; i++) {
				const token = tokens[i];
				if (token.type === TOKEN_IDENTIFIER) {
					// Identifier detected, accumulate a chain
					chain = [];
					for (let j = i; j < tokens.length; j++) {
						if (isChainLink[chain.length % 2](tokens[j])) chain.push(tokens[j]);
						else break;
					}
					if (isChainLink[1](chain[chain.length - 1])) chain.pop(); // Identifier can't end with a dot
					newTokens.push({type: TOKEN_IDENTIFIER, value: serializeTokens(chain)});
					i += chain.length - 1;
				} else {
					newTokens.push(token);
				}
			}

			result.tokens = newTokens;
		}
	},

	/**
	 * Return a ParseStep function for combining consecutive tokens into a single token.
	 * Eg. Specifying [['else', 'if'], ['not', 'in']] will combine consecutive 'else', 'if' and 'not', 'in' tokens into 'else if' and 'not in' tokens.
	 *
	 * @param types A whitelist of token types to consider when looking for matches
	 * @param newType What the type of the combined token should be
	 * @param valuesToCombine An array of keywords to combine. Each keyword is a sub-array with individual words as separate items.
	 * @param separator An optional separator string to use when joining token values
	 * @returns A ParseStep function for combining multi-word keywords.
	 */
	getCombineConsecutiveTokensFn: (types: TokenType[], newType: TokenType, valuesToCombine: string[][], separator: string = ''): ParseStep => {
		return (result: ParseResult): void => {
			const tokens = result.tokens;
			for (let i = 0; i < tokens.length; i++) {
				// match will be an item from valuesToCombine matches the tokens at current position
				const match: string[] | undefined = valuesToCombine.find((toCombine: string[]) => toCombine.every((v, j) => {
					return types.includes(tokens[i + j]?.type) && tokens[i + j]?.value === v;
				}));
				if (match) {
					tokens[i].type = newType;
					tokens[i].value = match.join(separator);
					tokens.splice(i + 1, match.length - 1);
				}
			}
		}
	},

	/**
	 * Combine bracket notation into a single identifier (eg. someArray[12] becomes a single identifier token).
	 * This also removes the "[12]" part from the tokens unless it contains another identifier (someArray[myVar + 1]).
	 * This way inner variables can still be used in the output.
	 * 
	 * @param result The result to parse and modify in place.
	 */
	combineBracketNotation: (result: ParseResult): void => {
		const tokens = result.tokens;
		for (let i = 0; i < tokens.length - 3; i++) {
			const token: Token = tokens[i];
			if (token.type !== TOKEN_IDENTIFIER) continue;
			// Detect if there's a '[' after an identifier and if so, get the whole [...] block
			if (tokens[i + 1].type !== TOKEN_PUNCTUATION || tokens[i + 1].value !== '[') continue;
			const block: Token[] = getCodeBlockAt(tokens, i + 1);
			// If code block does not end with ']', it's an incomplete block => ignore
			if (!isCompleteCodeBlock(block)) continue;
			token.value += serializeTokens(block);
			// Remove the [...] part unless there's an identifier in there
			if (!block.find((t: Token) => t.type === TOKEN_IDENTIFIER)) tokens.splice(i + 1, block.length);
		}
	},

	/**
	 * Remove all `params => expr`-style lambdas from the ParseResult.
	 * Supports parameters '(p1, p2) => doSomething(p1, p2)'
	 * Supports parameters without parentheses 'p => { return doSomething(p) }'
	 * Supports wrapped lambda bodies '(p) => { return doSomething(p) }'
	 * Does NOT remove incomplete lambdas '(p1, p2) => {'
     *
	 * @param result The result to parse and modify in place.
	 */
	removeLambdas: (result: ParseResult): void => {
		// Remove complete lambdas that may have a defined parameter list
		const tokens = result.tokens;
		let skippedLambdaIndex = 0;

		const findNextLambdaOperatorIndex = (tokens: Token[], fromIndex: number) => {
			return tokens.findIndex((t: Token, i: number) => i >= fromIndex && t.type === TOKEN_OPERATOR && t.value === '=>');
		}

		for (let q = 0; q < 9999; q++) { // q is just infinite loop protection
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

	/**
	 * Remove all function names from function calls (eg. 'doSomething(p1)' becomes '(p1)').
	 * @param result The result to parse and modify in place.
	 */
	removeFunctionNames: (result: ParseResult): void => {
		const isParen = (t?: Token) => !!t && t.type == TOKEN_PUNCTUATION && t.value === '(';
		result.tokens = result.tokens.filter((t: Token, i: number) => t.type !== TOKEN_IDENTIFIER || !isParen(result.tokens[i + 1]));
	},

	/**
	 * Remove all strings and numbers from the ParseResult.
	 * @param result The result to parse and modify in place.
	 */
	removeLiterals: (result: ParseResult): void => {
		result.tokens = result.tokens.filter((t: Token) => t.type !== TOKEN_STRING && t.type !== TOKEN_NUMBER);
	},

	/**
	 * Remove all punctuation from the ParseResult.
	 * @param result The result to parse and modify in place.
	 */
	removePunctuation: (result: ParseResult): void => {
		result.tokens = result.tokens.filter((t: Token) => t.type !== TOKEN_PUNCTUATION);
	},

	/**
	 * Remove all operators from the ParseResult.
	 * @param result The result to parse and modify in place.
	 */
	removeOperators: (result: ParseResult): void => {
		result.tokens = result.tokens.filter((t: Token) => t.type !== TOKEN_OPERATOR);
	},

	/**
	 * Remove all comments from the ParseResult.
	 * @param result The result to parse and modify in place.
	 */
	removeComments: (result: ParseResult): void => {
		result.tokens = result.tokens.filter((t) => t.type !== TOKEN_COMMENT);
	},

	/**
	 * Remove all comments from the ParseResult.
	 * @param result The result to parse and modify in place.
	 */
	removeWhitespace: (result: ParseResult): void => {
		result.tokens = result.tokens.filter((t) => t.type !== TOKEN_WHITESPACE);
	},

	/**
	 * Remove everything that's not an identifier from the ParseResult.
	 * This should probably be called as the last step in the ParseSequence.
	 *
	 * @param result The result to parse and modify in place.
	 */
	removeNonIdentifiers: (result: ParseResult): void => {
		result.tokens = result.tokens.filter((t: Token) => t.type === TOKEN_IDENTIFIER);
	},

	/**
	 * Return a ParseStep function for determining the best log Id for the ParseResult.
	 * If it finds one of the specified keywords in the remaining tokens, it uses that. Otherwise it uses the first identifier it can find.
	 * If it can't find anything, the logId is left as undefined.
	 *
	 * @param interestingKeywords An array of keywords to consider for the logId. All others are ignored.
	 * @returns A ParseStep function for setting the logId property.
	 */
	getSetDefaultIdFn: (interestingKeywords: string[]): ParseStep => {
		return (result: ParseResult): void => {
			// Either use first interesting keyword or first identifier
			let t: Token | undefined = result.tokens.find((t: Token) => t.type === TOKEN_KEYWORD && interestingKeywords.includes('' + t.value));
			if (!t) t = result.tokens.find((t: Token) => t.type === TOKEN_IDENTIFIER);
			if (t) result.logId = {...t};
		}
	},

	/**
	 * A ParseStep function that removes duplicate tokens.
	 *
	 * @param result The result to parse and modify in place.
	 */
	removeDuplicates: (result: ParseResult): void => {
		result.tokens = result.tokens.filter((t: Token, i: number) => !result.tokens.find((t2: Token, j: number) => t2.type === t.type && t2.value === t.value && j < i))
	},

	/**
	 * Take all the tokens in the ParseResult and store each one individually as an item to log.
	 * You want to do this as the last parse step.
	 *
	 * @param result The result to parse and modify in place.
	 */
	storeTokensAsLogItems: (result: ParseResult): void => {
		result.logItems = result.tokens.map((t: Token) => [t]);
	}
};

/**
 * A function that creates a Parser using the given sequence and tokenizer configuration.
 * @param sequence The sequence which is used to parse the input string.
 * @returns A Parser function
 */
export function createParser(sequence: ParseSequence): Parser {

	const parse: Parser = (tokens: Token[]): ParseResult => {
        const result: ParseResult = { tokens: tokens, logItems: [] };
		sequence.forEach((fn: ParseStep) => fn(result));
        return result;

	}

	return parse;
}