import {LoggerConfig} from "../logger";
import {ParseSequence, common} from "../parser";
import {TokenizerConfig, TOKEN_IDENTIFIER, TOKEN_KEYWORD, TOKEN_NUMBER} from "../tokenizer";

const LOG_ID_KEYWORDS = ['if', 'else if', 'else', 'switch', 'case', 'return', 'for', 'while', 'do', 'yield', 'continue', 'break'];
const MULTIWORD_KEYWORDS = [['else', 'if']];
const IDENTIFIER_CHAIN_CHARS = ['.']
const NUMBER_REGEX = /^-?(0b|0o)?[0-9]+(_[0-9]+)*(\.[0-9]+(_[0-9]+)*)?(e-?[0-9]+(_[0-9]+)*)?(n)?/i
const HEX_NUMBER_REGEX = /^-?(0x)[0-9a-f]+(_[0-9a-f]+)*(n)?/i

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
        'synchronized', 'throws', 'transient', 'volatile', 'null', 'true', 'false ', 'Infinity'
    ]
};

const parseSequence: ParseSequence = [
    common.removeWhitespace,
    common.removeComments,
    common.getCombineConsecutiveTokensOfTypeFn([TOKEN_IDENTIFIER], TOKEN_IDENTIFIER, IDENTIFIER_CHAIN_CHARS),
    common.combineBracketNotation,
    common.getCombineMatchingTokens(TOKEN_NUMBER, HEX_NUMBER_REGEX),
    common.getCombineMatchingTokens(TOKEN_NUMBER, NUMBER_REGEX),
    common.removeLambdas,
    common.getCombineConsecutiveTokensOfValueFn(TOKEN_KEYWORD, MULTIWORD_KEYWORDS, ' '),
    common.getSetDefaultIdFn(LOG_ID_KEYWORDS),
    common.removeFunctionDeclarationAssignees,
    common.removeLambdaDeclarationAssignees,
    common.removeFunctionCalls,
    common.removeLiterals,
    common.removePunctuation,
    common.removeOperators,
    common.removeNonIdentifiers,
    common.removeDuplicates,
    common.storeTokensAsLogItems
];

const loggerConfig: LoggerConfig = [
    {
        logPrefix: 'console.log(',
        parameterSeparator: ', ',
        identifierPrefix: '',
        identifierSuffix: '',
        logSuffix: ');',
        quoteCharacter: '\'',
        insertSpaces: false
    },
    {
        logPrefix: 'console.info(',
        parameterSeparator: ', ',
        identifierPrefix: '',
        identifierSuffix: '',
        logSuffix: ');',
        quoteCharacter: '\'',
        insertSpaces: false
    },
    {
        logPrefix: 'console.warn(',
        parameterSeparator: ', ',
        identifierPrefix: '',
        identifierSuffix: '',
        logSuffix: ');',
        quoteCharacter: '\'',
        insertSpaces: false
    },
    {
        logPrefix: 'console.error(',
        parameterSeparator: ', ',
        identifierPrefix: '',
        identifierSuffix: '',
        logSuffix: ');',
        quoteCharacter: '\'',
        insertSpaces: false
    }
];

export {tokenizerConfig, parseSequence, loggerConfig};