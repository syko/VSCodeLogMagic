import {LoggerConfig} from "../logger";
import {ParseResult, ParseSequence, ParseStep, common} from "../parser";
import {Token, TokenizerConfig, TOKEN_IDENTIFIER, TOKEN_KEYWORD, TOKEN_OPERATOR, TOKEN_PUNCTUATION} from "../tokenizer";
import {getCodeBlockAt, isCompleteCodeBlock, PARENS_EXT} from "../util";

const LOG_ID_KEYWORDS = ['if', 'else if', 'else', 'switch', 'case', 'return', 'for', 'while', 'do', 'yield', 'continue', 'break'];
const MULTIWORD_KEYWORDS = [['else', 'if']];
const MULTICHAR_PUNCTUATION = [['?', '.']];
const IDENTIFIER_CHAIN_CHARS = ['.', '?.']

const tokenizerConfig: TokenizerConfig = {
    PUNCTUATION: ',.;\\[]{}@#$()~',
    IDENTIFIER_START: 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM$_',
    IDENTIFIER: 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM$_' + '_1234567890',
    DIGIT: '1234567890',
    OPERATOR: '-+/*%=<>!|&^?:',
    STRING_DELIM: "\"'\`",
    SINGLE_LINE_COMMENT: '//',
    MULTI_LINE_COMMENT_START: '/*',
    MULTI_LINE_COMMENT_END: '*/',
    KEYWORD: [
        'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char',
        'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double',
        'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float',
        'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal',
        'is', 'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator', 'out',
        'override', 'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte',
        'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this',
        'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort',
        'using', 'virtual', 'void', 'volatile', 'while', 'add', 'and', 'alias', 'ascending',
        'async', 'await', 'by', 'descending', 'dynamic', 'equals', 'from', 'get', 'global',
        'group', 'init', 'into', 'join', 'let', 'managed', 'nameof', 'nint', 'not',
        'notnull', 'nuint', 'on', 'or', 'orderby', 'partial', 'partial', 'record', 'remove',
        'select', 'set', 'unmanaged', 'unmanaged', 'value', 'var', 'when', 'where', 'where',
        'with', 'yield',
    ]
};

// + Remove comments - UPDOWN U
// If "}|]": look for matching "{|[" and use that line instead - DOWN U
// --- If "...)...": look for matching "(" and combine all lines to one (removing comments before) - DOWN U
// + foo.bar.buz => one identifier - UPDOWN U
// + Combine else if
// + Combine array syntax
// + Detect & remove types - UPDOWN C# vs TS vs JS Obj Notation
// + Detect & remove complete lambdas - UPDOWN U  
// + Remove function names
// + Remove strings, numbers, punctuation, operators - UPDOWN U w/ different tokenizerConfs
// + Detect label for log line - if/switch/return/assignee/functioncall/...
// + Remove keywords

const removeTypes: ParseStep = (result: ParseResult) => {
    // First, remove comma-separated identifiers wrapped in <>
    for (let i = 0; i < result.tokens.length; i++) {
        const token: Token = result.tokens[i];
        if (token.type !== TOKEN_OPERATOR || token.value !== '<') continue;
        // Found '<', let's check if it's a type notation
        const block = getCodeBlockAt(result.tokens, i, 1, PARENS_EXT);
        // Check if we found the end of block at all or if this might be a comparision operator instead
        if (!isCompleteCodeBlock(block)) continue;
        // Check if the block only contains comma-separated list of identifiers or if we might've found 2 comparisons instead
        if (!block.every((t: Token, i: number) => {
            return i === 0 || i === block.length - 1
                || t.type === TOKEN_IDENTIFIER
                || t.type == TOKEN_PUNCTUATION && t.value === ','
        })) continue;
        // Remove block
        result.tokens.splice(i, block.length);
    }
    // Detect N consecutive identifiers, remove all but the last
    result.tokens = result.tokens.filter((t: Token, i: number) => t.type !== TOKEN_IDENTIFIER || result.tokens[i + 1]?.type !== TOKEN_IDENTIFIER);
}

const parseSequence: ParseSequence = [
    common.removeWhitespace,
    common.removeComments,
    common.getCombineConsecutiveTokensFn([TOKEN_PUNCTUATION, TOKEN_OPERATOR], TOKEN_PUNCTUATION, MULTICHAR_PUNCTUATION),
    common.getCombineIdentifierChainsFn(IDENTIFIER_CHAIN_CHARS),
    common.combineBracketNotation,
    removeTypes,
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
        logPrefix: 'Console.WriteLine(',
        parameterSeparator: ' + ',
        identifierPrefix: '',
        identifierSuffix: '',
        logSuffix: ');',
        quoteCharacter: '"'
    },
    {
        logPrefix: 'Console.Write(',
        parameterSeparator: ' + ',
        identifierPrefix: '',
        identifierSuffix: '',
        logSuffix: ');',
        quoteCharacter: '"'
    },
    {
        logPrefix: 'Debug.Log(',
        parameterSeparator: ' + ',
        identifierPrefix: '',
        identifierSuffix: '',
        logSuffix: ');',
        quoteCharacter: '"'
    }
];

export {tokenizerConfig, parseSequence, loggerConfig};