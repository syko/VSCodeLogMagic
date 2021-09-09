import {AsyncLocalStorage} from 'async_hooks';
import {resourceLimits} from 'worker_threads';
import {ParseResult} from './parser';
import {Token} from './tokenizer';
import {quoteString} from './util';

/**
 * The output configuration that can be specified for each language.
 *
 * logPrefixes: An array of logging function calls such as ['console.log(', 'console.warn', ...]
 * parameterSeparator: What separates logged items such as ', ' or ' + '
 * identifierPrefix: Option to prefix identifiers with something static like wrap it in a function (together with identifierSuffix)
 * identifierSuffix: Option to suffix identifiers with something static like '.toString()'
 * logSuffixes: An array of logging function call ends. Usually just something like [');']. Does not have to match the length of logPrefixes.
 * quoteCharacter: Which quote character to use when turning identifiers into strings.
 */
export type LoggerConfig = {
	logPrefixes: string[];
	parameterSeparator: string,
	identifierPrefix: string;
	identifierSuffix: string;
	logSuffixes: string[];
	quoteCharacter: string;
};

/**
 * A Logger is a function that takes a ParseResult object and returns a line of code for logging it.
 */
export type Logger = (parseResult: ParseResult) => string;

/**
 * A LogRotator is a function that takes an existing log statement, rotates the logPrefixes and logSuffixes and returns
 * a new log statement.
 *
 * For example, given the LoggerConfig of {logPrefixes: ['console.log(', 'console.warn('], logSuffixes: [');']} passing
 * the LogRotator a string 'console.log(something);' will return 'console.warn(something);'.
 *
 * Both logPrefixes and logSuffixes are rotated but if there are more prefixes than suffixes then the last suffix in the array
 * is used for prefixes that don't have a corresponding suffix in the array (see above example). 
 *
 * If the statement can't be rotated, null is returned.
 */
export type LogRotator = (logStatement: string) => string | null;

/**
 * A function for building the list of tokens for logging based on the given LoggerConfig.
 * Returns a string such as '"someVar:", someVar, "otherVar:", otherVar' or '"someVar:" + someVar.toString() + "otherVar:" + otherVar.toString()'
 * depending on the LoggerConfig. It does not produce a '"someVar:"' string part for an identifier if it's identical to the logId as that's
 * already printed as the first item.
 *
 * @param parseResult The parse result to get tokens from
 * @param config the logger config to use for log syntax
 * @returns a string listing the parsed identifiers for logging according to the logger syntax
 */
function listTokens(parseResult: ParseResult, config: LoggerConfig) {
	return parseResult.tokens.map((t: Token) => {
		return (t.value === parseResult.logId ? '' : quoteString(t.value + ':', config.quoteCharacter) + config.parameterSeparator) + config.identifierPrefix + t.value + config.identifierSuffix
	}).join(config.parameterSeparator)
}

export function createLogger(config: LoggerConfig): Logger {
	return <Logger> (parseResult: ParseResult) => {
		return config.logPrefixes[0]
			+ quoteString(parseResult.logId + ':', config.quoteCharacter)
			+ config.parameterSeparator
			+ listTokens(parseResult, config)
			+ config.logSuffixes[0];
	}
}

/**
 * Create a LogRotator function according to the LoggerConfig.
 *
 * @param config The logger config to use
 * @returns The LogRotator function for the config
 */
export function createLogRotator(config: LoggerConfig): LogRotator {
	const rotatorFn:LogRotator = (logStatement: string): string | null => {
		const prefixes = config.logPrefixes;
		const suffixes = config.logSuffixes;
		const prefixIndex: number = prefixes.findIndex((p: string) => logStatement.includes(p));
		if (prefixIndex === -1) return null;
		let newStatement: string = logStatement.replace(prefixes[prefixIndex], prefixes[(prefixIndex + 1) % prefixes.length]);
		newStatement = newStatement.replace(suffixes[prefixIndex], suffixes[Math.min(suffixes.length - 1, (prefixIndex + 1) % prefixes.length)]);
		return newStatement;
	}
	return rotatorFn;
}