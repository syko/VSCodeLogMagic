import {LoggerConfig} from "../logger";
import {ParseSequence, common} from "../parser";
import {TokenizerConfig, TOKEN_KEYWORD} from "../tokenizer";

const LOG_ID_KEYWORDS = ['if', 'else if', 'else', 'switch', 'case', 'return', 'for', 'while', 'do', 'yield', 'continue', 'break'];
const MULTIWORD_KEYWORDS = [['else', 'if']];
const IDENTIFIER_CHAIN_CHARS = ['.']

const tokenizerConfig: TokenizerConfig = {
    PUNCTUATION: ',.;\\[]{}@#()',
    IDENTIFIER_START: 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM$_',
    IDENTIFIER: 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM$_' + '_1234567890',
    DIGIT: '1234567890',
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
        'synchronized', 'throws', 'transient', 'volatile', 'null', 'true', 'false ',
    ]
};

const parseSequence: ParseSequence = [
    common.removeWhitespace,
    common.removeComments,
    common.getCombineIdentifierChainsFn(IDENTIFIER_CHAIN_CHARS),
    common.combineBracketNotation,
    common.removeLambdas,
    common.getCombineConsecutiveTokensFn([TOKEN_KEYWORD], TOKEN_KEYWORD, MULTIWORD_KEYWORDS, ' '),
    common.getSetDefaultIdFn(LOG_ID_KEYWORDS),
    common.removeFunctionNames,
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
        quoteCharacter: '\''
    },
    {
        logPrefix: 'console.info(',
        parameterSeparator: ', ',
        identifierPrefix: '',
        identifierSuffix: '',
        logSuffix: ');',
        quoteCharacter: '\''
    },
    {
        logPrefix: 'console.warn(',
        parameterSeparator: ', ',
        identifierPrefix: '',
        identifierSuffix: '',
        logSuffix: ');',
        quoteCharacter: '\''
    },
    {
        logPrefix: 'console.error(',
        parameterSeparator: ', ',
        identifierPrefix: '',
        identifierSuffix: '',
        logSuffix: ');',
        quoteCharacter: '\''
    }
];

export {tokenizerConfig, parseSequence, loggerConfig};