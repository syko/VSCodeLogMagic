import {ParseResult} from './parser';
import {Token, TOKEN_IDENTIFIER, TOKEN_KEYWORD} from './tokenizer';
import {appendColon, quoteString, serializeTokens} from './util';

/**
 * One log statement format configuration for a given language.
 *
 * logPrefix: A function calls including the opening parenthesis, if any, such as 'console.log('
 * parameterSeparator: What separates logged items such as ', ' or ' + '
 * identifierPrefix: Option to prefix identifiers with something static like wrap it in a function call (together with identifierSuffix)
 * identifierSuffix: Option to suffix identifiers with something static like '.toString()'
 * logSuffix: A function call end. Usually just something like [');'].
 * quoteCharacter: Which quote character to use when turning identifiers into strings.
 */
export type LogFormat = {
	logPrefix: string;
	parameterSeparator: string;
	identifierPrefix: string;
	identifierSuffix: string;
	logSuffix: string;
	quoteCharacter: string;
};

/**
 * A list of log formats that can be configured for each language. The first format is used for
 * creating new log statements. All log statements can then be rotated to the next format in the list.
 */
export type LoggerConfig = LogFormat[];

/**
 * A Logger is a function that takes a ParseResult object and returns a line of code for logging it.
 */
export type Logger = (parseResult: ParseResult) => string;

/**
 * Validate a LogFormat object. This is necessary since the user can override LogFormats via settings.
 * 
 * @param format The LogFormat to validate
 * @returns An error message or null if valid
 */
export function validateLogFormat(format: LogFormat): string | null {
	if(typeof format.logPrefix !== 'string') return 'logPrefix not found or is not a string';
	if(typeof format.parameterSeparator !== 'string') return 'parameterSeparator not found or is not a string';
	if(typeof format.identifierPrefix !== 'string') return 'identifierPrefix not found or is not a string';
	if(typeof format.identifierSuffix !== 'string') return 'identifierSuffix not found or is not a string';
	if(typeof format.logSuffix !== 'string') return 'logSuffix not found or is not a string';
	if(typeof format.quoteCharacter !== 'string') return 'quoteCharacter not found or is not a string';
	return null;
}

/**
 * Validate a LoggerConfig object. This is necessary since the user can override LoggerConfigs via settings.
 * 
 * @param config The LoggerConfig to validate
 * @returns An error message or null if valid
 */
export function validateLoggerConfig(config: LoggerConfig): string | null {
	for (let i = 0; i < config.length; i++) {
		const error = validateLogFormat(config[i]);
		if (error) return `Log Format nr ${i + 1}: ${error}`;
	}
	return null;
}

/**
 * A function for building the list of tokens for logging based on the given LoggerConfig.
 * Returns a string such as '"someVar:", someVar, "otherVar:", otherVar' or '"someVar:" + someVar.toString() + "otherVar:" + otherVar.toString()'
 * depending on the LoggerConfig. It does not produce a '"someVar:"' string part for an identifier if it's identical to the logId as that's
 * already printed as the first item and also not for items that are only literals (no point printing "\"foo\":" + "foo").
 *
 * @param parseResult The parse result to get tokens from
 * @param format the logger config to use for log syntax
 * @returns a string listing the parsed identifiers for logging according to the logger syntax
 */
function listLogItems(parseResult: ParseResult, format: LogFormat) {
	return parseResult.logItems.map((logItem: Token[]) => {
		const itemStr = serializeTokens(logItem); // TODO: SHORTEN KEY
		const itemMatchesLogId = itemStr + ':' === '' + parseResult.logId?.value;
		const itemIsOnlyLiterals = !logItem.find((t: Token) => t.type === TOKEN_IDENTIFIER || t.type === TOKEN_KEYWORD);
		const shouldLogItemKey = !itemMatchesLogId && !itemIsOnlyLiterals;
		return (shouldLogItemKey ? quoteString(itemStr + ':', format.quoteCharacter) + format.parameterSeparator : '')
				+ format.identifierPrefix
				+ itemStr
				+ format.identifierSuffix
	}).join(format.parameterSeparator)
}

/**
 * Take a final ParseResult object with logItems defined and return a log statement that matches
 * the LogFormat that is either passed in or, if not, taken from the ParseResult object.
 *
 * @param parseResult The parsed items to log
 * @param format (optional) The format to log the items in. If omitted, the one on the parseResult is used.
 * @returns A log statement
 */
export function log(parseResult: ParseResult, format?: LogFormat) {
	if(!format) format = parseResult.logFormat;
	if (!format) throw new Error("LogMagic: log needs to be passed a LogFormat or have one on the ParseResult object");
	if (parseResult.logId && parseResult.logItems.length) appendColon(parseResult.logId);
	const params = [];
	if (parseResult.logId) params.push(quoteString('' + parseResult.logId.value, format.quoteCharacter));
	if (parseResult.logItems.length) params.push(listLogItems(parseResult, format));
	return format.logPrefix
		+ params.join(format.parameterSeparator)
		+ format.logSuffix;
}

/**
 * Create a log function bound to a specific LogFormat.
 *
 * @param format The LogFormat to usee.
 * @returns A bound log function
 */
export function createLogger(format: LogFormat): Logger {
	return (parseResult: ParseResult) => log(parseResult, format);
}
