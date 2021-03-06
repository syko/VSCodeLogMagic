import { ParseResult } from './parser';
import { Token, TOKEN_IDENTIFIER, TOKEN_KEYWORD } from './tokenizer';
import {
  quoteString, serializeToken, serializeTokens, shortenIdentifier,
} from './util';

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
  insertSpaces: boolean;
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
  if (typeof format.logPrefix !== 'string') return 'logPrefix not found or is not a string';
  if (typeof format.parameterSeparator !== 'string') return 'parameterSeparator not found or is not a string';
  if (typeof format.identifierPrefix !== 'string') return 'identifierPrefix not found or is not a string';
  if (typeof format.identifierSuffix !== 'string') return 'identifierSuffix not found or is not a string';
  if (typeof format.logSuffix !== 'string') return 'logSuffix not found or is not a string';
  if (typeof format.quoteCharacter !== 'string') return 'quoteCharacter not found or is not a string';
  if (typeof format.insertSpaces !== 'boolean') return 'insertSpaces not found or is not a boolean';
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
 * Take a serialized log item and return a log item key to be logged right before it.
 * It prepends and appends spaces for extra padding as necessary according to the LogFormat
 * and whether this is the first log item logged or not.
 *
 * @param serializedItemValue The log item's serialised value as a string
 * @param isFirst A boolean indicating whether this is the first item logged
 * @param format The current LogFormat
 * @returns A serialized log item key string
 */
function createLogItemKey(serializedItemValue: string, isFirst: boolean, format: LogFormat) {
  const spacePrefix = format.insertSpaces && !isFirst ? ' ' : '';
  const spaceSuffix = format.insertSpaces ? ' ' : '';
  return quoteString(spacePrefix + shortenIdentifier(serializedItemValue) + ':' + spaceSuffix, format.quoteCharacter);
}

/**
 * A function for building the list of tokens for logging based on the given LoggerConfig.
 * Returns a string such as '"someVar:", someVar, "otherVar:", otherVar' or '"someVar:" + someVar.toString() + "otherVar:" + otherVar.toString()'
 * depending on the LoggerConfig. It does not produce a '"someVar:"' string part for an identifier for items that are only literals
 * (no point printing "\"foo\":" + "foo").
 *
 * @param parseResult The parse result to get tokens from
 * @param format the logger config to use for log syntax
 * @returns a string listing the parsed identifiers for logging according to the logger syntax
 */
function listLogItems(parseResult: ParseResult, format: LogFormat, usingLogId: boolean) {
  return parseResult.logItems.map((logItem: Token[], i: number) => {
    const serializedItemValue = serializeTokens(logItem, format.quoteCharacter);
    const itemIsOnlyLiterals = !logItem.find((t: Token) => t.type === TOKEN_IDENTIFIER || t.type === TOKEN_KEYWORD);
    return (!itemIsOnlyLiterals ? createLogItemKey(serializedItemValue, !usingLogId && i === 0, format) + format.parameterSeparator : '')
        + format.identifierPrefix
        + serializedItemValue
        + format.identifierSuffix;
  }).join(format.parameterSeparator);
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
  if (!format) format = parseResult.logFormat;
  if (!format) throw new Error('LogMagic: log needs to be passed a LogFormat or have one on the ParseResult object');
  const { logId, logItems } = parseResult;
  const params = [];

  const logIdMatchesItemKey = logId && logItems.length && serializeToken(logId, format.quoteCharacter) === serializeTokens(logItems[0], format.quoteCharacter);
  const useLogId = !!logId && !logIdMatchesItemKey;
  if (useLogId) params.push(quoteString('' + logId.value, format.quoteCharacter));

  if (logItems.length) params.push(listLogItems(parseResult, format, useLogId));

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
