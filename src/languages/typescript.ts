import {
  ParseSequence, common, ParseStep, ParseResult,
} from '../parser';
import {
  Token, TokenizerConfig, TOKEN_IDENTIFIER, TOKEN_KEYWORD, TOKEN_NUMBER, TOKEN_OPERATOR, TOKEN_PUNCTUATION, TOKEN_STRING,
} from '../tokenizer';
import {
  findTokenIndex, getCodeBlockAt, isCompleteCodeBlock, PARENS_EXT, serializeToken, shortenIdentifier,
} from '../util';
import {
  LOG_ID_KEYWORDS as JS_LOG_ID_KEYWORDS,
  MULTIWORD_KEYWORDS as JS_MULTIWORD_KEYWORDS,
  IDENTIFIER_CHAIN_CHARS as JS_IDENTIFIER_CHAIN_CHARS,
  NUMBER_REGEX as JS_NUMBER_REGEX,
  HEX_NUMBER_REGEX as JS_HEX_NUMBER_REGEX,
  loggerConfig,
  tokenizerConfig as jsTokenizerConfig,
  removeKeyIdentifier,
} from './javascript';

const LOG_ID_KEYWORDS = [...JS_LOG_ID_KEYWORDS, 'enum', 'type', 'symbol'];
const MULTIWORD_KEYWORDS = JS_MULTIWORD_KEYWORDS;
const IDENTIFIER_CHAIN_CHARS = [...JS_IDENTIFIER_CHAIN_CHARS, '?.'];
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
 * A ParseStep function to prevent logging object keys and add support for
 * destructuring. It simply removes all detected keys in object notation blocks.
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
 * A function for removing Generic notation ('<...>').
 * If it finds `&&` or `||` inside the `<...>` block it assumes it is a conditional instead and
 * leaves it alone.
 *
 * @param result The ParseResult to parse and modify in place
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

/**
 * A function for removing all function return types.
 * It looks for a `function` keyword or lambda notation and removes everything
 * between the list of parameters and the opening brace / lambda operator.
 *
 * @param result The ParseResult to parse and modify in place
 */
const removeReturnTypes: ParseStep = (result: ParseResult) => {
  const tokens = result.tokens;

  function isOpeningParen(token: Token) {
    return token.type === TOKEN_PUNCTUATION && token.value === '(';
  }
  function isClosingParen(token: Token) {
    return token.type === TOKEN_PUNCTUATION && token.value === ')';
  }
  function isOpeningBrace(token: Token) {
    return token.type === TOKEN_PUNCTUATION && token.value === '{';
  }
  function isFunctionKeyword(token: Token) {
    return token.type === TOKEN_KEYWORD && token.value === 'function';
  }
  function isLambdaOperator(token: Token) {
    return token.type === TOKEN_OPERATOR && token.value === '=>';
  }

  let kwPos: number = -1;
  for (let q = 0; q < 999; q++) {
    // Find `function` keyword
    // eslint-disable-next-line no-loop-func
    kwPos = tokens.findIndex((t: Token, i: number) => i > kwPos && isFunctionKeyword(t));
    if (kwPos === -1) break;
    // Find the end of its list of parameters
    // eslint-disable-next-line no-loop-func
    const parenPos = tokens.findIndex((t: Token, i: number) => i > kwPos && isOpeningParen(t));
    if (parenPos === -1) break;
    const block = getCodeBlockAt(tokens, parenPos);
    if (!isCompleteCodeBlock(block)) break;
    const removeFrom = parenPos + block.length + 1;
    // Check if there is a return type
    // Remove everything until the opening brace
    const bracePos = tokens.findIndex((t: Token, i: number) => i > removeFrom && isOpeningBrace(t));
    if (bracePos === -1) break;
    tokens.splice(removeFrom, bracePos - removeFrom);
  }

  let lambdaPos: number = -1;
  for (let q = 0; q < 999; q++) {
    // Find a lambda operator
    // eslint-disable-next-line no-loop-func
    lambdaPos = tokens.findIndex((t: Token, i: number) => i > lambdaPos && isLambdaOperator(t));
    if (lambdaPos === -1) break;
    // Find the end of its list of parameters
    let closingParenPos = -1;
    for (let i = lambdaPos - 1; i > 0; i--) {
      if (isClosingParen(tokens[i])) {
        closingParenPos = i;
        break;
      }
    }
    if (closingParenPos === -1) break;
    if (closingParenPos === lambdaPos - 1) break;
    tokens.splice(closingParenPos + 1, lambdaPos);
  }
};

/**
 * A function for removing all idenfitifer types.
 * It looks for colons outside of object notation blocks
 * that are preceded by an identifier (and optionally `?` for optional parameters)
 * and removes everything until it encounters a `,`, `=` or `)`
 * unless there is a ternary `?` somewhere earlier in the statement.
 *
 * @param result The ParseResult to parse and modify in place
 */
const removeTypes: ParseStep = (result: ParseResult) => {
  const tokens = result.tokens;

  function isIdentifier(token: Token) {
    return token.type === TOKEN_IDENTIFIER;
  }
  function isColon(token: Token) {
    return token.type === TOKEN_OPERATOR && (token.value === ':' || token.value === '?:');
  }
  function isComma(token: Token) {
    return token.type === TOKEN_PUNCTUATION && token.value === ',';
  }
  function isQuestionMark(token: Token) {
    return token.type === TOKEN_OPERATOR && token.value === '?';
  }
  function isEqualOp(token: Token) {
    return token.type === TOKEN_OPERATOR && token.value === '=';
  }
  function isClosingParen(token: Token) {
    return token.type === TOKEN_PUNCTUATION && token.value === ')';
  }
  function isOpeningBrace(token: Token) {
    return token.type === TOKEN_PUNCTUATION && token.value === '{';
  }

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    // Skip object notations
    if (isOpeningBrace(token)) {
      const block = getCodeBlockAt(tokens, i);
      if (!isCompleteCodeBlock(block)) return;
      i += block.length - 1;
      continue;
    }
    if (!isColon(token)) continue;
    // Found colon at i
    // Check that it's preceded by an identifier
    if (!isIdentifier(tokens[i - 1])) continue;
    // ternary `?` that comes earlier and is not immediately followed by a `)` or `,` (optional param notation)
    const ternaryPos = tokens.findIndex((t: Token, j: number) => {
      return j < i - 1 && isQuestionMark(t) && !isComma(tokens[j + 1]) && !isClosingParen(tokens[j + 1]);
    });
    if (ternaryPos !== -1) return;
    let removeUntil: number;
    for (removeUntil = i + 1; removeUntil < tokens.length; removeUntil++) {
      // Skip code blocks
      const block = getCodeBlockAt(tokens, removeUntil);
      if (isCompleteCodeBlock(block)) {
        removeUntil += block.length - 1;
        continue;
      }
      if (isComma(tokens[removeUntil]) || isClosingParen(tokens[removeUntil]) || isEqualOp(tokens[removeUntil])) break;
    }
    tokens.splice(i, removeUntil - i);
  }
};

/**
 * A function for removing type casts (`... as SomeType`).
 *
 * @param result The ParseResult to parse and modify in place
 */
const removeTypeCasts: ParseStep = (result: ParseResult) => {
  const tokens = result.tokens;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type !== TOKEN_KEYWORD || tokens[i].value !== 'as') continue;
    if (tokens[i + 1].type !== TOKEN_IDENTIFIER) continue;
    tokens.splice(i, 2);
    i--;
  }
};

const parseSequence: ParseSequence = [
  common.removeWhitespace,
  common.removeComments,
  common.combineBracketNotation,
  common.getCombineConsecutiveTokensOfValueFn(TOKEN_PUNCTUATION, [['?', '.']]),
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
  removeReturnTypes,
  removeTypes,
  removeTypeCasts,
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
