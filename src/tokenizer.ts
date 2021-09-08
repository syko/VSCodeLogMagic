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

    function readWhile(input: string, start: number, conditionFn: (char: string) => boolean) {
        let chars = []
        for (let i = start; i < input.length; i++) {
            if (conditionFn(input[i])) chars.push(input[i]);
            else break;
        }
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

    function isSingleLineComment(input: string, start: number) {
        return input.startsWith(conf.SINGLE_LINE_COMMENT, start);
    }

    function isMultiLineComment(input: string, start: number) {
        return input.startsWith(conf.MULTI_LINE_COMMENT_START, start);
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

    function readUntil(input: string, start: number, endDelim: string, canEscape: boolean = true): string {
        let str = ''
        let escaped = false
        for (let i = start; i < input.length; i++) {
            if (escaped) {
                escaped = false;
            } else if (canEscape && input[i] === "\\") {
                escaped = true;
                continue;
            } else if (input.startsWith(endDelim, i)) {
                break;
            }
            str += input[i]
        }
        return str;
    }

    function skipWhitespace(input: string, start: number):number {
        return readWhile(input, start, isWhitespace).length;
    }

    // function skipComment(input: string, start: number):number {
    //     if (isSingleLineComment(input, start)) return input.length - start;
    //     if (isMultiLineComment(input, start)) return ("" + readUntil(input, start, conf.MULTI_LINE_COMMENT_END, false).value).length + conf.MULTI_LINE_COMMENT_END.length;
    //     return 0;
    // }

    function readNumber(input: string, start: number): Token {
        const str = readWhile(input, start, (char: string) => {
            let seenDot = false;
            return isDigit(char) || (!seenDot && char === '.' && (seenDot = true));
        })
        return { type: TOKEN_NUMBER, value: parseFloat(str) }
    }

    function readOperator(input: string, start: number): Token {
        return { type: TOKEN_OPERATOR, value: readWhile(input, start, isOperator) }
    }

    function readPunctuation(input: string, start: number): Token {
        return { type: TOKEN_PUNCTUATION, value: input[start] }
    }

    function readIdentifier(input: string, start: number): Token {
        const str = readWhile(input, start, isIdentifier);
        return { type: isKeyword(str) ? TOKEN_KEYWORD: TOKEN_IDENTIFIER, value: str }
    }

    function readString(input: string, start: number, quoteChar: string): Token {
        return { type: TOKEN_STRING, value: readUntil(input, start + 1, quoteChar) }
    }

    function readSingleLineComment(input: string, start: number): Token {
        return { type: TOKEN_COMMENT, value: input.substr(start + conf.SINGLE_LINE_COMMENT.length) }
    }

    function readMultiLineComment(input: string, start: number): Token {
        return { type: TOKEN_COMMENT, value: readUntil(input, start + conf.MULTI_LINE_COMMENT_START.length, conf.MULTI_LINE_COMMENT_END, false) }
    }

    // Main

    function tokenize(input: string): Token[] {
        const tokens: Token[] = [];
        let i = 0
        let j = 0
        console.log(i)
        while(i < input.length && j < 999) {
            i += skipWhitespace(input, i);
            // let skipped = 0
            // do {
            //     skipped = skipWhitespace(input, i);
            //     skipped += skipComment(input, i)
            //     i += skipped;
            // } while (j < input.length && skipped > 0);

            if (i >= input.length || j >= 999) break;

            const c = input[i]
            let token;

            switch (true) {
                case isSingleLineComment(input, i):
                    token = readSingleLineComment(input, i);
                    i += conf.SINGLE_LINE_COMMENT.length // Skip string delimeter
                    break;
                case isMultiLineComment(input, i):
                    token = readMultiLineComment(input, i);
                    i += conf.MULTI_LINE_COMMENT_START.length + conf.MULTI_LINE_COMMENT_END.length // Skip string delimeter
                    break;
                case isDigit(c):
                    token = readNumber(input, i);
                    break;
                case isOperator(c):
                    token = readOperator(input, i);
                    break;
                case isPunctuation(c):
                    token = readPunctuation(input, i);
                    break;
                case isStringDelim(c):
                    token = readString(input, i, c);
                    i += c.length // Skip string delimeter
                    break;
                case isIdentifierStart(c):
                    token = readIdentifier(input, i);
                    break;
                default:
                    const e = new Error(`LogMagic failed to parse next token "${input.substring(i, 16)}..."`);
                    console.error(e);
                    throw e;
            }
            i += ("" + token.value).length;
            j++;
            tokens.push(token);
        }
        return tokens;
    }

    return tokenize;
}