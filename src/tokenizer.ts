export const TOKEN_NUMBER = 'number';
export const TOKEN_STRING = 'string';
export const TOKEN_IDENTIFIER = 'identifier';
export const TOKEN_KEYWORD = 'keyword';
export const TOKEN_PUNCTUATION = 'punctuation';
export const TOKEN_OPERATOR = 'operator'
export const TOKEN_COMMENT = 'comment'

export type TokenType = typeof TOKEN_NUMBER
    | typeof TOKEN_STRING
    | typeof TOKEN_IDENTIFIER
    | typeof TOKEN_KEYWORD
    | typeof TOKEN_PUNCTUATION
    | typeof TOKEN_OPERATOR
    | typeof TOKEN_COMMENT;

/**
 * A Token represents an individual piece of code, like a string, number, punctuation character, variable (identifier), etc...
 */
export type Token = {
    type: TokenType;
	value: string | number;
};

/**
 * The syntax configuration that can be specified for each language.
 */
export type TokenizerConf = {
	PUNCTUATION: string;
	IDENTIFIER_START: string;
    IDENTIFIER: string;
    IDENTIFIER_CHAIN: string;
    DIGIT: string;
    OPERATOR: string;
    STRING_DELIM: string;
    WHITESPACE: string;
    SINGLE_LINE_COMMENT: string;
    MULTI_LINE_COMMENT_START: string;
    MULTI_LINE_COMMENT_END: string;
    KEYWORD: string[];
};

/**
 * A Tokenizer is a function that takes a line of code as a string and returns an array of Token objets.
 */
export type Tokenizer = (input: string) => Token[];

/**
 * Create and return a tokenizer function according to the given syntax configuration.
 * 
 * @param conf The syntax configuration for this tokenizer
 * @returns The tokenizer function
 */
export function createTokenizer(conf: TokenizerConf): Tokenizer {

    let i = 0; // Internal caret that is moved forward

    // Conditionals

    function isWhitespace(char: string) {
        return conf.WHITESPACE.includes(char);
    }

    function isDigit(char: string) {
        return conf.DIGIT.includes(char)
    }

    function isPunctuation(char: string) {
        return conf.PUNCTUATION.includes(char)
    }

    function isSingleLineComment(input: string) {
        return input.startsWith(conf.SINGLE_LINE_COMMENT, i);
    }

    function isMultiLineComment(input: string) {
        return input.startsWith(conf.MULTI_LINE_COMMENT_START, i);
    }

    function isOperator(char: string) {
        return conf.OPERATOR.includes(char)
    }

    function isStringDelim(char: string) {
        return conf.STRING_DELIM.includes(char)
    }

    function isIdentifierStart(char: string) {
        return conf.IDENTIFIER_START.includes(char)
    }

    function isIdentifier(char: string) {
        return conf.IDENTIFIER.includes(char)
    }

    function isKeyword(str: string) {
        return conf.KEYWORD.includes(str)
    }

    // Read funcions

    /**
     * Read the input string, moving the internal caret forward until conditionFn returns false.
     *
     * @param input The input string to read
     * @param conditionFn (char: string) => boolean. Called for each character read. Return false to end reading.
     * @returns The string that was read until, and excluding, the character to which conditionFn returned false.
     */
    function readWhile(input: string, conditionFn: (char: string) => boolean) {
        let chars = []
        while (conditionFn(input[i])) chars.push(input[i++]);
        return chars.join('');
    }

    /**
     * Read the input string, moving the internal caret forward until endDelim is encountered.
     * Used for reading whole strings and comments.
     *
     * @param input The input string to read
     * @param endDelim Read until this string is encountered
     * @param canEscape If true, endDelim can be escaped by '\', meaning that it won't end the reading
     * @returns The string that was read until endDelim was encountered
     */
    function readUntil(input: string, endDelim: string, canEscape: boolean = true): string {
        let str = ''
        let escaped = false
        while(i < input.length) {
            if (escaped) {
                escaped = false; // Unset escaped and consume the character
            } else if (canEscape && input[i] === "\\") {
                escaped = true; // Set flag and skip over the escape character
                i++;
                continue;
            } else if (input.startsWith(endDelim, i)) {
                break; // End reading
            }
            str += input[i];
            i++;
        }
        return str;
    }

    /**
     * Read the input string and move the internal caret forward until something non-whitespace is encountered.
     * @param input The string to read
     */
    function skipWhitespace(input: string): void {
        readWhile(input, isWhitespace);
    }

    /**
     * Read a number (integer/decimal) at the current caret position in the input string and move the internal caret forward.
     * @param input The input string to read
     * @returns A number Token
     */
    function readNumber(input: string): Token {
        const str = readWhile(input, (char: string) => {
            let seenDot = false;
            return isDigit(char) || (!seenDot && char === '.' && (seenDot = true));
        })
        return { type: TOKEN_NUMBER, value: parseFloat(str) }
    }

    /**
     * Read an operator at the current caret position in the input string and move the internal caret forward.
     * @param input The input string to read
     * @returns An operator Token
     */
    function readOperator(input: string): Token {
        return { type: TOKEN_OPERATOR, value: readWhile(input, isOperator) }
    }

    /**
     * Read a punctuation character at the current caret position in the input string and move the internal caret forward.
     * @param input The input string to read
     * @returns A punctuation Token
     */
    function readPunctuation(input: string): Token {
        return { type: TOKEN_PUNCTUATION, value: input[i++] }
    }

    /**
     * Read an identifier / keyword at the current caret position in the input string and move the internal caret forward.
     * @param input The input string to read
     * @returns A identifier or keyword Token
     */
    function readIdentifier(input: string): Token {
        const str = readWhile(input, isIdentifier);
        return { type: isKeyword(str) ? TOKEN_KEYWORD: TOKEN_IDENTIFIER, value: str }
    }

    /**
     * Read a quoted string at the current caret position in the input string and move the internal caret forward.
     * @param input The input string to read
     * @returns A string Token
     */
    function readString(input: string, quoteChar: string): Token {
        i += quoteChar.length;
        const str = readUntil(input, quoteChar);
        i += quoteChar.length;
        return { type: TOKEN_STRING, value: str }
    }

    /**
     * Read a single line comment at the current caret position in the input string and move the internal caret forward.
     * This advances the caret to the end of the input string.
     * 
     * @param input The input string to read
     * @returns A comment Token
     */
    function readSingleLineComment(input: string): Token {
        const str = input.substr(i + conf.SINGLE_LINE_COMMENT.length);
        i = input.length
        return { type: TOKEN_COMMENT, value: str }
    }

    /**
     * Read multiline comment at the current caret position in the input string and move the internal caret forward.
     * @param input The input string to read
     * @returns A comment Token
     */
    function readMultiLineComment(input: string): Token {
        i += conf.MULTI_LINE_COMMENT_START.length;
        const str = readUntil(input, conf.MULTI_LINE_COMMENT_END, false);
        i += conf.MULTI_LINE_COMMENT_END.length;
        return { type: TOKEN_COMMENT, value: str }
    }

    // Main

    /**
     * The tokenize function takes a line of code as a string and returns an array of Token objets that
     * represent individual code atoms.
     *
     * @param input The input string to tokenize
     * @returns an array of Tokens
     */
    function tokenize(input: string): Token[] {
        const tokens: Token[] = [];
        let j = 0
        while(i < input.length && j < 999) {
            skipWhitespace(input);
            if (i >= input.length || j >= 999) break;

            const c = input[i]
            let token;

            switch (true) {
                case isSingleLineComment(input):
                    token = readSingleLineComment(input);
                    break;
                case isMultiLineComment(input):
                    token = readMultiLineComment(input);
                    break;
                case isDigit(c):
                    token = readNumber(input);
                    break;
                case isOperator(c):
                    token = readOperator(input);
                    break;
                case isPunctuation(c):
                    token = readPunctuation(input);
                    break;
                case isStringDelim(c):
                    token = readString(input, c);
                    break;
                case isIdentifierStart(c):
                    token = readIdentifier(input);
                    break;
                default:
                    const e = new Error(`LogMagic: Tokenizer failed to parse next token "${input.substring(i, 16)}..."`);
                    throw e;
            }
            j++;
            tokens.push(token);
        }
        return tokens;
    }

    return tokenize;
}