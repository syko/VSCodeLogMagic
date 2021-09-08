import {removeListener} from "process";
import {combineCommonMultiWordKeywords, combineIdentifierChains, ParseResult, ParseSequence, ParseStep, removeComments, removeFunctionNames, removeLambdas, removeLiterals, removeNonIdentifiers, removeOperators, removePunctuation, setDefaultId} from "../parser";
import { Token, TokenizerConf, TOKEN_IDENTIFIER } from "../tokenizer";

const tokenizerConf: TokenizerConf = {
    PUNCTUATION: ',.;\\[]{}@#$()~',
    IDENTIFIER_START: 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM$_',
    IDENTIFIER: 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM$_' + '_1234567890',
    DIGIT: '1234567890',
    OPERATOR: '-+/*%=<>!|&^?:',
    STRING_DELIM: "\"'\`",
    WHITESPACE: '\t\n\r ',
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
// Combine else if
// Combine array syntax
// + Detect & remove types - UPDOWN C# vs TS vs JS Obj Notation
// + Detect & remove complete lambdas - UPDOWN U  
// + Remove function names
// + Remove strings, numbers, punctuation, operators - UPDOWN U w/ different tokenizerConfs
// + Detect label for log line - if/switch/return/assignee/functioncall/...
// + Remove keywords

const removeTypes: ParseStep = (result: ParseResult) => {
    // Detect N consecutive identifiers, remove all but the last
    result.tokens = result.tokens.filter((t: Token, i: number) => t.type !== TOKEN_IDENTIFIER || result.tokens[i + 1]?.type !== TOKEN_IDENTIFIER);
}

const parseSequence: ParseSequence = [
    removeComments,
    combineIdentifierChains,
    removeTypes,
    removeLambdas,
    removeFunctionNames,
    removeLiterals,
    removePunctuation,
    removeOperators,
    combineCommonMultiWordKeywords,
    setDefaultId,
    removeNonIdentifiers
];

export {tokenizerConf, parseSequence};