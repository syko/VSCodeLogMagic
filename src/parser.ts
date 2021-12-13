import { LogFormat } from './logger';
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
  TOKEN_WHITESPACE,
} from './tokenizer';
import {
  serializeTokens, getCodeBlockAt, getExpressionAt, isCompleteCodeBlock, getMatchingTokens, serializeToken, getMatchingTokensRe,
} from './util';

/**
 * A parse result is an objecting containing all the current parsed info at any point in the parse process.
 *
 * tokens: The current Token objects. The Tokenizer creates the initial array of tokens and parse steps
 *         normally remove tokens until there are only interesting ones left.
 * logItems: An array of arrays of Tokens. Each subarray is one "log item". When logging a random line of code
 *           each individual token left after parsing is its own "log item" (converted to a single-item array).
 *           The Log Rotator, however, tries to preserve multi-token log items and makes use of this.
 *           A "key:" is generated in front of each log item when generating the log line.
 * logId: A string token representing the "potential identifier" for the log statement. It is the first thing that is
 *        outputted in the log statement if it exists. It is omitted from output if it matches the first identifier
 *        because an item key would be outputted anyway so we don't duplicate it.
 * logFormat: When the ParseResult is given to a Logger function, it will use this LogFormat unless one is
              specified directly.
 */

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
   * Return a ParseStep function that chains tokens of a given type and combines them into one.
   * A list of allowed separators, prefix and suffixes can be provided which will also be combined.
   * Separators have to be single tokens and between 2 tokens of the correct type.
   *
   * eg. With this you can combine chained identifiers like somePackage.someNamespace.someVariable into a single identifier token.
   *
   * @param chainingCharacters An array of characters that can chain identifiers together (probably ['.'] in most cases)
   * @returns A ParseStep function
   */
  getCombineConsecutiveTokensOfTypeFn: (typesToChain: TokenType[], newType: TokenType, allowedSeparators: string[], allowedPrefixes: string[] = [], allowedSuffixes: string[] = []): ParseStep => {
    return (result: ParseResult): void => {
      const tokens = result.tokens;

      // n%2 fn in this array returns whether the given token is good for being the next link in the chain
      const isChainLink: {(t: Token): boolean}[] = [
        (t: Token) => typesToChain.includes(t.type),
        (t: Token) => allowedSeparators.includes(serializeToken(t)), // TODO: quoteCharacter
      ];

      for (let i = 0; i < tokens.length; i++) {
        // Find matching prefix if any

        let prefixTokens: Token[] = [];
        for (let j = 0; j < allowedPrefixes.length; j++) {
          const prefix = allowedPrefixes[j];
          prefixTokens = getMatchingTokens(tokens, prefix, i); // TODO: quoteCharacter
          if (prefixTokens.length) break;
        }

        // Chain tokens after the prefix

        const tokenChain: Token[] = [];

        for (let j = i + prefixTokens.length; j < tokens.length; j++) {
          if (isChainLink[tokenChain.length % 2](tokens[j])) tokenChain.push(tokens[j]);
          else break;
        }
        if (tokenChain.length && isChainLink[1](tokenChain[tokenChain.length - 1])) tokenChain.pop(); // Chain can't end with a separator

        // Find matching suffix if any

        let suffixTokens: Token[] = [];
        for (let j = 0; j < allowedSuffixes.length; j++) {
          const suffix = allowedSuffixes[j];
          suffixTokens = getMatchingTokens(tokens, suffix, i + prefixTokens.length + tokenChain.length); // TODO: quoteCharacter
          if (suffixTokens.length) break;
        }

        // If we found anything beyond a prefix and/or suffix, combine it all

        if (tokenChain.length < 2) continue;

        tokens[i].type = newType;
        tokens[i].value = serializeTokens(prefixTokens.concat(tokenChain).concat(suffixTokens));
        tokens.splice(i + 1, prefixTokens.length + tokenChain.length + suffixTokens.length - 1);
      }
    };
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
  getCombineConsecutiveTokensOfValueFn: (newType: TokenType, valuesToCombine: string[][], separator: string = ''): ParseStep => {
    return (result: ParseResult): void => {
      const tokens = result.tokens;
      for (let i = 0; i < tokens.length; i++) {
        // match will be an item from valuesToCombine matches the tokens at current position
        const match: string[] | undefined = valuesToCombine.find((toCombine: string[]) => toCombine.every((v, j) => {
          return !!tokens[i + j] && serializeToken(tokens[i + j]) === v; // TODO: quoteCharacter
        }));
        if (!match) continue;
        tokens[i].type = newType;
        tokens[i].value = match.join(separator);
        tokens.splice(i + 1, match.length - 1);
      }
    };
  },

  getCombineMatchingTokens: (newType: TokenType, regex: RegExp, separator: string = ''): ParseStep => {
    return (result: ParseResult): void => {
      const tokens = result.tokens;
      for (let i = 0; i < tokens.length; i++) {
        const match = getMatchingTokensRe(tokens, regex, i); // TODO: quoteCharacter
        if (!match.length) continue;
        tokens[i].type = newType;
        tokens[i].value = match.join(separator);
        tokens.splice(i + 1, match.length - 1);
      }
    };
  },

  /**
   * Combine bracket notation into a single identifier (eg. someNestedArray[12][34] becomes a single identifier token).
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

      for (let j = i + 1; j < tokens.length; j++) {
        // Detect if there's a '[' after an identifier and if so, get the whole [...] block
        if (tokens[j].type !== TOKEN_PUNCTUATION || tokens[j].value !== '[') break;
        const block: Token[] = getCodeBlockAt(tokens, j);

        // If code block does not end with ']', it's an incomplete block => ignore
        if (!isCompleteCodeBlock(block)) break;

        token.value += serializeTokens(block);

        // Remove the [...] part unless there's an identifier in there
        // and move j accordingly so we can look for another [...] block after this one
        if (!block.find((t: Token) => t.type === TOKEN_IDENTIFIER)) {
          tokens.splice(j, block.length);
          j--;
        } else {
          j += block.length - 1;
        }
      }
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
    let skippedLambdaIndex = 0; // If we skip lambdas, we search for next ones from this index

    const findNextLambdaOperatorIndex = (tokens: Token[], fromIndex: number) => {
      return tokens.findIndex((t: Token, i: number) => i >= fromIndex && t.type === TOKEN_OPERATOR && t.value === '=>');
    };

    for (let q = 0; q < 9999; q++) { // q is just infinite loop protection
      let startIndex: number; let
        endIndex: number;
      let t: Token;
      const operatorIndex: number = findNextLambdaOperatorIndex(tokens, skippedLambdaIndex + 1);
      if (operatorIndex === -1) break;

      // Set endIndex to point to the end of the lambda expression
      t = tokens[operatorIndex + 1];
      if (t?.type === TOKEN_PUNCTUATION && t?.value === '{') endIndex = operatorIndex + getCodeBlockAt(tokens, operatorIndex + 1).length;
      else if (t) endIndex = operatorIndex + getExpressionAt(tokens, operatorIndex + 1).length;
      else endIndex = operatorIndex;

      if (endIndex === operatorIndex || tokens[endIndex].type === TOKEN_PUNCTUATION && tokens[endIndex].value === '{') {
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
  removeFunctionCalls: (result: ParseResult): void => {
    const isParen = (t?: Token) => !!t && t.type === TOKEN_PUNCTUATION && t.value === '(';
    result.tokens = result.tokens.filter((t: Token, i: number) => t.type !== TOKEN_IDENTIFIER || !isParen(result.tokens[i + 1]));
  },

  /**
   * Remove 3 consecutive dots that are followed by an identifier.
   * `foo(a, b, ...rest)` becomes `foo(a, b, rest)` so that `rest` can be
   * logged as a separate identifier. It is necessary to do this before applying
   * `getRemoveIncompleteChainedIdentifiersFn`. If our chaining was smarter, this would
   * not be necessary.
   *
   * @param result The result to parse and modify in place.
   */
  removeSplats: (result: ParseResult): void => {
    const tokens = result.tokens;

    function isDot(t: Token) {
      return t.type === TOKEN_PUNCTUATION && t.value === '.';
    }

    for (let i = 0; i < tokens.length - 3; i++) {
      if (isDot(tokens[i]) && isDot(tokens[i + 1]) && isDot(tokens[i + 2]) && tokens[i + 3].type === TOKEN_IDENTIFIER) {
        tokens.splice(i, 3);
      }
    }
  },

  /**
   * Return a ParseStep function for cleaning up identifiers which were part of a chain that could not be
   * combined int a single identifier (via getCombineConsecutiveTokensOfTypeFn).
   *
   * Identifiers are not chained if the chain includes function calls for example.
   * Something like `foo(a, b).bar` will result in ['a', 'b', '.', 'bar'] tokens left over. This function will remove
   * the identifier 'bar' since it is preceded with a chaining character, thus the chaining failed.
   *
   * NOTE: This is a straight up hack but it works. The proper thing to do would probably be to chain complex
   * statements into a single "identifier" (eg. 'Foo.GetComponent<SomeType>(a, b).Foo' becomes a single token) while
   * keeping identifiers within the function calls as separate tokens as well to be able to log them (a and b), and
   * then identifying such "identifier chains" that include function calls and remove them after setting the log id.
   * This way we could use the whole chain as a log id but then discard it because we want to avoid producing function calls
   * in our log statemets since they might include side effects.
   * But that's a lot more effort so for now we identify that there's an unchained 'Foo' preceded by a '.' and we remove it.
   *
   * @param chainCharacters The characters that chain identifiers (most likely ['.'])
   * @returns The ParseStep function
   */
  getRemoveIncompleteChainedIdentifiersFn: (chainCharacters: string[]): ParseStep => {
    return (result: ParseResult): void => {
      const isChainLink = (t: Token) => chainCharacters.includes(serializeToken(t));
      result.tokens = result.tokens.filter((t: Token, i: number) => i === 0 || t.type !== TOKEN_IDENTIFIER || !isChainLink(result.tokens[i - 1]));
    };
  },

  /**
   * Find a variable that is assigned an incomplete lambda declaration and remove it.
   * This looks for a '=' that is not in a codeblock, then looks for an incomplete lambda definition
   * after it and if it finds something, removes everything that comes before the '='.
   *
   * @param result The result to parse and modify in place.
   */
  removeLambdaDeclarationAssignees: (result: ParseResult): void => {
    const tokens = result.tokens;

    const findNextLambdaOperatorIndex = (tokens: Token[], fromIndex: number) => {
      return tokens.findIndex((t: Token, i: number) => i >= fromIndex && t.type === TOKEN_OPERATOR && t.value === '=>');
    };

    const isOpeningBrace = (token: Token): boolean => {
      return token.type === TOKEN_PUNCTUATION && token.value === '{';
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Skip code blocks
      const codeBlock = getCodeBlockAt(tokens, i);
      if (isCompleteCodeBlock(codeBlock)) i += codeBlock.length - 1;
      if (token.type !== TOKEN_OPERATOR || token.value !== '=') continue;

      // '=' found at position i
      // Find an incomplete lambda
      for (let j = i + 1; j < tokens.length; j++) {
        const operatorIndex = findNextLambdaOperatorIndex(tokens, j);
        if (operatorIndex === -1) return;
        const operatorIsLast = operatorIndex === tokens.length - 1;
        const openingBraceFollows = !operatorIsLast && isOpeningBrace(tokens[operatorIndex + 1]);
        const completeCodeBlockFollows = openingBraceFollows && isCompleteCodeBlock(getCodeBlockAt(tokens, operatorIndex + 1));
        if (operatorIsLast || openingBraceFollows && !completeCodeBlockFollows) {
          tokens.splice(0, i);
          return;
        }
        if (!operatorIsLast) j = operatorIndex;
      }
    }
  },

  /**
   * Find a variable that is assigned function declaration and remove it.
   * This looks for a '=' that is not in a codeblock, then looks for a `function(...) {` declaration
   * after it and if it finds something, removes everything that comes before the '='.
   *
   * Does not remove the assignee if the function definition is complete (`a = function() { ... }`)
   *
   * @param result The result to parse and modify in place.
   */
  removeFunctionDeclarationAssignees: (result: ParseResult): void => {
    const tokens = result.tokens;

    const findNextFunctionKeywordIndex = (tokens: Token[], fromIndex: number) => {
      return tokens.findIndex((t: Token, i: number) => i >= fromIndex && t.type === TOKEN_KEYWORD && t.value === 'function');
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Skip code blocks
      const codeBlock = getCodeBlockAt(tokens, i);
      if (isCompleteCodeBlock(codeBlock)) i += codeBlock.length - 1;
      if (token.type !== TOKEN_OPERATOR || token.value !== '=') continue;

      // '=' found at position i
      // Find a function assignment
      for (let j = i + 1; j < tokens.length; j++) {
        const keywordIndex = findNextFunctionKeywordIndex(tokens, j);
        if (keywordIndex === -1 || keywordIndex >= tokens.length - 3) return;

        // Expect a parameter block following the keyword
        const parameterBlock = getCodeBlockAt(tokens, keywordIndex + 1);
        const openingBracePosition = keywordIndex + parameterBlock.length + 1;
        if (openingBracePosition >= tokens.length) return;

        if (tokens[openingBracePosition].type !== TOKEN_PUNCTUATION || tokens[openingBracePosition].value !== '{') return;
        if (!isCompleteCodeBlock(getCodeBlockAt(tokens, openingBracePosition))) {
          tokens.splice(0, i);
          return;
        }
      }
    }
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
   * Return a ParseStep function for determining the best potential log Id for the ParseResult.
   * It looks for the first interesting keyword, first identifier and first string in that order.
   * If it can't find anything, the logId is left as undefined.
   *
   * @param interestingKeywords An array of keywords to consider for the logId. All others are ignored.
   * @returns A ParseStep function for setting the logId property.
   */
  getSetDefaultIdFn: (interestingKeywords: string[]): ParseStep => {
    return (result: ParseResult): void => {
      const tokens = result.tokens;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type === TOKEN_KEYWORD && interestingKeywords.includes(serializeToken(t))
          || t.type === TOKEN_IDENTIFIER
          || t.type === TOKEN_STRING) {
          result.logId = { ...t };
          return;
        }
      }
    };
  },

  /**
   * A ParseStep function that removes duplicate tokens.
   *
   * @param result The result to parse and modify in place.
   */
  removeDuplicates: (result: ParseResult): void => {
    result.tokens = result.tokens.filter((t: Token, i: number) => !result.tokens.find((t2: Token, j: number) => t2.type === t.type && t2.value === t.value && j < i));
  },

  /**
   * Take all the tokens in the ParseResult and store each one individually as an item to log.
   * You want to do this as the last parse step.
   *
   * @param result The result to parse and modify in place.
   */
  storeTokensAsLogItems: (result: ParseResult): void => {
    result.logItems = result.tokens.map((t: Token) => [t]);
  },
};

/**
 * A function that creates a Parser using the given sequence and tokenizer configuration.
 * @param sequence The sequence which is used to parse the input string.
 * @returns A Parser function
 */
export function createParser(sequence: ParseSequence): Parser {
  const parse: Parser = (tokens: Token[]): ParseResult => {
    const result: ParseResult = { tokens, logItems: [] };
    sequence.forEach((fn: ParseStep) => fn(result));
    return result;
  };

  return parse;
}
