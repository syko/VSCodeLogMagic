import { createTokenizer, Tokenizer } from './tokenizer';
import { Parser, createParser } from './parser';
import {
  createLogger, LogFormat, Logger, LoggerConfig,
} from './logger';
import { createLogRotator, LogRotator } from './logRotator';

/**
 * A magical item allowing us to output a log statement with a single keypress.
 */
export type MagicItem = {
  tokenize: Tokenizer;
  parse: Parser;
  log: Logger;
  rotateLog: LogRotator;
  getCaretPosition: (logStatement: string) => number;
  isLogStatement: (logStatement: string) => boolean;
}

/**
 * A mapping between language ids and their corresponding magical items.
 */
export type MagicItems = {
  [index: string]: MagicItem;
}

let magicItems: MagicItems = {};

/**
 * A function for converting languageId to its corresponding
 * module name. This allows to override and reuse language modules.
 *
 * @param languageId The setting value
 * @returns The corresponding module name (file from ./languages)
 */
function languageIdToModuleName(languageId: string): string {
  if (!languageId) return languageId;
  return {
    javascriptreact: 'javascript',
  }[languageId] || languageId; // Pass through if no override found
}

/**
 * A function for determining where the caret should be positioned after logging the line.
 * Each language can implement and export their own getDefaultCaretPosition function but if none
 * is provided this default function is used instead.
 *
 * The default function puts the caret at the end of the log statement just before the log suffix.
 *
 * @param loggerConfig The loggerConfig that contains the possible log statement format for the line
 * @returns (logStatement: string): number - a function that returns an index where the caret should be positioned in the statement
 */
const createDefaultGetCaretPositionFn = (loggerConfig: LoggerConfig) => {
  return (logStatement: string): number => {
    for (let i = 0; i < loggerConfig.length; i++) {
      const logFormat: LogFormat = loggerConfig[i];
      if (logStatement.endsWith(logFormat.logSuffix)) return logStatement.length - logFormat.logSuffix.length;
    }
    return logStatement.length - 1;
  };
};

/**
 * A function for detecting whether a give line of code is a log statement according to the loggerConfig
 * without tokenizing the line of code.
 *
 * @param loggerConfig The loggerConfig that contains the possible log statement format for the line
 * @returns (logStatement: string): boolean
 */
const createIsLogStatementFn = (loggerConfig: LoggerConfig) => {
  return (logStatement: string): boolean => {
    logStatement = logStatement.trimLeft();
    for (let i = 0; i < loggerConfig.length; i++) {
      if (logStatement.startsWith(loggerConfig[i].logPrefix.trimLeft())) return true;
    }
    return false;
  };
};

/**
 * Imports the components, creates and caches the magic for a given language.
 * The MagicItems only include default log formats. User-defined configuration is not included.
 *
 * @param languageId The language id
 * @returns The MagicItem for the language
 */
export async function getMagicItem(languageId: string, fallbackId: string = 'javascript'): Promise<MagicItem> {
  const moduleName = languageIdToModuleName(languageId);
  if (!magicItems[moduleName]) {
    try {
      const {
        parseSequence, tokenizerConfig, loggerConfig, getCaretPosition,
      } = await import('./languages/' + moduleName);
      magicItems[moduleName] = <MagicItem>{
        tokenize: createTokenizer(tokenizerConfig),
        parse: createParser(parseSequence),
        log: createLogger(loggerConfig[0]),
        rotateLog: createLogRotator(loggerConfig),
        getCaretPosition: getCaretPosition || createDefaultGetCaretPositionFn(loggerConfig),
        isLogStatement: createIsLogStatementFn(loggerConfig),
      };
    } catch (e) {
      return getMagicItem(fallbackId); // Return default parser if no direct implementation for this language exists
    }
  }
  return magicItems[moduleName];
}

export function clearCache() {
  magicItems = {};
}
