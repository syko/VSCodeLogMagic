import {ParseResult} from './parser';

function createLogger(language: string): (parseResult: ParseResult) => string {
	return (parseResult: ParseResult) => {return "";}
}