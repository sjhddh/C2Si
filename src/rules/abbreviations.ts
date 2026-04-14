import type { CompressionRule } from '../types.js';

/**
 * General abbreviations that save tokens across all domains.
 * Only includes replacements where the abbreviation is:
 * 1. Widely recognized
 * 2. Present in LLM training data
 * 3. Actually saves tokens (tokenizer-verified for common BPE)
 */
const GENERAL_ABBREVIATIONS: [RegExp, string][] = [
  [/\bfor example\b/gi, 'e.g.'],
  [/\bthat is\b/gi, 'i.e.'],
  [/\band so on\b/gi, 'etc.'],
  [/\band so forth\b/gi, 'etc.'],
  [/\bet cetera\b/gi, 'etc.'],
  [/\bcompare\b/gi, 'cf.'],
  [/\bversus\b/gi, 'vs.'],
  [/\bapproximately\b/gi, '~'],
  [/\bgreater than\b/gi, '>'],
  [/\bless than\b/gi, '<'],
  [/\bgreater than or equal to\b/gi, '>='],
  [/\bless than or equal to\b/gi, '<='],
  [/\bnot equal to\b/gi, '!='],
  [/\bequal to\b/gi, '='],
  [/\bwith reference to\b/gi, 're:'],
  [/\bregarding\b/gi, 're:'],
  [/\bconcerning\b/gi, 're:'],
  [/\binformation\b/gi, 'info'],
  [/\bconfiguration\b/gi, 'config'],
  [/\bapplication\b/gi, 'app'],
  [/\bdocumentation\b/gi, 'docs'],
  [/\bspecification\b/gi, 'spec'],
  [/\bimplementation\b/gi, 'impl'],
  [/\benvironment\b/gi, 'env'],
  [/\bdevelopment\b/gi, 'dev'],
  [/\bproduction\b/gi, 'prod'],
  [/\brepository\b/gi, 'repo'],
  [/\bdirectory\b/gi, 'dir'],
  [/\bmaximum\b/gi, 'max'],
  [/\bminimum\b/gi, 'min'],
  [/\btemporary\b/gi, 'temp'],
  [/\boriginal\b/gi, 'orig'],
  [/\bprevious\b/gi, 'prev'],
  [/\bcurrent\b/gi, 'curr'],
  [/\bnumber\b/gi, 'num'],
  [/\bmessage\b/gi, 'msg'],
  [/\bfunction\b/gi, 'fn'],
  [/\bargument\b/gi, 'arg'],
  [/\bparameter\b/gi, 'param'],
  [/\breference\b/gi, 'ref'],
  [/\bexecution\b/gi, 'exec'],
  [/\borganization\b/gi, 'org'],
  [/\bgovernment\b/gi, 'govt'],
  [/\bmanagement\b/gi, 'mgmt'],
  [/\bdepartment\b/gi, 'dept'],
  [/\btechnology\b/gi, 'tech'],
  [/\binternational\b/gi, "int'l"],
];

/**
 * Domain-specific abbreviations.
 */
const DOMAIN_ABBREVIATIONS: Record<string, [RegExp, string][]> = {
  finance: [
    [/\bquarter\b/gi, 'Q'],
    [/\brevenue\b/gi, 'rev'],
    [/\bbasis points?\b/gi, 'bp'],
    [/\byear[ -]over[ -]year\b/gi, 'YoY'],
    [/\bquarter[ -]over[ -]quarter\b/gi, 'QoQ'],
    [/\bmonth[ -]over[ -]month\b/gi, 'MoM'],
    [/\bearnings before interest,? taxes,? depreciation,? and amortization\b/gi, 'EBITDA'],
    [/\breturn on investment\b/gi, 'ROI'],
    [/\breturn on equity\b/gi, 'ROE'],
    [/\bcompound annual growth rate\b/gi, 'CAGR'],
    [/\bgross domestic product\b/gi, 'GDP'],
    [/\bconsumer price index\b/gi, 'CPI'],
    [/\btransaction\b/gi, 'txn'],
  ],
  legal: [
    [/\bplaintiff\b/gi, 'P'],
    [/\bdefendant\b/gi, 'D'],
    [/\bSection\b/gi, 'Sec.'],
    [/\bArticle\b/gi, 'Art.'],
    [/\bParagraph\b/gi, 'Par.'],
    [/\bSubsection\b/gi, 'Subsec.'],
    [/\bin accordance with\b/gi, 'per'],
    [/\bpursuant to\b/gi, 'per'],
    [/\bnotwithstanding\b/gi, 'despite'],
    [/\bhereinafter\b/gi, 'hereafter'],
    [/\baforementioned\b/gi, 'said'],
  ],
  code: [
    [/\bfunction\b/gi, 'fn'],
    [/\bvariable\b/gi, 'var'],
    [/\bconstant\b/gi, 'const'],
    [/\bboolean\b/gi, 'bool'],
    [/\bstring\b/gi, 'str'],
    [/\binteger\b/gi, 'int'],
    [/\bcharacter\b/gi, 'char'],
    [/\bdatabase\b/gi, 'db'],
    [/\bauthentication\b/gi, 'auth'],
    [/\bauthorization\b/gi, 'authz'],
    [/\bconfiguration\b/gi, 'config'],
    [/\basynchronous\b/gi, 'async'],
    [/\bsynchronous\b/gi, 'sync'],
    [/\bmiddleware\b/gi, 'mw'],
  ],
  medical: [
    [/\bpatient\b/gi, 'pt'],
    [/\bdiagnosis\b/gi, 'dx'],
    [/\btreatment\b/gi, 'tx'],
    [/\bprescription\b/gi, 'Rx'],
    [/\bsymptom\b/gi, 'sx'],
    [/\bhistory\b/gi, 'hx'],
    [/\bexamination\b/gi, 'exam'],
    [/\btemperature\b/gi, 'temp'],
    [/\bblood pressure\b/gi, 'BP'],
    [/\bheart rate\b/gi, 'HR'],
  ],
};

/**
 * Abbreviations compression rule.
 * Replaces common long words/phrases with standard abbreviations.
 */
export const abbreviationsRule: CompressionRule = (text, ctx) => {
  let result = text;

  // Apply general abbreviations
  for (const [pattern, replacement] of GENERAL_ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }

  // Apply domain-specific abbreviations if domain is specified
  if (ctx.domain && DOMAIN_ABBREVIATIONS[ctx.domain]) {
    for (const [pattern, replacement] of DOMAIN_ABBREVIATIONS[ctx.domain]) {
      result = result.replace(pattern, replacement);
    }
  }

  return result;
};
