import { LoggerConfig } from '../logger';
import {
  ParseSequence, common, ParseStep, ParseResult,
} from '../parser';
import {
  Token, TokenizerConfig, TOKEN_IDENTIFIER, TOKEN_KEYWORD, TOKEN_NUMBER, TOKEN_OPERATOR, TOKEN_PUNCTUATION, TOKEN_STRING,
} from '../tokenizer';
import {
  closingP, findTokenIndex, getCodeBlockAt, serializeToken,
} from '../util';

const LOG_ID_KEYWORDS = ['if', 'else if', 'else', 'switch', 'case', 'return', 'for', 'while', 'do', 'yield', 'continue', 'break'];
const MULTIWORD_KEYWORDS = [['else', 'if']];
const IDENTIFIER_CHAIN_CHARS = ['.'];
const NUMBER_REGEX = /^-?(0b|0o)?[0-9]+(_[0-9]+)*(\.[0-9]+(_[0-9]+)*)?(e-?[0-9]+(_[0-9]+)*)?(n)?/i;
const HEX_NUMBER_REGEX = /^-?(0x)[0-9a-f]+(_[0-9a-f]+)*(n)?/i;

const tokenizerConfig: TokenizerConfig = {
  PUNCTUATION: ',.;\\[]{}@#()',
  IDENTIFIER_START: 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM$_',
  IDENTIFIER: 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM$_' + '_1234567890',
  OPERATOR: '-+/*%=<>!|&^?:~',
  STRING_DELIM: "\"'\`",
  SINGLE_LINE_COMMENT: '//',
  MULTI_LINE_COMMENT_START: '/*',
  MULTI_LINE_COMMENT_END: '*/',
  KEYWORD: [
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete',
    'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import',
    'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try',
    'typeof', 'var', 'void', 'while', 'with', 'yield', 'implements', 'interface', 'let',
    'package', 'private', 'protected', 'public', 'static', 'yield', 'abstract', 'boolean', 'byte',
    'char', 'double', 'final', 'float', 'goto', 'int', 'long', 'native', 'short',
    'synchronized', 'throws', 'transient', 'volatile', 'null', 'true', 'false', 'Infinity', 'of',
    'Number', 'String', 'Date', 'Error', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'Promise', 'await', 'async', 'Intl', 'from',
  ],
};

/**
 * A ParseStep function to prevent loggin object keys and add support for
 * destructuring. It simply removes all detected keys in object notations.
 *
 * @param result The ParseResult to parse and modify in place
 */
const removeObjectKeys: ParseStep = (result: ParseResult): void => {
  /**
     * Check the given token and return true if it denotes the start of a function/lambda
     * definition.
     * @param token the token to check
     * @returns true if the token is a `function` keyword or a lambda arrow `=>`
     */
  function isFunctionOrLambdaKeyword(token: Token): boolean {
    return token.type === TOKEN_KEYWORD && token.value === 'function'
            || token.type === TOKEN_OPERATOR && token.value === '=>';
  }

  /**
     * A function that searches the array of tokens for the next earliest 'interesting' token.
     * The interesting tokens are the delimeters inside the js object notation:
     * - a colon, indicating a key-value pair split point
     * - a comma, indicating a the split point of different key-value pairs
     * - an opening brace, indicating a new code block (object or function definition)
     *
     * @param tokens The tokens to search
     * @param startIndex The start index of the search
     * @returns an object of {char, pos} that denotes the next occurrence of interesting tokens
     */
  function findNextDelimeter(tokens: Token[], startIndex: number) {
    return [
      { char: ':', pos: findTokenIndex(tokens, TOKEN_OPERATOR, ':', startIndex) },
      { char: ',', pos: findTokenIndex(tokens, TOKEN_PUNCTUATION, ',', startIndex) },
      { char: '{', pos: findTokenIndex(tokens, TOKEN_PUNCTUATION, '{', startIndex) },
    ].filter((v) => v.pos !== -1).sort((a, b) => a.pos - b.pos)[0];
  }

  /**
     * The 'generic' processing function for removal of object keys.
     * It tries to find code blocks surrounded by curcly braces. If the code block found is
     * a function definition, it skips over it. If it is an object block it processes it
     * using the processObjBlock function below.
     *
     * @param tokens The tokens to process
     * @param startIndex The start index for processing
     */
  function process(tokens: Token[], startIndex: number): void {
    let i = startIndex;
    for (let q = 0; q < 999; q++) {
      i = findTokenIndex(tokens, TOKEN_PUNCTUATION, '{', i);
      if (i === -1) return;
      if (i === 0 || !isFunctionOrLambdaKeyword(tokens[i - 1])) {
        processObjBlock(tokens, i);
      }
      i += getCodeBlockAt(tokens, i).length;
    }
  }

  /**
     * The processing function for removing object keys inside the given object block
     * starting at startIndex.
     * Nested code blocks are processed recursively using either the process or
     * processObjBlock functions.
     *
     * @param tokens The tokens to process
     * @param startIndex The starting index of the obj code block
     */
  function processObjBlock(tokens: Token[], startIndex: number): void {
    let i = startIndex + 1;
    let endIndex = startIndex + getCodeBlockAt(tokens, startIndex).length;
    for (let q = 0; q < 999; q++) {
      if (i >= endIndex) return;
      // i is at the start position of a key, or value if no key
      const delim = findNextDelimeter(tokens, i);
      if (!delim || delim.pos >= endIndex) return;
      switch (delim.char) {
        case ':':
          // Next delim found is colon, everything until that is an object key => remove it and continue
          tokens.splice(i, delim.pos - i);
          endIndex -= delim.pos - i;
          i++;
          break;
        case ',':
          // Next delim found is a comma, skip to after it (next key or value)
          i = delim.pos + 1;
          break;
        case '{':
          // Next delim found is an opening brace => recurse and parse the inner scope
          if (i > 0 && isFunctionOrLambdaKeyword(tokens[i - 1])) process(tokens, i);
          else processObjBlock(tokens, i);
          i += getCodeBlockAt(tokens, i).length;
          break;
      }
    }
  }

  process(result.tokens, 0);
};

/**
 * A function for removing the identifier that has been set as the log id but seems to be an object key.
 * eg. in case of `someObjKey: function(p) {` we want someObjKey to be the log id but not actually log it.
 *
 * @param result The ParseResult to parse and modify in place
 */
const removeKeyIdentifier: ParseStep = (result: ParseResult): void => {
  const tokens = result.tokens;
  const keyPos = tokens.findIndex((t: Token) => t.type === TOKEN_IDENTIFIER || t.type === TOKEN_STRING);
  const colonPos = tokens.findIndex((t: Token) => t.type === TOKEN_OPERATOR && t.value === ':');
  if (keyPos === -1 || colonPos === -1 || colonPos < keyPos) return;
  if (result.logId?.value !== serializeToken(tokens[keyPos])) return;

  // Make sure not to mistake ternary for an object key notation
  const ternaryPos = tokens.findIndex((t: Token) => t.type === TOKEN_OPERATOR && t.value === '?');
  if (ternaryPos !== -1 && ternaryPos < colonPos) return;

  const onlyPuncBetween = tokens.every((t: Token, i: Number) => i <= keyPos || i >= colonPos || t.type === TOKEN_PUNCTUATION);

  if (!onlyPuncBetween) return;

  tokens.splice(keyPos, 1);
};

const parseSequence: ParseSequence = [
  common.removeWhitespace,
  common.removeComments,
  common.combineBracketNotation,
  common.getCombineConsecutiveTokensOfTypeFn([TOKEN_IDENTIFIER, TOKEN_KEYWORD], TOKEN_IDENTIFIER, IDENTIFIER_CHAIN_CHARS),
  common.getCombineMatchingTokens(TOKEN_NUMBER, HEX_NUMBER_REGEX),
  common.getCombineMatchingTokens(TOKEN_NUMBER, NUMBER_REGEX),
  common.removeLambdas,
  common.getCombineConsecutiveTokensOfValueFn(TOKEN_KEYWORD, MULTIWORD_KEYWORDS, ' '),
  removeObjectKeys,
  common.getSetDefaultIdFn(LOG_ID_KEYWORDS),
  removeKeyIdentifier,
  common.removeFunctionDeclarationAssignees,
  common.removeLambdaDeclarationAssignees,
  common.removeFunctionCalls,
  common.getRemoveIncompleteChainedIdentifiersFn(IDENTIFIER_CHAIN_CHARS),
  common.removeLiterals,
  common.removePunctuation,
  common.removeOperators,
  common.removeNonIdentifiers,
  common.removeDuplicates,
  common.storeTokensAsLogItems,
];

const loggerConfig: LoggerConfig = [
  {
    logPrefix: 'console.log(',
    parameterSeparator: ', ',
    identifierPrefix: '',
    identifierSuffix: '',
    logSuffix: ');',
    quoteCharacter: '\'',
    insertSpaces: false,
  },
  {
    logPrefix: 'console.info(',
    parameterSeparator: ', ',
    identifierPrefix: '',
    identifierSuffix: '',
    logSuffix: ');',
    quoteCharacter: '\'',
    insertSpaces: false,
  },
  {
    logPrefix: 'console.warn(',
    parameterSeparator: ', ',
    identifierPrefix: '',
    identifierSuffix: '',
    logSuffix: ');',
    quoteCharacter: '\'',
    insertSpaces: false,
  },
  {
    logPrefix: 'console.error(',
    parameterSeparator: ', ',
    identifierPrefix: '',
    identifierSuffix: '',
    logSuffix: ');',
    quoteCharacter: '\'',
    insertSpaces: false,
  },
];

export { tokenizerConfig, parseSequence, loggerConfig };
