export const TOKEN_NUMBER = 'number';
export const TOKEN_STRING = 'string';
export const TOKEN_IDENTIFIER = 'identifier';
export const TOKEN_IDENTIFIER_CHAIN = '.';
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

export type Token = {
    type: TokenType;
	value: string | number;
};

export type TokenizerConf = {
	PUNCTUATION: string;
	IDENTIFIER_START: string;
    IDENTIFIER: string;
    DIGIT: string;
    OPERATOR: string;
    STRING_DELIM: string;
    WHITESPACE: string;
    SINGLE_LINE_COMMENT: string;
    MULTI_LINE_COMMENT_START: string;
    MULTI_LINE_COMMENT_END: string;
    KEYWORD: string[];
};

export type Tokenizer = (input: string) => Token[];

export function createTokenizer(conf: TokenizerConf): Tokenizer {

    let i = 0; // Internal caret that is moved forward

    function readWhile(input: string, conditionFn: (char: string) => boolean) {
        let chars = []
        while (conditionFn(input[i])) chars.push(input[i++]);
        return chars.join('');
    }

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

    function readUntil(input: string, endDelim: string, canEscape: boolean = true): string {
        let str = ''
        let escaped = false
        while(i < input.length) {
            if (escaped) {
                escaped = false;
            } else if (canEscape && input[i] === "\\") {
                escaped = true;
            } else if (input.startsWith(endDelim, i)) {
                break;
            }
            str += input[i];
            i++;
        }
        return str;
    }

    function skipWhitespace(input: string):number {
        return readWhile(input, isWhitespace).length;
    }

    function readNumber(input: string): Token {
        const str = readWhile(input, (char: string) => {
            let seenDot = false;
            return isDigit(char) || (!seenDot && char === '.' && (seenDot = true));
        })
        return { type: TOKEN_NUMBER, value: parseFloat(str) }
    }

    function readOperator(input: string): Token {
        return { type: TOKEN_OPERATOR, value: readWhile(input, isOperator) }
    }

    function readPunctuation(input: string): Token {
        return { type: TOKEN_PUNCTUATION, value: input[i++] }
    }

    function readIdentifier(input: string): Token {
        const str = readWhile(input, isIdentifier);
        return { type: isKeyword(str) ? TOKEN_KEYWORD: TOKEN_IDENTIFIER, value: str }
    }

    function readString(input: string, quoteChar: string): Token {
        i += quoteChar.length;
        const str = readUntil(input, quoteChar);
        i += quoteChar.length;
        return { type: TOKEN_STRING, value: str }
    }

    function readSingleLineComment(input: string): Token {
        const str = input.substr(i + conf.SINGLE_LINE_COMMENT.length);
        i = input.length
        return { type: TOKEN_COMMENT, value: str }
    }

    function readMultiLineComment(input: string): Token {
        i += conf.MULTI_LINE_COMMENT_START.length;
        const str = readUntil(input, conf.MULTI_LINE_COMMENT_END, false);
        i += conf.MULTI_LINE_COMMENT_END.length;
        return { type: TOKEN_COMMENT, value: str }
    }

    // Main

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