import { canonicalizeShortcut } from './normalize.js';
import { isReservedShortcut } from './reserved.js';
import type { Assessment, AssessmentInput, Shortcut } from './types.js';

/**
 * Implements `RecorderApi.AssessShortcut` — in `AssessmentInput`, out `Assessment`.
 *
 * Applies two business rules:
 *
 * - `ConflictReporting` — "A candidate matching an existing normalized shortcut
 *   reports the matching binding as a conflict." Matching is identity on the
 *   canonical text, so `"mod+k"` and `"Mod+K"` are the same candidate.
 * - `ReservedWarning` — "A recognized browser-reserved shortcut produces a
 *   warning rather than being treated as an ordinary unreserved assignment."
 *
 * The two are independent: a candidate can be both assigned and reserved, and
 * the assessment reports both. `AssessmentInput` carries no identity for the
 * binding being edited, so a caller re-assigning an existing binding must leave
 * that binding out of `existing` or it will collide with itself.
 */
export function assessShortcut(input: AssessmentInput): Assessment {
  const shortcut: Shortcut = canonicalizeShortcut(input.shortcut);

  const assessment: Assessment = {
    shortcut,
    reserved: isReservedShortcut(shortcut, input.platform),
  };

  for (const binding of input.existing) {
    if (canonicalizeShortcut(binding.shortcut) === shortcut) {
      assessment.conflict = { bindingId: binding.id, shortcut };
      break;
    }
  }

  return assessment;
}
