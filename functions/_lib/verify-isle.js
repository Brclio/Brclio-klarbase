import { SCHEMAS, schemaOf, parseIsle, solveIsle, canonicalIsle, isleHash, auditIsle, TIER_IDS } from '@klar/core';

const SOLVE_BUDGET = 200000;
export const ISLE_SHAPE_ERROR = 'not an isle document (schemaVersion 5 with rows, or 6 with storeys)';
const validation = (code, text) => ({ errors:[{ code, text }] });

export function verifyIsle(puzzle){
  if(!puzzle || typeof puzzle !== 'object' || !SCHEMAS.includes(puzzle.schemaVersion) || schemaOf(puzzle) !== puzzle.schemaVersion
    || !Array.isArray(puzzle.schemaVersion === 5 ? puzzle.rows : puzzle.storeys))
    return validation('E_SHAPE', ISLE_SHAPE_ERROR);
  if(puzzle.tier != null && !TIER_IDS.includes(puzzle.tier)) return validation('E_TIER', `tier must be one of: ${TIER_IDS.join(', ')}`);

  // Never accept par, solution or difficulty audit from the submitted JSON.
  const { ok, errors, level } = parseIsle(puzzle);
  if(!ok) return { errors:errors.map(({ code, text }) => ({ code, text })) };
  const solved = solveIsle(level, { maxStates:SOLVE_BUDGET });
  if(!solved.solvable) return solved.capped
    ? validation('E_TOO_BIG', 'too large to verify — make the isle smaller')
    : validation('E_UNSOLVABLE', 'not solvable — no sequence of moves reaches a goal');

  const { states, traps, greedy, routes, par, capped } = auditIsle(level, { maxStates:SOLVE_BUDGET });
  return { hash:isleHash(puzzle), puzzle:{ ...canonicalIsle(puzzle), par:solved.par, solution:solved.solution,
    audit:{ states, traps, greedy, routes, par, capped }, ...(puzzle.tier ? { tier:puzzle.tier } : {}) } };
}
