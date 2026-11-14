import type { OpeningFraming } from '../content/types';
import type { DetailingMethod, LintelMode, OpeningPosition } from '../job/types';
import type { Check } from './calc';

// Opening framing suggestions (requirement-update #17–#19). Pure functions: the UI shows
// the result as a suggestion; the detailer can still change the trimmer or lintel choice.

export interface FramingInput {
  /** The wall is an internal wall (not under an elevation). */
  internal: boolean;
  loadBearing: boolean;
  /** Stud opening width in mm (schedule width + allowance), or null when not entered yet. */
  studWidth: number | null;
  position: OpeningPosition;
  lintelMode: LintelMode;
}

export type FramingCase = 'with-lintel' | 'internal-no-lintel' | 'external-no-lintel' | 'no-suitable';

export interface FramingSuggestion {
  case: FramingCase;
  /** designed = Hyne Design / Autobeam lintel; floor-system = lintel in the floor above. */
  lintel: 'designed' | 'none' | 'floor-system';
  trimmer: string;
  jamb: string;
  /** Double jamb stud on the wall-corner side (door 90 / 70 mm from a corner). */
  jambCorner: string | null;
  prop: string | null;
  reason: string;
  /** The detailer's lintel choice does not fit this opening. */
  warning: Check | null;
}

/** Small internal openings in non-load-bearing walls need no lintel (stud opening width ≤ threshold). */
export function isSmallNonLoadBearing(input: Pick<FramingInput, 'loadBearing' | 'studWidth'>, threshold: number): boolean {
  return !input.loadBearing && input.studWidth !== null && input.studWidth <= threshold;
}

export function framingSuggestion(input: FramingInput, f: OpeningFraming): FramingSuggestion | null {
  const t = f.lintelThreshold;
  const corner = input.position === 'corner90' ? f.noLintel.jambCorner90 : input.position === 'corner70' ? f.noLintel.jambCorner70 : null;

  if (input.lintelMode === 'no-suitable') {
    return {
      case: 'no-suitable',
      lintel: 'floor-system',
      trimmer: f.withLintel.trimmer,
      jamb: '2/LVL studs',
      jambCorner: null,
      prop: '2/LVL studs',
      reason: 'No suitable lintel (too deep for the over) — set jamb and prop studs as 2/LVL studs; the lintel may sit in the floor system.',
      warning: null,
    };
  }

  // Internal, non-load-bearing, up to the threshold: no lintel, no prop stud.
  if (input.internal && !input.loadBearing) {
    if (input.studWidth === null) return null;
    if (input.studWidth <= t) {
      return {
        case: 'internal-no-lintel',
        lintel: 'none',
        trimmer: f.noLintel.trimmer,
        jamb: f.noLintel.jamb,
        jambCorner: corner,
        prop: null,
        reason: `Internal opening up to ${t} in a non-load-bearing wall: no lintel, no prop stud.`,
        warning: null,
      };
    }
  }

  if (!input.internal && input.lintelMode === 'none') {
    const ok = isSmallNonLoadBearing(input, t);
    return {
      case: 'external-no-lintel',
      lintel: 'none',
      trimmer: f.noLintel.trimmer,
      jamb: f.noLintel.jamb,
      jambCorner: null,
      prop: null,
      reason: `External opening up to ${t} in an external non-load-bearing wall: no lintel.`,
      warning: ok
        ? null
        : {
            level: 'warn',
            message:
              input.studWidth === null
                ? 'No lintel: enter the schedule size to confirm the stud opening is not over ' + t + ' mm'
                : `No lintel is only for an external non-load-bearing wall with a stud opening up to ${t} mm`,
          },
    };
  }

  const why = input.internal
    ? input.loadBearing
      ? 'Internal opening in a load-bearing wall: set up like an external opening.'
      : `Internal opening over ${t}: set up like an external opening.`
    : 'External opening: lintel, trimmer, jamb and prop studs.';
  return {
    case: 'with-lintel',
    lintel: 'designed',
    trimmer: f.withLintel.trimmer,
    jamb: f.withLintel.jamb,
    jambCorner: null,
    prop: f.withLintel.prop,
    reason: why,
    warning: null,
  };
}

/** "90x35 MGP10" → "2/90x35 MGP10" when single-ply 90x35 / 140x35 is too weak (#18). */
export function doubleLintelSuggestion(timber: string, doubleLintels: string[]): string | null {
  const m = /^\s*(?:1\s*\/\s*)?(\d{2,3})\s*x\s*(\d{2})\b(.*)$/i.exec(timber);
  if (!m) return null;
  const size = `${m[1]}x${m[2]}`;
  if (!doubleLintels.map((s) => s.replace(/\s+/g, '').toLowerCase()).includes(size.toLowerCase())) return null;
  return `2/${size}${m[3]}`.trim();
}

export interface MethodInfo {
  label: string;
  reminder: string;
  /** Notes to add on the elevation (match the "Extra notes on elevations" tick list). */
  notes: string[];
}

export const METHOD_INFO: Record<DetailingMethod, MethodInfo> = {
  'header-raise': {
    label: 'Header raised 5 mm',
    reminder: 'Header raised 5 mm to tidy up the trimmer and overs — also raise the window opening height 5 mm. No header connect between lintel and trimmers.',
    notes: [],
  },
  'cut-ribbon': {
    label: 'Cut in ribbon plate',
    reminder: 'Add notes "Cut in ribbon plate" and "+ Head Straps", and the head strap workline.',
    notes: ['Cut in ribbon plate', '+ Head Straps', 'Head strap workline'],
  },
  'cut-top': {
    label: 'Cut in top plate',
    reminder: 'Add note "Cut in top plate".',
    notes: ['Cut in top plate'],
  },
  'trimmer-plus': {
    label: '+30 / +25 / +20 trimmer',
    reminder: 'Set the trimmer offset (+30, +25 or +20).',
    notes: [],
  },
};

export const LINTEL_MODE_LABELS: Record<LintelMode, string> = {
  designed: 'Lintel designed (Hyne / Autobeam)',
  'no-suitable': 'No suitable lintel (too deep for the over)',
  none: 'No lintel — external non-load-bearing, up to 1800',
};
