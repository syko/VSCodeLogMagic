import {Token, TokenType, TOKEN_IDENTIFIER, TOKEN_OPERATOR, TOKEN_PUNCTUATION, TOKEN_STRING, TOKEN_WHITESPACE} from './tokenizer';
import {ParseError, ParseResult, ParseSequence, ParseStep, ParseStepFactory} from './parser';
import {log, LogFormat, LoggerConfig} from './logger';
import {getCodeBlockAt, isCompleteCodeBlock, popColon, serializeToken} from './util';

/**
 * A LogRotator is a function that takes a tokenized log statement, rotates the logPrefixes and logSuffixes and returns
 * a new log statement.
 *
 * For example, given the LoggerConfig of {logPrefixes: ['console.log(', 'console.warn('], logSuffixes: [');']} passing
 * the LogRotator a string 'console.log(something);' will return 'console.warn(something);'.
 *
 * Both logPrefixes and logSuffixes are rotated but if there are more prefixes than suffixes then the last suffix in the array
 * is used for prefixes that don't have a corresponding suffix in the array (see above example). 
 *
 * If the statement can't be rotated, null is returned.
 * 
 * The LogRotator implements its own log statement parser that works differently from the normal parser. It tries to preserve
 * everything that is logged so that all kinds of log statements can be rotated.
 */
export type LogRotator = (tokens: Token[]) => string | null;

function getMatchingTokens(tokens: Token[], str: string, index: number = 0, direction: number = 1): Token[] {
	let serializedStr: string = '';
	for (let i = index; i >= 0 && i < tokens.length; i += direction) {
		serializedStr = direction === 1 ? serializedStr + serializeToken(tokens[i]): serializeToken(tokens[i]) + serializedStr;
		if (serializedStr === str) return tokens.slice(Math.min(index, i), Math.max(i + 1, index + 1));
	}
	return [];
}

/**
 * Return a ParserStep function that matches each LogFormat's logPrefix against the beginning of the log statement until 
 * a match is found and stores the LogFormat in the ParseResult.
 * The matched logPrefix tokens are then removed.
 * The LogFormat is used in later ParseStep functions.
 *
 * @param config The LoggerConfig to use for parsing the log statement
 * @returns A ParseStep function
 */
const getDetectLogFormatFn: ParseStepFactory = (config: LoggerConfig): ParseStep => {
	return (result: ParseResult): void => {
		for (let i = 0; i < config.length; i++) {
			const format: LogFormat = config[i];

			const matchingTokens = getMatchingTokens(result.tokens, format.logPrefix);
			if (!matchingTokens.length) continue;

			result.logFormat = format;
			result.tokens.splice(0, matchingTokens.length);
			return;
		}
		throw new ParseError("LogMagic: Failed to parse log statement: no matching log format found.");
	};
};

/**
 * A ParserStep function that matches each LogFormat's logSuffix against the end of the log statement and
 * removes the matching tokens.
 *
 * @param result The result to parse and modify in place
 */
const removeLogSuffix: ParseStep = (result: ParseResult): void => {
	const matchingTokens = getMatchingTokens(result.tokens, result.logFormat?.logSuffix || '', result.tokens.length - 1, -1);
	if (!matchingTokens.length) return;
	result.tokens.splice(result.tokens.length - matchingTokens.length);
};

/**
 * A ParserStep function that finds the first non-whitespace token and stores it as the logId.
 * A colon suffix is removed from the token value if there is one.
 *
 * @param result The result to parse and modify in place
 */
const detectLogId: ParseStep = (result: ParseResult): void => {
	const firstNonWhiteSpaceToken = result.tokens.find((t: Token) => t.type !== TOKEN_WHITESPACE);
	if (firstNonWhiteSpaceToken?.type !== TOKEN_STRING) return;
	result.logId = popColon(firstNonWhiteSpaceToken);
	result.tokens.splice(0, 1);
};

/**
 * A ParserStep function that looks for "log item keys" and removes the matching tokens.
 * A "log item key" is a string version of a series of tokens with a colon appended to it and is
 * logged right before the corresponding log item.
 *
 * @param result The result to parse and modify in place
 */
const removeIdentifierStrings: ParseStep = (result: ParseResult): void => {
	const tokens = result.tokens;
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.type !== TOKEN_STRING) continue;
		if (!tokens.find((t: Token, j: number) => j > i && t.type === TOKEN_IDENTIFIER && token.value === t.value + ':')) continue;
		tokens.splice(i, 1);
	}
};

/**
 * A Generator function that yields arrays of Tokens that are between Tokens that form the given
 * separator string. Separators inside code blocks are ignored.
 *
 * @param tokens The tokens to walk
 * @param separator The separator string at which to split the tokens
 */
function* getTokensUntilSeparator (tokens: Token[], separator: string): Generator<Token[]> {
	let accumulator: Token[] = []; // Current token block until separator found
	for (let i = 0; i < tokens.length; i++) {
		// If separator at current index, yield accumulated tokens and skip over it
		const separatorTokens: Token[] = getMatchingTokens(tokens, separator, i);
		if (separatorTokens.length) {
			yield accumulator;
			accumulator = [];
			i += separatorTokens.length - 1;
			continue;
		}
		// No separator here. If there's a codeblock at current index, add it to the accumulator and skip ahead
		const codeBlock: Token[] = getCodeBlockAt(tokens, i);
		if (isCompleteCodeBlock(codeBlock)) {
			Array.prototype.push.apply(accumulator, codeBlock);
			i += codeBlock.length - 1;
			continue;
		}
		// No separator or codeblock, just add token to accumulator and continue as normal
		accumulator.push(tokens[i]);
	}
	return accumulator;
}

/**
 * A ParserStep function splits the tokens at separator points according to the identified LogFormat's parameterSeparator
 * and stores the tokens logItems.
 *
 * @param result The result to parse and modify in place
 */
const collectLogItems: ParseStep = (result: ParseResult): void => {
    result.logItems = [];
    const iterator: Generator<Token[]> = getTokensUntilSeparator(result.tokens, result.logFormat?.parameterSeparator || '');
    let logItem: IteratorResult<Token[]>;
    do {
        logItem = iterator.next();
        if (logItem.value && logItem.value.length) result.logItems.push(logItem.value);
    } while (!logItem.done);
};

/**
 * A function  that returns a ParseStep funcion that remove tokens
 * in each log item of a given type that are not within code blocks.
 * NB! This ParseStep function operates on logItems instead of the tokens array!
 *
 * @param result The result to parse and modify in place
 */
const getRemoveTokensNotInCodeBlocksFn: ParseStepFactory = (type: TokenType): ParseStep => {
	return (result: ParseResult): void => {
        if (!result.logItems) return;
        for (let i = 0; i < result.logItems.length; i++) {
            const logItem = result.logItems[i];
            for (let j = 0; j < logItem.length; j++) {
                const codeBlock: Token[] = getCodeBlockAt(logItem, j);
                if (isCompleteCodeBlock(codeBlock)) {
                    j += codeBlock.length;
                } else if (logItem[j].type === type) {
                    logItem.splice(j, 1);
                    j--;
                }
            }
        }
	};
};

/**
 * A ParseStep function that searches for prefixes and suffixes defined in the LogFormat
 * that surround log items and removes them. The prefixes and suffixes are removed only
 * if both are found or if the other one is not specified in the LogFormat.
 *
 * @param result The result to parse and modify in place
 */
const removeIdentifierPrefixesAndSuffixes: ParseStep = (result: ParseResult): void => {
	if (!result.logItems) return;
	if (!result.logFormat?.identifierPrefix && !result.logFormat?.identifierSuffix) return;
	const prefix = result.logFormat?.identifierPrefix;
	const suffix = result.logFormat?.identifierSuffix;
	for (let i = 0; i < result.logItems.length; i++) {
		const logItem: Token[] = result.logItems[i];
		const prefixTokens: Token[] = prefix ? getMatchingTokens(logItem, prefix) : [];
		const suffixTokens: Token[] = suffix ? getMatchingTokens(logItem, suffix, logItem.length - 1, -1) : [];
		if (prefixTokens.length && (suffixTokens.length || !suffix)) logItem.splice(0, prefixTokens.length);
		if (suffixTokens.length && (prefixTokens.length || !prefix)) logItem.splice(logItem.length - suffixTokens.length);
	}
}

/**
 * A ParseStep function that removes log items that are left empty after previous processing.
 *
 * @param result The result to parse and modify in place
 */
const removeEmptyLogItems: ParseStep = (result: ParseResult): void => {
    result.logItems = result.logItems?.filter((logItem: Token[]) => logItem.length > 0);
}


/**
* Create a LogRotator function according to the LoggerConfig.
*
* @param config The logger config to use
* @returns The LogRotator function for the config
*/
export function createLogRotator(config: LoggerConfig): LogRotator {
    const parseSequence: ParseSequence = [
        getDetectLogFormatFn(config), // collect tokens until we get logPrefix, store & remove
        removeLogSuffix, // collect tokens from end until we get logSuffix, remove
        detectLogId, // collect first string, store
        removeIdentifierStrings, // remove strings that match next identifier + ':'
        collectLogItems, // Walk & collect anything between parameterSeparators & not in code blocks
        getRemoveTokensNotInCodeBlocksFn(TOKEN_PUNCTUATION), // Remove punctuation that's not in any code blocks
        getRemoveTokensNotInCodeBlocksFn(TOKEN_OPERATOR), // Remove operators not in any code blocks
        removeIdentifierPrefixesAndSuffixes,
        removeEmptyLogItems,
	
    ];

	const rotatorFn:LogRotator = (tokens: Token[]): string | null => {
        const result: ParseResult = { tokens: tokens, logItems: [] };
		try {
			parseSequence.forEach((fn: ParseStep) => fn(result));
		} catch (e) {
			if (e instanceof ParseError) return null;
			else throw e;
		}
		if(!result.logFormat) throw new ParseError("LogMagic: Failed to parse log statement: no matching log format found.");
		const currentFormatIndex = config.indexOf(result.logFormat);
		result.logFormat = config[(currentFormatIndex + 1) % config.length];
		return log(result);
	}

	return rotatorFn;
}