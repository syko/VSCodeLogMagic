import { ParseResult } from './parser';
import {
  Token, TokenType, TOKEN_OPERATOR, TOKEN_PUNCTUATION, TOKEN_STRING,
} from './tokenizer';

export const PARENS: string = '{[()]}';
export const PARENS_EXT: string = '{[(<>)]}';
export const openingP: string = '{[(';
export const closingP: string = '}])';

function isPuncOrOp(t: Token): boolean {
  return t.type === TOKEN_PUNCTUATION || t.type === TOKEN_OPERATOR;
}

function isSameParen(t: Token, initialParen: string): boolean {
  return isPuncOrOp(t) && t.value === initialParen;
}

function isOppositeParen(t: Token, initialParen: string): boolean {
  return isPuncOrOp(t) && t.value === PARENS_EXT[PARENS_EXT.length - 1 - PARENS_EXT.indexOf(initialParen)];
}

/**
 * Wraps the given string in quotation marks and also escapes the same quotation marks in the string.
 *
 * @param str The string to wrap in quotation marks
 * @returns The quoted string
 */
export function quoteString(str: string, quoteChar: string = '"'): string {
  const regex = new RegExp(quoteChar, 'g');
  return quoteChar + str.replace(regex, `\\${quoteChar}`) + quoteChar;
}

/**
 * Serializes the token for output. Wraps string tokens in quotation marks.
 *
 * @param token The token to serialize
 * @returns Serialized token value
 */
export function serializeToken(token: Token, quoteChar: string = '"'): string {
  return token.type === TOKEN_STRING ? quoteString('' + token.value, quoteChar) : '' + token.value;
}

/**
 * Return a concatenated token value of the given array of tokens. Quotes string values as necessary.
 *
 * @param tokens The tokens whose values to combine
 * @returns A string of concatenated token values
 */
export function serializeTokens(tokens: Token[], quoteChar: string | undefined = undefined): string {
  return tokens.reduce((acc: string, t: Token) => acc + serializeToken(t, quoteChar), '');
}

/**
 * A function that returns true if the given string is opening a new code block
 * (by testing to see if there is an opening paren of some sort that is not matched
 * by a closing paren or if the line ends with a colon).
 *
 * @param str The string to test
 * @returns true if the string contains the opening of a code block
 */
export function isOpeningCodeBlock(str: string): boolean {
  if (str[str.length - 1] === ':') return true;

  for (let i = 0; i < openingP.length; i++) {
    let depth = 0;
    for (let j = 0; j < str.length; j++) {
      if (str[j] === openingP[i]) depth++;
      else if (str[j] === closingP[i]) depth = Math.max(0, depth - 1);
    }
    if (depth > 0) return true;
  }
  return false;
}

/**
 * A function that returns true if the given string is closing a code block
 * (by testing to see if there is a closing paren of some sort that is not matched
 * by an opening paren).
 *
 * @param str The string to test
 * @returns true if the string contains the closing of a code block
 */
export function isClosingCodeBlock(str: string): boolean {
  for (let i = 0; i < closingP.length; i++) {
    let depth = 0;
    for (let j = 0; j < str.length; j++) {
      if (str[j] === openingP[i]) depth++;
      else if (str[j] === closingP[i]) depth--;
      if (depth < 0) return true;
    }
  }
  return false;
}

export function findTokenIndex(tokens: Token[], type: TokenType, value: string, fromIndex: number = 0): number {
  return tokens.findIndex((t: Token, i: number) => i >= fromIndex && t.type === type && t.value === value);
}

/**
 * Return a code block (a section of code wrapped in (), [], {} or <>) start starts or ends at startIndex.
 * If there is no opening code block at position startIndex, an empty array is returned.
 * If the code block does not close, all tokens starting from startIndex are returned.
 * Nested code blocks are ignored.
 *
 * @param tokens Array of tokens in which the code block is searched for
 * @param startIndex The index at which the code block starts or ends (based on direction)
 * @param direction The direction in which to look for the code block starting from startIndex. -1 or 1.
 * @returns Array of tokens that form the code block, including the wrapping characters.
 */
export function getCodeBlockAt(tokens: Token[], startIndex: number, direction: -1 | 1 = 1, parens = PARENS): Token[] {
  const initialParen: string = '' + tokens[startIndex].value;
  const includedTokens: Token[] = [tokens[startIndex]];
  let depth = 0;

  if (!isPuncOrOp(tokens[startIndex])) return [];
  if (!parens.includes(initialParen)) return [];
  if (direction === 1 && parens.indexOf(initialParen) >= parens.length / 2) return [];
  if (direction === -1 && parens.indexOf(initialParen) < parens.length / 2) return [];

  for (let i = startIndex + direction; i > 0 && i < tokens.length; i += direction) {
    includedTokens.push(tokens[i]);
    if (isSameParen(tokens[i], initialParen)) depth++;
    else if (isOppositeParen(tokens[i], initialParen)) depth--;
    if (depth === -1) break;
  }

  return includedTokens;
}

export function isCompleteCodeBlock(tokens: Token[]): boolean {
  return tokens.length > 0 && isPuncOrOp(tokens[0]) && isOppositeParen(tokens[tokens.length - 1], '' + tokens[0].value);
}

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
export function getExpressionAt(tokens: Token[], startIndex: number, direction: -1 | 1 = 1): Token[] {
  const P: string = '{[()]}';
  const BREAK_CHARS: string = ',;';
  let includedTokens: Token[] = [tokens[startIndex]];

  const isExpressionBreak = (t: Token): boolean => {
    return t.type === TOKEN_PUNCTUATION && BREAK_CHARS.includes('' + t.value);
  };

  const isExpressionBreakByParen = (t: Token): boolean => {
    return t.type === TOKEN_PUNCTUATION && (
      (direction === 1 && closingP.includes('' + t.value))
      || (direction === -1 && openingP.includes('' + t.value))
    );
  };

  const isParen = (t: Token): boolean => {
    return t.type === TOKEN_PUNCTUATION && P.includes('' + t.value);
  };

  if (isExpressionBreak(tokens[startIndex])) {
    throw new Error('getExpressionAt: token at startIndex is not part of an expression');
  }

  for (let i = startIndex + direction; i >= 0 && i < tokens.length; i += direction) {
    if (isExpressionBreak(tokens[i])) break;
    if (isExpressionBreakByParen(tokens[i])) break;
    if (isParen(tokens[i])) {
      // Include whole code block
      const codeBlock = getCodeBlockAt(tokens, i, direction);
      includedTokens = [...includedTokens, ...codeBlock];
      i += (codeBlock.length - 1) * direction;
    } else includedTokens.push(tokens[i]);
  }

  return includedTokens;
}

/**
 * Walk the tokens at a given index in a given direction and try to match their combined values against the given string.
 * This is like a startsWith function for tokens that supports matching at any index and in both directions.
 *
 * @param tokens The tokens to walk
 * @param str The string to match the tokens against
 * @param index (optional) From what index to start matching tokens. Default: 0
 * @param direction (optional) The direction in which to walk the tokens. Default: 1 (left to right)
 * @param quoteCharacter (optional) The quoteCharacter to use if none is specified on string tokens
 * @returns An array of tokens that match the given string or an empty array if no match
 */
export function getMatchingTokens(tokens: Token[], str: string, index: number = 0, direction: -1 | 1 = 1, quoteCharacter: string = '"'): Token[] {
  let serializedStr: string = '';
  for (let i = index; i >= 0 && i < tokens.length; i += direction) {
    serializedStr = direction === 1 ? serializedStr + serializeToken(tokens[i], quoteCharacter) : serializeToken(tokens[i], quoteCharacter) + serializedStr;
    if (serializedStr === str) return tokens.slice(Math.min(index, i), Math.max(i + 1, index + 1));
    if (direction === 1 && !str.startsWith(serializedStr) || direction === -1 && !str.endsWith(serializedStr)) return [];
  }
  return [];
}

export function getMatchingTokensRe(tokens: Token[], regex: RegExp, index: number = 0, direction: -1 | 1 = 1, quoteCharacter: string = '"'): Token[] {
  if (regex.flags.includes('g')) {
    throw new Error('LogMagic: getMatchingTokensRe only supports non-global regular expressions.');
  }

  const tokensToSerialize = tokens.slice(index);
  if (direction === -1) tokensToSerialize.reverse();
  const serializedStr: string = serializeTokens(tokensToSerialize, quoteCharacter);

  const match = serializedStr.match(regex);
  if (!match) return [];

  if (match.index !== 0) {
    throw new Error("LogMagic: getMatchingTokensRe: Match was found at position >0. This will not return the correct tokens. Please pass in a RegExp that starts with '^'.");
  }

  return getMatchingTokens(tokens, match[0], index, direction, quoteCharacter);
}

/**
 * Return a shortened version of the given identifier if it is longer than a certain number of characters.
 *
 * @param str The identifier as a string
 * @returns The possibly shortened identifier
 */
export function shortenIdentifier(str: string): string {
  return str.length < 20 ? str : str.substr(0, 8) + '..' + str.substr(str.length - 8);
}

/**
  * Ensure a ParseResult has a logId set. If not, generate one based on the current line number.
  * 2 is added to the line number because line numbers are 0-based and the log statement is added to the next line.
  *
  * @param parseResult The ParserResult to midfy in place
  * @returns the same ParseResult
  */
export function ensureLogId(parseResult: ParseResult, lineNr: number, direction: 1 | -1): ParseResult {
  if (!parseResult.logId) parseResult.logId = { type: TOKEN_STRING, value: 'L' + (lineNr + 1 + Math.max(0, direction)) };
  return parseResult;
}
