import {
  ParseSequence, common, ParseStep, ParseResult,
} from '../parser';
import {
  Token, TokenizerConfig, TOKEN_IDENTIFIER, TOKEN_KEYWORD, TOKEN_NUMBER, TOKEN_OPERATOR, TOKEN_PUNCTUATION, TOKEN_STRING,
} from '../tokenizer';
import {
  findTokenIndex, getCodeBlockAt, isCompleteCodeBlock, PARENS_EXT, serializeToken,
} from '../util';
import {
  LOG_ID_KEYWORDS as JS_LOG_ID_KEYWORDS,
  MULTIWORD_KEYWORDS as JS_MULTIWORD_KEYWORDS,
  IDENTIFIER_CHAIN_CHARS as JS_IDENTIFIER_CHAIN_CHARS,
  NUMBER_REGEX as JS_NUMBER_REGEX,
  HEX_NUMBER_REGEX as JS_HEX_NUMBER_REGEX,
  loggerConfig,
  tokenizerConfig as jsTokenizerConfig,
} from './javascript';

const LOG_ID_KEYWORDS = [...JS_LOG_ID_KEYWORDS, 'enum', 'type', 'symbol'];
const MULTIWORD_KEYWORDS = JS_MULTIWORD_KEYWORDS;
const IDENTIFIER_CHAIN_CHARS = JS_IDENTIFIER_CHAIN_CHARS;
const NUMBER_REGEX = JS_NUMBER_REGEX;
const HEX_NUMBER_REGEX = JS_HEX_NUMBER_REGEX;

const tokenizerConfig: TokenizerConfig = {
  PUNCTUATION: jsTokenizerConfig.PUNCTUATION,
  IDENTIFIER_START: jsTokenizerConfig.IDENTIFIER_START,
  IDENTIFIER: jsTokenizerConfig.IDENTIFIER,
  OPERATOR: jsTokenizerConfig.OPERATOR,
  STRING_DELIM: jsTokenizerConfig.STRING_DELIM,
  SINGLE_LINE_COMMENT: jsTokenizerConfig.SINGLE_LINE_COMMENT,
  MULTI_LINE_COMMENT_START: jsTokenizerConfig.MULTI_LINE_COMMENT_START,
  MULTI_LINE_COMMENT_END: jsTokenizerConfig.MULTI_LINE_COMMENT_END,
  KEYWORD: [
    ...jsTokenizerConfig.KEYWORD,
    'enum', 'any', 'constructor', 'declare', 'get', 'module', 'require', 'number', 'readonly', 'set', 'string', 'symbol', 'type',
    'ReadonlyArray', 'keyof',
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
        default:
          throw new Error('Unexpected char from findNextDelimeter!');
      }
    }
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

/**
 * A function for removing Generic notation ('<...>').
 * If it finds `&&` or `||` inside the `<...>` block it assumes it is a conditional instead and
 * leaves it alone.
 *
 * @param result
 */
const removeGenerics: ParseStep = (result: ParseResult) => {
  const LOGICAL_OPERATORS = ['&&', '||'];
  // Remove everything wrapped in <> unless it contains logical operators
  for (let i = 0; i < result.tokens.length; i++) {
    const token: Token = result.tokens[i];
    if (token.type !== TOKEN_OPERATOR || token.value !== '<') continue;
    // Found '<', look for '>'
    const block = getCodeBlockAt(result.tokens, i, 1, PARENS_EXT);
    // If there is no end to the block it must be a comparison
    if (!isCompleteCodeBlock(block)) continue;
    // If the block contains logical operators, leave it alone
    if (block.find((t: Token) => t.type === TOKEN_OPERATOR && LOGICAL_OPERATORS.includes('' + t.value))) continue;
    // Remove block
    result.tokens.splice(i, block.length);
  }
};

const parseSequence: ParseSequence = [
  common.removeWhitespace,
  common.removeComments,
  common.combineBracketNotation,
  common.getCombineConsecutiveTokensOfTypeFn([TOKEN_IDENTIFIER, TOKEN_KEYWORD], TOKEN_IDENTIFIER, IDENTIFIER_CHAIN_CHARS),
  common.getCombineMatchingTokens(TOKEN_NUMBER, HEX_NUMBER_REGEX),
  common.getCombineMatchingTokens(TOKEN_NUMBER, NUMBER_REGEX),
  common.removeSplats,
  common.removeLambdas,
  common.getCombineConsecutiveTokensOfValueFn(TOKEN_KEYWORD, MULTIWORD_KEYWORDS, ' '),
  removeGenerics,
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

export { tokenizerConfig, parseSequence, loggerConfig };
