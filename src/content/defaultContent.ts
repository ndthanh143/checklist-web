import type { Builder, ChecklistContent, ChecklistItem, FieldDef, Stage } from './types';
import { DEFAULT_NOG_TABLE, DEFAULT_OPENING_FRAMING } from './types';

// Initial checklist content, built from:
// - Blueprint_Checklist_Website_Lawmans_MiTek (stage order, rules)  → "Blueprint"
// - Spec - Update - 2nd                                              → "Spec"
// - Check list LAWMANS FRAME & TRUSS PTY LTD.xlsx                    → "Excel"
// - Live job 26-89 / 26-175 client feedback                          → tips
// After launch, agents edit this content in the Content editor (/admin).

const stages: Stage[] = [
  { id: 'job-review', title: 'Job Review', ref: 'Blueprint §6.1', summary: 'Review the customer specification, construction plan, roof layout and floor layout.' },
  { id: 'job-setup', title: 'Job Setup', ref: 'Blueprint §6.2', summary: 'Set up panel types, materials, heights and noggings in MiTek 20/20. Enter sizes for this job — builder values are suggestions only.' },
  { id: 'wall-input', title: 'Wall Input', ref: 'Blueprint §6.3, §6.4, §6.6, §6.7', summary: 'Input walls, special walls (step-down, raked, parapet), posts and beams.' },
  { id: 'elevations', title: 'Elevations', ref: 'Blueprint §8 (steps 1–2)', summary: 'Set how many elevations the job has, name them and mark the front façade.' },
  { id: 'wall-panels', title: 'Wall Panels per Elevation', ref: 'Blueprint §8 (step 3)', summary: 'Assign every wall panel to an elevation and set its finish. Length and height are checked against frame limits.' },
  { id: 'openings', title: 'Openings per Elevation', ref: 'Blueprint §9', summary: 'Enter openings from the window/door schedule. Stud openings and lintel deflection are checked automatically.' },
  { id: 'wall-adjustment', title: 'Wall Adjustment', ref: 'Blueprint §5, §11', summary: 'Break walls, bulkheads, tie-down bolts, extra noggings and critical studs.' },
  { id: 'elevation-check', title: 'Elevation Check', ref: 'Blueprint §10, §12', summary: 'Check elevations: dimensions, studs, bracing capacity, bracing, stud ties and notes.' },
  { id: 'labels-notes', title: 'Labels & Notes', ref: 'Blueprint §13', summary: 'Final check of labels, numbering, worklines and notes on the frame layout.' },
];

const ADD_STYLE_LIKE = ['add-style', 'idyll'];

/** Some jobs are recalculated and need a stronger member in some areas (#9). */
const OTHER_SIZES = (member: string): FieldDef => ({
  id: 'otherSizes',
  label: 'Other sizes (if any)',
  kind: 'rows',
  addLabel: 'Add other size',
  hint: `Only when part of the job uses a different ${member} (e.g. recalculated for extra load).`,
  columns: [
    { id: 'size', label: 'Size & grade', kind: 'text', placeholder: 'e.g. 90x45 MGP12', required: true },
    { id: 'where', label: 'Where (walls / area)', kind: 'text', placeholder: 'e.g. E4, E5 — garage', required: true },
    { id: 'reason', label: 'Reason', kind: 'text', placeholder: 'e.g. girder load' },
  ],
});

const BEAM_MID = 'Mid-wall pockets: top plate kept, Trim Beam Pockets unticked';
const BEAM_END = 'End-of-wall pockets: top plates removed';

const items: ChecklistItem[] = [
  // ───────────────────────── 1. Job Review ─────────────────────────
  {
    id: 'jr-detailing-info',
    stage: 'job-review',
    title: 'Review detailing information',
    detail: 'Take these from the customer specification, construction plan and roof layout.',
    fields: [
      { id: 'roof', label: 'Roof', kind: 'select', options: ['Metal sheet', 'Concrete tiles', 'Terracotta tiles', 'Other'], required: true },
      { id: 'pitch', label: 'Pitch', kind: 'number', unit: '°', required: true },
      { id: 'trussSpacing', label: 'Truss spacing', kind: 'number', unit: 'mm', placeholder: '600', required: true },
      { id: 'ceilingType', label: 'Ceiling type', kind: 'text', placeholder: 'e.g. 13mm Plaster / direct to BC', required: true },
      { id: 'overhang', label: 'Eave overhang', kind: 'number', unit: 'mm', required: true },
      { id: 'wind', label: 'Wind class', kind: 'select', options: ['N1', 'N2', 'N3', 'N4', 'Other'], required: true },
    ],
    ref: { source: 'Blueprint', section: '6.1.2' },
  },
  {
    id: 'jr-load-bearing',
    stage: 'job-review',
    title: 'Identify load-bearing walls',
    detail:
      'Load-bearing is not decided by looking at the floor plan only. Compare joist direction, where joists stop, beams and point loads.\n' +
      '- Wall perpendicular to floor joists and marked load-bearing → carries joist loads.\n' +
      '- Floor joists interrupted at the wall → carries joist loads.\n' +
      '- Wall parallel to joists but supporting a point-load beam → add a 90x25 ribbon plate, at least 300 mm each side of the point load.\n' +
      '- Stair void / Posi-Strut not clear → ask the Posi-Strut detailer and mark "Needs confirmation". Do not guess.',
    fields: [
      {
        id: 'sources',
        label: 'Documents checked',
        kind: 'checks',
        options: ['Floor joist layout', 'Floor beam layout (Meyer Timber)', 'Structural engineering / steel shop drawings', 'Point loads and structural beams located'],
        requireAll: true,
      },
      { id: 'external', label: 'External walls', kind: 'checks', options: ['External walls are load-bearing'] },
      {
        id: 'internalLb',
        label: 'Internal load-bearing walls (labels)',
        kind: 'text',
        placeholder: 'e.g. I3, I7, I12 — leave empty if none',
        hint: 'Some internal walls carry the floor or a point load. These walls are ticked "LB" when you add them in Wall Panels.',
      },
    ],
    ref: { source: 'Spec', section: 'III.1' },
    checkerFocus: true,
  },
  {
    id: 'jr-slab',
    stage: 'job-review',
    title: 'Check slab step locations on the slab plan',
    detail: 'Required on every Transpire job.',
    appliesWhen: { builders: ['transpire'] },
    ref: { source: 'Spec', section: 'IV.4.4' },
  },
  {
    id: 'jr-quote',
    stage: 'job-review',
    title: 'Check the quote',
    detail: 'Stud spacing (450 or 600), loose framing allowances (e.g. under-stair walls), supplied items.',
  },

  // ───────────────────────── 2. Job Setup ─────────────────────────
  {
    id: 'js-panel-types',
    stage: 'job-setup',
    title: 'Set up Default Panel Types',
    detail:
      'Use the 90x35 600C EXTp12 setup for external wall frames so all studs and junctions get MGP12. If the default 90x35 600C EXT is used, some junctions will not change with the panel properties and must be fixed one by one.\n' +
      'Change "Name" to suit the job — it is printed on all elevations.',
    fields: [
      { id: 'name', label: 'Panel Name', kind: 'select', options: ['Single Storey', 'Ground Floor', 'First Floor', 'Studio', 'Granny Flat'], suggest: 'floor.panelName', required: true },
      { id: 'setup', label: 'Setup', kind: 'checks', options: ['External walls use 90x35 600C EXTp12'], requireAll: true },
    ],
    ref: { source: 'Spec', section: 'III.2' },
  },
  {
    id: 'js-thickness',
    stage: 'job-setup',
    title: 'Wall thickness',
    fields: [
      { id: 'external', label: 'External', kind: 'select', options: ['90', '70'], unit: 'mm', required: true },
      { id: 'internal', label: 'Internal', kind: 'select', options: ['90', '70'], unit: 'mm', required: true },
    ],
    ref: { source: 'Blueprint', section: '2.2.2' },
    tips: [{ job: '26-89', text: '70 mm internal walls (Ashmont): all studs, trimmers, top and bottom plates must be 70x35. 70x45 meyWALL is not available.' }],
  },
  {
    id: 'js-stud',
    stage: 'job-setup',
    title: 'Stud size, material and spacing',
    detail:
      'Enter the size designed for this job (Hyne Design / engineering plan). The builder value is only a suggestion.\n' +
      '- Design starts at 90x35 MGP10 @ 600cc.\n' +
      '- Stud spacing may be reduced to 450cc to avoid increasing the top plate size.\n' +
      '- Keep external and internal stud heights consistent where practical.',
    fields: [
      { id: 'stud', label: 'Stud size & grade', kind: 'text', suggest: 'builder.stud', required: true },
      { id: 'spacing', label: 'Stud spacing', kind: 'select', options: ['600cc', '450cc', 'Mixed'], required: true },
      OTHER_SIZES('stud'),
    ],
    ref: { source: 'Spec', section: 'III.6' },
    checkerFocus: true,
  },
  {
    id: 'js-top-plate',
    stage: 'job-setup',
    title: 'Top plate and ribbon plate',
    detail:
      'Enter the plates designed for this job. "2/" means top plate + ribbon plate.\n' +
      '- Load-bearing: design starts at 2/35 mm. Increase to MGP12, or reduce stud spacing to 450cc in extreme cases (loads, tie-downs, wind).\n' +
      '- 2/45 mm, MGP15 or LVL13 is rarely required but remains an option.\n' +
      '- Non-load-bearing: 45 mm top plate as standard.',
    fields: [
      { id: 'lb', label: 'Load-bearing (top + ribbon)', kind: 'text', suggest: 'builder.lbTopPlate', required: true },
      { id: 'nlb', label: 'Non-load-bearing top plate', kind: 'text', suggest: 'builder.nlbTopPlate', required: true },
      OTHER_SIZES('top / ribbon plate'),
    ],
    ref: { source: 'Spec', section: 'III.4' },
    checkerFocus: true,
  },
  {
    id: 'js-bottom-plate',
    stage: 'job-setup',
    title: 'Bottom plate',
    detail: '- Walls on slab: 90x35 MGP10.\n- Walls on floor joists / Posi-Strut: design by Hyne Design.',
    fields: [
      { id: 'bottom', label: 'Bottom plate', kind: 'text', suggest: 'builder.bottomPlate', required: true },
      { id: 'support', label: 'Check', kind: 'checks', options: ['Bottom plate fully supported'], requireAll: true },
      OTHER_SIZES('bottom plate'),
    ],
    ref: { source: 'Spec', section: 'III.5' },
    checkerFocus: true,
  },
  {
    id: 'js-heights',
    stage: 'job-setup',
    title: 'Wall heights',
    detail:
      'External walls use 2/90x35 top + ribbon plates. Internal walls are 25 mm lower using a 45 mm top plate (70 mm − 45 mm = 25 mm), so stud lengths and ceiling heights stay uniform.',
    widget: 'wall-heights',
    fields: [
      { id: 'external', label: 'External wall height', kind: 'number', unit: 'mm', required: true },
      { id: 'internal', label: 'Internal wall height', kind: 'number', unit: 'mm', required: true },
    ],
    ref: { source: 'Blueprint', section: '2.2.5' },
    checkerFocus: true,
  },
  {
    id: 'js-noggings',
    stage: 'job-setup',
    title: 'Noggings setup',
    detail:
      '- 90 mm wall frames: 70 mm noggings.\n- 70 mm wall frames: noggings on flat.\n' +
      '- 88 mm noggings are specially ordered for some builders so noggings are not "proud" of the studs.',
    fields: [{ id: 'size', label: 'Nogging', kind: 'text', suggest: 'builder.nogging', required: true }],
    builderNotes: {
      'add-style': '88 mm noggings throughout.',
      idyll: '88 mm noggings throughout.',
      betterbuilt: '70 mm noggings throughout.',
      ashmont: '90 mm frames: 70 mm noggings. 70 mm frames: noggings on flat.',
      transpire: '70 mm (70x35) noggings throughout.',
    },
    ref: { source: 'Spec', section: 'III.10.1' },
  },
  {
    id: 'js-nog-spacing',
    stage: 'job-setup',
    title: 'Nog height and spacing',
    detail: 'Usually half the wall frame height. 2450 → nog height 1220, centres 1200. 2600 and 2740 → nog height 1350, centres 1350.',
    widget: 'nog-height',
    fields: [
      { id: 'height', label: 'Nog height', kind: 'number', unit: 'mm', required: true },
      { id: 'centres', label: 'Nog centres', kind: 'number', unit: 'mm', required: true },
    ],
    ref: { source: 'Blueprint', section: '2.2.6' },
  },
  {
    id: 'js-other-setups',
    stage: 'job-setup',
    title: 'Special timber pieces',
    detail: 'If there are no special requirements, leave the settings at their defaults and tick each one. Write any special requirement in the note.',
    fields: [{ id: 'pieces', label: 'Checked', kind: 'checks', options: ['Over', 'Under', 'Sill', 'Block', 'Flat Block', 'Trimmer'], requireAll: true }],
    ref: { source: 'Blueprint', section: '2.2.7' },
  },

  // ───────────────────────── 3. Wall Input ─────────────────────────
  {
    id: 'wi-load-bearing',
    stage: 'wall-input',
    title: 'Input load-bearing and non-load-bearing walls',
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        options: ['Load-bearing walls set', 'Non-load-bearing walls set (truss bearing checked on truss layout)', 'Walls around stair void checked'],
      },
    ],
    ref: { source: 'Excel', section: '2. Panel input' },
  },
  {
    id: 'wi-engineering',
    stage: 'wall-input',
    title: 'Members follow the engineering plan',
    detail: 'Members noted on this job’s engineering drawings (LVL studs, beams, posts…) must be detailed exactly as specified. This applies to every builder.',
    fields: [
      {
        id: 'members',
        label: 'Members from the engineering plan',
        kind: 'rows',
        addLabel: 'Add member',
        columns: [
          { id: 'member', label: 'Member', kind: 'text', placeholder: 'e.g. LVL stud, beam B1, post P2', required: true },
          { id: 'size', label: 'Size & grade', kind: 'text', placeholder: 'e.g. 90x45 LVL13', required: true },
          { id: 'location', label: 'Location', kind: 'text', placeholder: 'e.g. E7 / Bed 2' },
        ],
      },
      { id: 'drawings', label: 'Screenshots of the engineering drawings (optional)', kind: 'photos' },
    ],
    tips: [{ job: '26-89', text: 'LVL studs on engineering drawings → detail as 90x45 WES DWE4T-D VL-LO (LVL13, not meyWALL).' }],
  },
  {
    id: 'wi-dimensions',
    stage: 'wall-input',
    title: 'Wall dimension check',
    detail: 'Check wall lengths and positions against the floor plan.',
    checkerFocus: true,
  },
  {
    id: 'wi-step-down',
    stage: 'wall-input',
    title: 'Step-down walls',
    appliesWhen: { conditions: ['stepDown'] },
    detail:
      '- Standard house: frame height = wall height + step-down depth (level offset).\n' +
      '- Split-level house: wall height stays the same; adjust the framing setup / elevation offset so the panel drops to the required level.\n' +
      '- Remember the step-down note and workline in Labels & Notes.',
    widget: 'step-down-height',
    fields: [
      {
        id: 'areas',
        label: 'Step-down areas',
        kind: 'rows',
        addLabel: 'Add area',
        required: true,
        columns: [
          { id: 'area', label: 'Area', kind: 'text', placeholder: 'e.g. Garage', required: true },
          { id: 'labels', label: 'Wall labels', kind: 'text', placeholder: 'e.g. E12, E13', required: true },
          { id: 'depth', label: 'Step-down depth', kind: 'number', unit: 'mm', required: true },
        ],
      },
    ],
    ref: { source: 'Blueprint', section: '4.1', images: ['/spec/step-down-note-1.png', '/spec/step-down-note-2.png', '/spec/step-down-note-3.png', '/spec/step-down-note-4.png'] },
    checkerFocus: true,
  },
  {
    id: 'wi-raked',
    stage: 'wall-input',
    title: 'Raked walls (cathedral ceiling)',
    appliesWhen: { conditions: ['raked'] },
    fields: [
      {
        id: 'scenarios',
        label: 'Scenarios',
        kind: 'checks',
        requireAll: true,
        options: [
          'Detailed as internal non-load-bearing frames',
          'Top of frame 25 mm below underside of rafter (continuous top plate for plasterboard)',
          'Ridge beam detailed as a 90 mm pocket',
          'Bracing on raked walls runs to the top plate',
          'Raked walls over 3450 mm high broken for transport',
        ],
      },
    ],
    ref: { source: 'Blueprint', section: '4.2.1' },
    tips: [
      { job: '26-175', text: 'Main Bedroom raked walls were 3690 high × 5000 wide. Break at the apex into 2 walls 2500 × 3690 and spin them sideways on the frame pack.' },
      { job: '26-175', text: 'Bay window side frames pitch from the Main Bed bulkhead wall to follow the rafter line. Bay window was 2585 high — should be 2555 to suit the underside of the rafters.' },
    ],
  },
  {
    id: 'wi-parapet',
    stage: 'wall-input',
    title: 'Parapet walls',
    appliesWhen: { conditions: ['parapet'] },
    fields: [
      {
        id: 'scenarios',
        label: 'Scenarios',
        kind: 'checks',
        requireAll: true,
        options: [
          'Parapet frames parallel to trusses (gable ends) run continuous from floor to top of parapet',
          'Parapet frame width kept to the main ceiling height (e.g. 2450)',
          'Frames split for transport (at opening edges, beam pockets, or in half)',
          'Split frames have a single 35 mm top plate + full-length ribbon plate supplied loose',
          'Truss restraint at ceiling level allowed for',
        ],
      },
    ],
    detail: 'Frames are split so the frame pack is never wider than the main wall height — no "Wide Load" transport needed.',
    ref: { source: 'Blueprint', section: '4.2.2' },
    tips: [{ job: '26-89', text: 'Parapet frames had not been detailed — no allowance was made.' }],
  },
  {
    id: 'wi-posts',
    stage: 'wall-input',
    title: 'Input posts',
    appliesWhen: { conditions: ['posts'] },
    detail: 'See the plan and detail examples in the Reference panel (click "See spec").',
    fields: [{ id: 'checks', label: 'Checked', kind: 'checks', options: ['Posts input (beam, line)', 'Walls covering posts illustrated'], requireAll: true }],
    ref: {
      source: 'Blueprint',
      section: '6',
      images: [
        '/spec/post-case-1-plan.png | Case 1 — Plan',
        '/spec/post-case-1-detail.png | Case 1 — Detail',
        '/spec/post-case-2-plan.png | Case 2 — Plan',
        '/spec/post-case-2-detail.png | Case 2 — Detail',
      ],
    },
    checkerFocus: true,
  },
  {
    id: 'wi-beams',
    stage: 'wall-input',
    title: 'Input beams and beam pockets',
    detail:
      'Beam capacity by Hyne Design / Autobeam.\n' +
      '- Beam pocket in the middle of a wall: keep the top plate above so the wall stays one piece; untick "Trim Beam Pockets". The carpenter cuts it on site.\n' +
      '- Beam at the end of a wall: remove the top plates above.',
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        options: ['Beam sizes from Hyne Design / Autobeam', BEAM_MID, BEAM_END],
      },
      {
        id: 'beams',
        label: 'Beam sizes',
        kind: 'rows',
        addLabel: 'Add beam',
        hint: 'Sizes calculated in Hyne Design / Autobeam, or given on the plans from the client.',
        columns: [
          { id: 'beam', label: 'Beam / location', kind: 'text', placeholder: 'e.g. B1 over garage door', required: true },
          { id: 'size', label: 'Size & grade', kind: 'text', placeholder: 'e.g. 2/240x45 LVL', required: true },
          { id: 'source', label: 'Source', kind: 'select', options: ['Hyne Design', 'Autobeam', 'Client plan'] },
        ],
      },
      {
        id: 'midPhotos',
        label: 'Mid-wall beam pockets — screenshots from the detail',
        kind: 'photos',
        showWhen: { field: 'checks', includes: BEAM_MID },
      },
      {
        id: 'endPositions',
        label: 'End-of-wall beam positions',
        kind: 'rows',
        addLabel: 'Add position',
        showWhen: { field: 'checks', includes: BEAM_END },
        columns: [
          { id: 'wall', label: 'Wall', kind: 'text', placeholder: 'e.g. E7', required: true },
          { id: 'position', label: 'Beam position', kind: 'text', placeholder: 'e.g. left end, 90 mm pocket', required: true },
        ],
      },
      {
        id: 'endPhotos',
        label: 'End-of-wall beam pockets — screenshots from the detail',
        kind: 'photos',
        showWhen: { field: 'checks', includes: BEAM_END },
      },
    ],
    ref: { source: 'Spec', section: 'III.3' },
    checkerFocus: true,
  },
  {
    id: 'wi-stairs',
    stage: 'wall-input',
    title: 'Wall frames at the stairs',
    appliesWhen: { conditions: ['stairs'] },
    detail:
      'Ground floor:\n- Allow wall frames with door openings below stair landings.\n- Include all critical studs supporting upper floor beams and point loads at the stairs.\n- Check the quote for loose framing to complete under-stair walls.\n- If no LVL beam crosses the wall, calculate the height from the stair geometry (frame height + floor system ÷ number of steps).\n' +
      'First floor:\n- Check if timber frames are required.\n- Glass handrail / balustrade → double stud for fixing.',
    fields: [{ id: 'height', label: 'Under-stair wall height', kind: 'number', unit: 'mm' }],
    ref: { source: 'Spec', section: 'III.11.3, III.18' },
  },
  {
    id: 'wi-bath',
    stage: 'wall-input',
    title: 'Bath frame',
    appliesWhen: { conditions: ['bath'] },
    detail: '- Supply wall frames to the bath area if required.\n- See plan details for height and bath opening size.\n- No allowance for a free-standing bath.',
    fields: [{ id: 'height', label: 'Bath frame height', kind: 'number', unit: 'mm' }],
    ref: { source: 'Spec', section: 'III.17' },
  },

  // ───────────────────────── 4. Elevations ─────────────────────────
  {
    id: 'el-setup',
    stage: 'elevations',
    title: 'Elevations set and named',
    detail: 'Usually 4 elevations. Use one naming style: North/South/East/West, Front/Rear/Far/Near, or Elevation 1, 2, 3…',
    checkerFocus: true,
    ref: { source: 'Blueprint', section: '8 (7.2 steps 1–2)' },
  },
  {
    id: 'el-front',
    stage: 'elevations',
    title: 'Front façade identified',
    // Only Ashmont has front-façade rules (#16).
    appliesWhen: { builders: ['ashmont'] },
    detail: 'The front façade faces the street on the site plan. Mark it in the elevation list above.',
    fields: [{ id: 'street', label: 'Street name', kind: 'text', placeholder: 'e.g. Bennet Road', required: true }],
    builderNotes: { ashmont: 'Openings on brick veneer walls of the front façade need floating studs and +130 mm width.' },
    ref: { source: 'Spec', section: 'IV.2.3' },
  },

  // ───────────────────────── 5. Wall Panels ─────────────────────────
  {
    id: 'wp-mapping',
    stage: 'wall-panels',
    title: 'Every wall panel assigned to an elevation',
    detail:
      'External panels (E…) go under their elevation. Internal panels (I…) go under "Internal". The table above warns about unassigned or duplicated walls.\n' +
      '- External walls start as load-bearing (LB ticked). Untick LB for an external non-load-bearing wall.\n' +
      '- Internal walls start as non-load-bearing, except the internal load-bearing walls listed in "Identify load-bearing walls".',
    ref: { source: 'Blueprint', section: '8 (7.2 step 3)' },
    checkerFocus: true,
  },
  {
    id: 'wp-finish',
    stage: 'wall-panels',
    title: 'Wall finish set for external walls',
    detail: 'Brick veneer or cladding. Used to convert plan dimensions to frame dimensions and for builder rules.',
  },
  {
    id: 'wp-limits',
    stage: 'wall-panels',
    title: 'Frame length and height within limits',
    detail: 'Enter length and height in the table to check them. Recommended max length 4.5 m; over 5950 mm exceeds the manufacturing limit; over 3450 mm high must be broken for transport.',
    ref: { source: 'Blueprint', section: '5' },
    checkerFocus: true,
  },

  // ───────────────────────── 6. Openings ─────────────────────────
  {
    id: 'op-ashmont-reminders',
    stage: 'openings',
    title: 'Ashmont opening reminders',
    appliesWhen: { builders: ['ashmont'] },
    showAbovePanel: true,
    detail:
      '- Front elevation brick veneer openings: floating studs included in frame (+130 mm width, note "+ infill").\n' +
      '- No allowance for stack frames inside the garage.',
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        requireAll: true,
        options: ['Floating studs included in frame', 'No allowance for stack frames inside garage'],
      },
    ],
    ref: { source: 'Spec', section: 'IV.2' },
  },
  {
    id: 'op-schedule',
    stage: 'openings',
    title: 'All openings entered from the window / door schedule',
    detail:
      'Each opening is entered under its wall, so it shows under the right elevation. Cabinet openings are entered the same way (type "Cabinet opening" on an internal wall).\n' +
      '- Compare external opening sizes with the window schedule from the client.',
    ref: { source: 'Blueprint', section: '9 (8.1)' },
    checkerFocus: true,
  },
  {
    id: 'op-head-height',
    stage: 'openings',
    title: 'Window head height (WHH) and door heights',
    showAbovePanel: true,
    checkerFocus: true,
    detail:
      'WHH usually lines up with the external door head height. It may vary between elevations, or a standard WHH may apply with exceptions. Check the elevation drawings, window/door schedule and plan notes.',
    fields: [
      { id: 'whh', label: 'Standard WHH / external door head', kind: 'number', unit: 'mm', suggest: 'builder.headExternal', required: true },
      { id: 'internal', label: 'Internal door head', kind: 'number', unit: 'mm', suggest: 'builder.headInternal' },
      { id: 'bic', label: 'BIC door head', kind: 'number', unit: 'mm', suggest: 'builder.headBic' },
    ],
    builderNotes: {
      'add-style': 'External door & window 2130 · internal door 2110 · BIC 2110 (to line up). Frame height 2450, eave overhang 450.',
      idyll: 'External door & window 2130 · internal door 2110 · BIC 2110 (to line up). Frame height 2450, eave overhang 450.',
      betterbuilt: 'Follow elevation drawings for header heights.',
      ashmont: 'Follow elevation drawings / design specifications.',
      transpire: 'Follow elevation drawings. 2100 mm high robes: trimmer / lintel at 2140 mm.',
    },
    ref: { source: 'Blueprint', section: '9 (8.2)' },
  },
  {
    id: 'op-compensation',
    stage: 'openings',
    title: 'Stud openings include the allowances',
    detail: 'The openings table adds the standard allowance for each opening type, then any builder override. Check every stud opening against the schedule.',
    ref: { source: 'Blueprint', section: '9 (8.3)' },
    tips: [{ job: '26-175', text: 'Cavity sliders: opening height should be 2150 mm (standard cavity slider spec).' }],
  },
  {
    id: 'op-position',
    stage: 'openings',
    title: 'Opening positions checked',
    detail:
      '- Centred on the wall → choose "Middle of wall".\n' +
      '- From a plan dimension → the table deducts the wall finish (brick veneer about 150–160 mm, cladding about 35 mm).\n' +
      '- Set Left / Right using the convention in the diagrams.',
    ref: { source: 'Blueprint', section: '9 (8.4)', images: ['/spec/opening-side-vertical.png', '/spec/opening-side-top.png', '/spec/opening-side-bottom.png'] },
    checkerFocus: true,
  },
  {
    id: 'op-studs',
    stage: 'openings',
    title: 'Opening studs',
    detail:
      'Each opening in the table shows the suggested jamb and prop studs.\n' +
      '- Opening with a lintel (external, load-bearing, or stud opening over 1800): jamb stud and prop stud 90x35.\n' +
      '- Internal opening up to 1800 in a non-load-bearing wall: no prop stud, 90x45 jamb stud each side.\n' +
      '- Door 90 mm from a wall corner → double jamb stud 90x45 on that side. Door 70 mm from a wall corner → double jamb stud 90x35.\n' +
      '- Near a junction, 2/35 mm studs may be used instead of a single 45 mm stud.',
    ref: { source: 'Blueprint', section: '9 (8.5)', images: ['/illustrations/opening-framing.svg | Opening framing'] },
    tips: [{ job: '26-89', text: 'Pantry door changed from 586 to 575 wide to allow a single 35 mm prop stud and 25 mm jamb stud each side. Prop and jamb studs are required.' }],
  },
  {
    id: 'op-trimmers',
    stage: 'openings',
    title: 'Trimmers',
    detail:
      '- External openings: 90x35 trimmer by default. Change it on the opening (e.g. 90x45, or no lintel).\n' +
      '- Load-bearing wall: minimum 35 mm member; size depends on head height and opening height.\n' +
      '- Internal non-load-bearing wall up to 1800 mm (stud opening): 90x45 trimmer, no lintel.\n' +
      '- Over 1800 mm: lintel design (ceiling load) + 90x35 trimmer.',
    ref: { source: 'Blueprint', section: '9 (8.6)' },
    tips: [{ job: '26-89', text: 'Powder room internal door needs a 90x30 trimmer — add a note for framers to install in the factory.' }],
  },
  {
    id: 'op-lintels',
    stage: 'openings',
    title: 'Lintels designed and deflection checked',
    detail:
      'Design with Hyne Design / Autobeam using roof loads (material, structure, pitch), ceiling loads, RLW, span, eave overhang, Dim A, Dim X and truss spacing. The openings table compares the long-term deflection with the span table.\n' +
      '- Largest pine lintel: 190x45 MGP10 (240 / 290 pine warps on site).\n' +
      '- 90x35 or 140x35 lintel → use 2 ply (2/90x35, 2/140x35).\n' +
      '- No suitable lintel (lintel too deep for the over above the opening) → jamb and prop studs as 2/LVL studs; the lintel may sit in the floor system.\n' +
      '- External opening under 1800 mm in an external non-load-bearing wall → no lintel needed.\n' +
      '- Deflection outside the table → consult the truss detailer, client or engineer.\n' +
      '- Solid timber beam above and no room for a lintel → trimmer + double top plates fixed to the underside of the beam.\n' +
      '- Large steel beam above → trimmer frame fixed above or below the steel.\n' +
      '- Posi-Strut floor → ask the Posi-Strut detailer to design a floor beam.',
    ref: { source: 'Spec', section: 'III.8' },
    checkerFocus: true,
    tips: [
      { job: '26-89', text: 'Kitchen window lintel was 2/130x65 GL15C — 1/190x45 MGP10 required.' },
      { job: '26-89', text: 'Lounge window: a lintel will not fit — a floor beam is required above. Add note "Floor Beam Supports Floor Loads above …".' },
      { job: '26-89', text: 'Internal garage 820 door had 2.1 mm deflection — use 2/120x35 MGP10 instead of 2/90x35.' },
    ],
  },
  {
    id: 'op-adjust',
    stage: 'openings',
    title: 'Opening fit adjustments',
    detail:
      'Choose the detailing method on each opening in the table — it reminds you which notes to add.\n' +
      '- Header raised 5 mm to tidy up the trimmer and overs → also raise the window opening height 5 mm; no header connect between lintel and trimmers.\n' +
      '- Cut in ribbon plate → notes "Cut in ribbon plate" and "+ Head Strap", plus the head strap workline.\n' +
      '- Cut in top plate → note "Cut in top plate".\n' +
      '- +30 / +25 / +20 trimmer.',
    ref: { source: 'Spec', section: 'III.14.3' },
    tips: [{ job: '26-175', text: 'Header raised 5 mm but window opening not raised — carpenters need the space to pack the trimmer/lintel to suit cladding.' }],
  },
  {
    id: 'op-corner',
    stage: 'openings',
    title: 'Corner doors and windows',
    detail: 'Minimum 300 mm lintel depth. Check notes "Lintel flush this side" and "Corner Window Lintel on Inside Extend … mm".',
    builderNotes: { 'add-style': 'Check the windows schedule.', idyll: 'Check the windows schedule.' },
    ref: { source: 'Excel', section: '3. Opening input' },
  },
  {
    id: 'op-nibs',
    stage: 'openings',
    title: 'Nibs and door clearance from corners',
    appliesWhen: { builders: [...ADD_STYLE_LIKE, 'betterbuilt'] },
    detail: 'Internal door openings 90 mm from wall corners where there is room. Door & window nibs 90 mm minimum unless the plan says otherwise.',
    ref: { source: 'Blueprint', section: '9 (8.3) — builder table' },
    tips: [
      { job: '26-175', text: 'D1 should be 90 mm from wall I2 — it was detailed at 110 mm.' },
      { job: '26-175', text: 'D2, D6, D8 are centred — this is correct.' },
    ],
  },
  {
    id: 'op-floating',
    stage: 'openings',
    title: 'Floating studs on front-façade brick veneer',
    appliesWhen: { builders: ['ashmont'] },
    detail:
      'Openings on brick veneer walls of the front façade (street side; may also apply to the street side of corner blocks): width +130 mm (60 mm clearance + 70 mm for a floating stud each side), floating studs included in frame. Add note "+ infill".\n' +
      'In the openings table these openings show "Front elevation brick veneer" ticked. Untick it, or tick it on another external opening, when the plan says so.\n' +
      'Front entry door: always request the door or stud opening size. If the client is undecided between timber and aluminium, increase the opening and add floating studs.',
    ref: { source: 'Spec', section: 'IV.2.2–2.3' },
    tips: [{ job: '26-89', text: 'Road-facing brick veneer opening W17: +130 mm is correct for Ashmont (60 clearance + 70 floating studs).' }],
  },
  {
    id: 'op-clad-windows',
    stage: 'openings',
    title: 'Clad-wall windows 80 mm below eaves',
    appliesWhen: { builders: ['betterbuilt'] },
    ref: { source: 'Spec', section: 'IV.3.7' },
  },
  {
    id: 'op-transpire',
    stage: 'openings',
    title: 'Transpire opening requirements',
    appliesWhen: { builders: ['transpire'] },
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        requireAll: true,
        options: [
          'Sills minimum 90x35 MGP10, unders 90x35 MGP10',
          'Robe heads fully framed; 2100 robes → trimmer / lintel at 2140',
          'Double studs at door openings next to internal corners',
          'Kitchen window sill: 890 mm stud opening floor to top of sill (optional +35 mm above via loose trimmer)',
          'Kitchen window over bench not nominated → checked with Transpire and kitchen elevations',
          'Front door size taken from the Transpire purchase order',
          'Window schedule signed off before manufacture',
        ],
      },
    ],
    ref: { source: 'Spec', section: 'IV.4.5, IV.4.8' },
  },
  {
    id: 'op-notes',
    stage: 'openings',
    title: 'Opening notes added',
    ref: { source: 'Excel', section: '3. Opening input' },
  },

  // ───────────────────────── 7. Wall Adjustment ─────────────────────────
  {
    id: 'wa-break',
    stage: 'wall-adjustment',
    title: 'Break walls',
    detail:
      '- Recommended maximum frame length 4.5 m. Never over 5950 mm (manufacturing limit 6000 mm) — break at junctions.\n' +
      '- Frames over 3450 mm high: break lengths to suit transport — at junctions, beside openings or at midpoints. Max height 6 m unless engineered.\n' +
      '- Whole job over 3450 mm high: place breaks to suit bracing, junctions and transport. Choose a base frame (max 3.3–3.4 m wide) and stack the rest progressively smaller.\n' +
      '- Junction breaks: Mid Junction Break by default. If it conflicts with openings, jamb studs or point loads, use Side Junction Break or Break at Length.',
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        options: ['Walls over 4.5 m reviewed for a break', 'No wall longer than 5950 mm', 'Walls over 3450 mm high broken for transport'],
      },
    ],
    builderNotes: { ashmont: 'Always use Side Junction Breaks (not mid-junction). Ashmont is the only builder with this rule.' },
    ref: { source: 'Blueprint', section: '5' },
    tips: [
      { job: '26-89', text: 'E11 was over 6000 mm long — it should be broken at a junction.' },
      { job: '26-175', text: 'Walls broken beside some openings to increase brace length.' },
    ],
  },
  {
    id: 'wa-bulkhead',
    stage: 'wall-adjustment',
    title: 'Bulkheads',
    detail: 'Bulkhead depth → member: 150 → 150x45 LVL · 200 / 240 / 300 → HyJoist · other sizes → detail as a wall frame (70x35 MGP10 top and bottom plates, studs at 600 centres).',
    widget: 'bulkhead-timber',
    builderNotes: { ashmont: 'No bulkhead material — not required or supplied for Ashmont Homes.' },
    ref: { source: 'Spec', section: 'III.15' },
    tips: [{ job: '26-175', text: 'Bed 2–3 robes under a 240 mm bulkhead: opening height should be 2510 (2750 − 240), it was 2485.' }],
  },
  {
    id: 'wa-tie-down-bolts',
    stage: 'wall-adjustment',
    title: 'Tie-down bolts (add text "x")',
    builderNotes: { transpire: 'Tie-down bolts required where needed and nominated on the frame layout.' },
    ref: { source: 'Excel', section: '4. Wall adjustment' },
  },
  {
    id: 'wa-extra-nogs',
    stage: 'wall-adjustment',
    title: 'Extra noggings (Betterbuilt)',
    appliesWhen: { builders: ['betterbuilt'] },
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        options: ['Architrave nogs: 90x45 MGP10 at floor steps', 'Vanity nogs: 2×90 at 735 mm high, on edge, flush to the vanity side', 'Step-down nogs'],
      },
    ],
    ref: { source: 'Spec', section: 'IV.3.5.2' },
    checkerFocus: true,
  },
  {
    id: 'wa-shower',
    stage: 'wall-adjustment',
    title: 'Shower and bath: noggings and studs',
    appliesWhen: { conditions: ['shower', 'bath'] },
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        options: ['Double stud centred to shower screen', 'Noggings at 600 and 1800 to shower tray area (straight line)', 'Critical stud in shower area'],
      },
    ],
    ref: { source: 'Spec', section: 'III.17' },
    checkerFocus: true,
    tips: [{ job: '26-89', text: 'Bath nib wall was missing shower noggings.' }],
  },
  {
    id: 'wa-niche',
    stage: 'wall-adjustment',
    title: 'Niche: critical stud in the rear wall',
    appliesWhen: { conditions: ['niche'] },
    detail: 'Add a critical stud in the rear wall of every niche to allow sheet fixing inside the niche.',
    ref: { source: 'Spec', section: 'III.17' },
  },
  {
    id: 'wa-critical-capacity',
    stage: 'wall-adjustment',
    title: 'Critical stud capacity calculated',
    detail:
      'Wall frames that carry a girder load need critical studs, designed in Autobeam. Enter every area — a job often has several girders.\n' +
      '- Check both levels: the critical stud must sit under the girder on the upper floor and continue on the floor below.',
    widget: 'girder-openings',
    fields: [
      {
        id: 'areas',
        label: 'Critical stud areas',
        kind: 'rows',
        addLabel: 'Add area',
        columns: [
          { id: 'area', label: 'Area', kind: 'text', placeholder: 'e.g. Bed 2, Ensuite', required: true },
          { id: 'level', label: 'Level', kind: 'select', options: ['Ground floor', 'First floor', 'Single storey'] },
          { id: 'girder', label: 'Girder / load', kind: 'text', placeholder: 'e.g. G1 girder truss' },
          { id: 'size', label: 'Critical stud size', kind: 'text', placeholder: 'e.g. 3/90x35 MGP10', required: true },
          { id: 'deflection', label: 'Deflection', kind: 'number', unit: 'mm', required: true },
        ],
      },
    ],
    builderNotes: { transpire: 'Minimum 2/90x35 MGP12 studs under critical loads.' },
    ref: { source: 'Excel', section: '4. Wall adjustment' },
    checkerFocus: true,
  },
  {
    id: 'wa-critical',
    stage: 'wall-adjustment',
    title: 'Critical studs placed',
    fields: [
      { id: 'checks', label: 'Checked', kind: 'checks', options: ['Girder supports', 'Beam supports', 'Steel post supports', 'Stair wall frame supports', 'Shower areas'] },
    ],
    ref: { source: 'Excel', section: '4. Wall adjustment' },
    checkerFocus: true,
  },
  {
    id: 'wa-ashmont',
    stage: 'wall-adjustment',
    title: 'Ashmont framing exceptions',
    appliesWhen: { builders: ['ashmont'] },
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        requireAll: true,
        options: ['No stack frames inside the garage', 'No vanity noggings', '70 mm internal walls: all members 70x35'],
      },
    ],
    ref: { source: 'Spec', section: 'IV.2' },
  },

  // ───────────────────────── 8. Elevation Check ─────────────────────────
  {
    id: 'ec-dimensions',
    stage: 'elevation-check',
    title: 'Extra dimensions on elevations',
    detail: 'For beams, extra studs, critical studs…',
    ref: { source: 'Excel', section: '5. Elevation check' },
  },
  {
    id: 'ec-opening-studs',
    stage: 'elevation-check',
    title: 'Opening studs on elevations (jamb, prop)',
    ref: { source: 'Excel', section: '5. Elevation check' },
  },
  {
    id: 'ec-extra-studs',
    stage: 'elevation-check',
    title: 'Extra studs (openings, beam pockets)',
    ref: { source: 'Excel', section: '5. Elevation check' },
  },
  {
    id: 'ec-extra-nogs',
    stage: 'elevation-check',
    title: 'Extra noggings input on elevations',
    appliesWhen: { builders: ['betterbuilt'] },
    detail: 'Vanity noggings, step-down noggings, architrave noggings.',
    ref: { source: 'Excel', section: '5. Elevation check' },
  },
  {
    id: 'ec-bracing-capacity',
    stage: 'elevation-check',
    title: 'Bracing capacity',
    detail:
      '- Standard shapes (square, rectangle): design with Hyne Design.\n- Complex layouts (L / U / C shaped or split-level): AS1684.2-2021 bracing calculations.',
    widget: 'bracing-capacity',
    fields: [
      { id: 'aDesigned', label: 'Direction A — designed (required)', kind: 'number', unit: 'kN', required: true },
      { id: 'aDetailed', label: 'Direction A — detailed', kind: 'number', unit: 'kN', required: true },
      { id: 'bDesigned', label: 'Direction B — designed (required)', kind: 'number', unit: 'kN', required: true },
      { id: 'bDetailed', label: 'Direction B — detailed', kind: 'number', unit: 'kN', required: true },
      {
        id: 'screenshots',
        label: 'Bracing calculation screenshots',
        kind: 'photos',
        hint: 'Paste a screenshot (Ctrl+V), drop it here, or choose a file from the bracing app.',
      },
    ],
    ref: { source: 'Blueprint', section: '10' },
  },
  {
    id: 'ec-bracing',
    stage: 'elevation-check',
    title: 'Bracing types and angles',
    detail:
      '- Load-bearing walls: 1.5 kN cross strap, 3.0 kN cross strap, ply brace sheeting.\n' +
      '- Non-load-bearing walls: 0.8 kN galv. metal angle, 1.5 kN cross strap, ply brace sheeting.\n' +
      '- Use 3.0 kN cross bracing or ply where extra capacity is required; narrow strap or ply for narrow panels.\n' +
      '- Angle 45–60°. Posi-Brace and MeyBRACE only with client / engineer approval.\n' +
      '- Cladding walls (not brick veneer): add an extra sheet.\n' +
      '- Where ply bracing is used along a wall, do not also use cross bracing there.',
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        options: ['Bracing angle 45–60°', 'No cut-in angle braces on load-bearing walls', 'Extra sheet on cladding walls', 'No cross brace where ply is used on the same wall'],
      },
    ],
    ref: { source: 'Blueprint', section: '10' },
    tips: [
      { job: '26-89', text: 'No cut-in angle braces to load-bearing wall frames — always use a cross brace.' },
      { job: '26-175', text: 'Add a note to all braces in shower areas that they are on the outside of the shower.' },
    ],
  },
  {
    id: 'ec-stud-ties',
    stage: 'elevation-check',
    title: 'Stud ties and stud screws',
    detail:
      '- Stud ties are designed for both bracing and tie-down. Apply stud ties to 3.0 kN cross bracing (AS1684.2-2021 Section 9). Tie-down over capacity → consult client and engineer.\n' +
      '- Internal load-bearing walls: screws only on bracing walls (to assist cross bracing).\n' +
      '- Ground floor walls supporting upper floor / walls: no screws for tie-down / uplift.\n' +
      '- Ground floor frames supporting roof trusses directly: screws required (tie-down / uplift calculation).\n' +
      '- Studs at 450cc or less resist the uplift — no stud screw needed.\n' +
      '- Lintel with no top / ribbon plate above: no screw.',
    widget: 'tie-down',
    fields: [
      { id: 'checks', label: 'Checked', kind: 'checks', options: ['Correct stud tie spacing', 'Cross bracing 3.0 kN has stud ties', 'Opening stud screws checked'] },
    ],
    ref: { source: 'Blueprint', section: '12' },
    tips: [
      { job: '26-175', text: 'Hip and gable ends only need stud screws at 1800–2400cc. Large spans can be 1200–1350cc to work with the top plate design.' },
      { job: '26-89', text: 'W4, W11, W12 had screws above lintels with cut-out top and ribbon plates — not required.' },
    ],
  },
  {
    id: 'ec-extra-notes',
    stage: 'elevation-check',
    title: 'Extra notes on elevations',
    detail: '"+ Head Straps": needed when a lintel supports roof trusses / rafters directly with no top plate or ribbon plate above. If a screw is not enough for uplift, use a tie-down strap, then a tie-down rod; beyond that needs engineering.',
    widget: 'opening-notes',
    fields: [{ id: 'notes', label: 'Notes used', kind: 'checks', options: ['Cut in top plate', 'Cut in ribbon plate', '+ infill', '+ packer', 'Steel post', '+ Head Straps', 'Head strap workline'] }],
    ref: { source: 'Excel', section: '5. Elevation check' },
    tips: [{ job: '26-89', text: 'Bed 5 opening has a cut-in ribbon plate → needs "+ Head Straps" and "Cut in Ribbon Plate + Packer + Infills".' }],
  },

  // ───────────────────────── 9. Labels & Notes ─────────────────────────
  {
    id: 'ln-address',
    stage: 'labels-notes',
    title: 'Address and job no on the frame layout',
    detail: 'Line 1: Job No and floor. Then builder, then Lot + No + Street, then Suburb. No state, postcode or DP number (all jobs are in NSW).',
    widget: 'address-preview',
    ref: { source: 'Blueprint', section: '13' },
    checkerFocus: true,
    tips: [{ job: '26-89', text: 'Job address was incorrect ("Petter" instead of "Peter"; DP 1313734 not required).' }],
  },
  {
    id: 'ln-house-type',
    stage: 'labels-notes',
    title: 'House type name on the layout',
    detail: 'Single Storey, Ground Floor, First Floor, Studio, Granny Flat…',
    ref: { source: 'Excel', section: '6. Final checking' },
  },
  {
    id: 'ln-panel-numbers',
    stage: 'labels-notes',
    title: 'Renumber panels',
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        requireAll: true,
        options: [
          'External: start at the bottom-left corner',
          'External: anticlockwise, first panel E1, last panel returns close to E1',
          'Internal: start bottom-left / left side, longest wall first, then room-dividing walls',
          'Consecutive numbering',
        ],
      },
    ],
    ref: { source: 'Blueprint', section: '13' },
  },
  {
    id: 'ln-junctions',
    stage: 'labels-notes',
    title: 'Junction labels',
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        requireAll: true,
        options: [
          'Junction Label → Reset Numbering after all frames are complete',
          'Numbers run anticlockwise starting at (1)',
          'Sequence verified after reset',
          'Junction labels opposite the cross-bracing labels',
        ],
      },
    ],
    ref: { source: 'Blueprint', section: '13' },
  },
  {
    id: 'ln-openings',
    stage: 'labels-notes',
    title: 'Renumber openings',
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        requireAll: true,
        options: [
          'Standard MiTek 20/20 opening labels kept',
          'Opening numbering reset to align with panels (E1 → W1 / D1)',
          'Internal doors labelled D1, D2, D3… (no "720", "BIC", "LINEN" or room names)',
        ],
      },
    ],
    ref: { source: 'Blueprint', section: '13' },
  },
  {
    id: 'ln-labels',
    stage: 'labels-notes',
    title: 'Bracing and panel labels',
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        requireAll: true,
        options: [
          'Cross bracing labels to inside face; ply bracing labels to outside face',
          'Double cross bracing labels stacked over each other',
          'External panel labels outside the frame; internal on the right-hand side or above',
          'Bracing labels opposite the panel label (flip if clashing)',
          'Sheet and strip bracing labels checked',
        ],
      },
    ],
    ref: { source: 'Blueprint', section: '13' },
  },
  {
    id: 'ln-step-down',
    stage: 'labels-notes',
    title: 'Step-down note and workline',
    appliesWhen: { conditions: ['stepDown'] },
    fields: [
      {
        id: 'checks',
        label: 'Checked',
        kind: 'checks',
        requireAll: true,
        options: [
          'Step-down note added (depth and frame height)',
          'Worklines only along the internal edges of the garage (not the front of the house)',
          'Workline parallel to the wall, thickness 2, 30 mm from the wall frame',
          'Colours: garage step Blue, then Orange, Purple, Red',
        ],
      },
    ],
    ref: { source: 'Blueprint', section: '4.1.3, 13', images: ['/spec/step-down-note-1.png', '/spec/step-down-note-2.png'] },
  },
  {
    id: 'ln-garage-brick',
    stage: 'labels-notes',
    title: 'Garage brick workline (230 mm brickwork)',
    appliesWhen: { conditions: ['garage'] },
    detail:
      'Draw perimeter worklines to suit the overall wall sizes. Draw one 45° line from the top right of the worklines, copy it 50 mm below, then copy both 300 mm below. This gives parallel lines 50 mm apart at 300cc — full brick, not wall frames.',
    ref: { source: 'Blueprint', section: '13' },
  },
  {
    id: 'ln-nogging-note',
    stage: 'labels-notes',
    title: 'Nogging note (70 mm or 88 mm noggings throughout)',
    detail: 'For meyWALL LVL jobs, add a note on the factory copy of the frame layout: meyWALL LVL frames and the nogging sizes. The factory sees this first when they collect the job.',
    ref: { source: 'Spec', section: 'III.10.2' },
  },
  {
    id: 'ln-other-notes',
    stage: 'labels-notes',
    title: 'Other layout notes',
    fields: [
      {
        id: 'checks',
        label: 'Added',
        kind: 'checks',
        options: ['Beam lines / notes', 'Shower work line', 'Tie-down note', 'Additional ply brace sheets note', 'Job information note', 'AS1684.2:2021 note'],
      },
    ],
    ref: { source: 'Excel', section: '2.1 Layout note, 6. Final checking' },
  },
  {
    id: 'ln-garage-step',
    stage: 'labels-notes',
    title: 'Garage step location confirmed before manufacture',
    appliesWhen: { builders: ['transpire'] },
    ref: { source: 'Spec', section: 'IV.4.7' },
  },
  {
    id: 'ln-finish',
    stage: 'labels-notes',
    title: 'Resequence and turn off stud view',
    fields: [{ id: 'checks', label: 'Done', kind: 'checks', options: ['Resequence', 'Turn off stud view'], requireAll: true }],
    ref: { source: 'Excel', section: '6. Final checking' },
  },
];

const ADD_STYLE_FRAMING = {
  stud: '90x35 MGP10 min (or to AS1684)',
  lbTopPlate: '2/90x35 MGP10 min (or to AS1684)',
  nlbTopPlate: '90x45 MGP10 min (or to AS1684)',
  bottomPlate: '90x45 MGP10',
  nogging: '88 mm noggings throughout',
};

const ADD_STYLE_NOTES = [
  '88 mm noggings throughout',
  'Internal door openings 90 mm from wall corners',
  'Door & window nibs 90 mm minimum',
  'Header heights: external 2130, internal 2110, BIC 2110',
];

const builders: Builder[] = [
  {
    id: 'add-style',
    name: 'Add Style / Your Storey Home Additions',
    shortName: 'Add Style',
    logo: '/logos/add-style.png',
    active: true,
    framing: ADD_STYLE_FRAMING,
    headHeights: { external: 2130, internal: 2110, bic: 2110 },
    openingOverrides: [],
    notes: ADD_STYLE_NOTES,
    internalDoorCornerGap: 90,
  },
  {
    id: 'betterbuilt',
    name: 'Betterbuilt Homes',
    shortName: 'Betterbuilt',
    logo: '/logos/betterbuilt.png',
    active: true,
    framing: {
      stud: '90x35 MGP10 min (or to AS1684)',
      lbTopPlate: '2/90x35 meyWALL LVL min',
      nlbTopPlate: '90x45 MGP10 min (or to AS1684)',
      bottomPlate: '90x35 MGP10',
      nogging: '70 mm noggings throughout',
    },
    openingOverrides: [],
    notes: ['70 mm noggings throughout', 'Internal door openings 90 mm from wall corners', 'Clad-wall windows 80 mm below eaves', 'Extra nogs: architrave + vanity'],
    internalDoorCornerGap: 90,
  },
  {
    id: 'transpire',
    name: 'Transpire Constructions',
    shortName: 'Transpire',
    logo: '/logos/transpire.png',
    active: true,
    framing: {
      stud: '90x35 MGP12 @ 600cc (load-bearing) · 90x35 MGP10 (internal non-load-bearing FF)',
      lbTopPlate: '2/90x35 MGP10',
      nlbTopPlate: '90x45 MGP10',
      bottomPlate: '90x35 MGP10',
      nogging: '70x35 noggings throughout',
    },
    openingOverrides: [],
    notes: ['70 mm noggings throughout', 'Min 2/90x35 MGP12 under critical loads', 'Window schedule signed off before manufacture', 'Tie-down bolts nominated on layout'],
  },
  {
    id: 'idyll',
    name: 'Idyll House',
    shortName: 'Idyll',
    logo: '/logos/idyll.png',
    active: true,
    framing: ADD_STYLE_FRAMING,
    headHeights: { external: 2130, internal: 2110, bic: 2110 },
    openingOverrides: [],
    notes: ADD_STYLE_NOTES,
    internalDoorCornerGap: 90,
  },
  {
    id: 'ashmont',
    name: 'Ashmont Homes',
    shortName: 'Ashmont',
    logo: '/logos/ashmont.png',
    active: true,
    usesFrontFacade: true,
    framing: {
      stud: '90x35 meyWALL Red LVL min',
      lbTopPlate: '2/90x35 meyWALL Red LVL min',
      nlbTopPlate: '90x45 meyWALL Red LVL min',
      bottomPlate: 'meyWALL Red LVL min',
      nogging: '90 mm frames: 70 mm noggings · 70 mm frames: noggings on flat',
    },
    openingOverrides: [
      {
        appliesTo: ['window-alu', 'window-timber', 'ext-door-alu', 'ext-door-timber'],
        heightAllowance: 80,
        reason: 'Ashmont: height +80 overall (60 reveals/clearance + 20 additional)',
      },
      {
        appliesTo: ['window-alu', 'window-timber', 'ext-door-alu', 'ext-door-timber'],
        widthAllowance: 130,
        frontFacadeBrickVeneerOnly: true,
        reason: 'Ashmont: width +130 on front-façade brick veneer (60 clearance + 70 floating studs)',
      },
    ],
    notes: ['Side junction breaks (not mid-junction)', 'No bulkhead material supplied', 'Floating studs on front-façade brick veneer', 'No stack frames in garage · no vanity nogs'],
  },
];

export const defaultContent: ChecklistContent = {
  version: 2,
  updatedAt: '2026-11-14T00:00:00.000Z',
  stages,
  items,
  builders,
  allowances: {
    'internal-door': { label: 'Internal passage door', width: 60, height: 70, note: 'Example: 2040x820 → 2110x880 stud opening' },
    'cavity-slider': { label: 'Cavity sliding door', width: 60, height: 110, doubleWidth: true, note: '(Door width × 2) + 60. Check cavity door system requirements.' },
    'smart-robe': { label: 'Smart robe', width: 15, height: 15, note: 'Refer to supplier brochure' },
    cabinet: { label: 'Cabinet opening', width: 0, height: 0, note: 'No standard allowance yet — check the cabinet / kitchen drawings' },
    'window-alu': { label: 'Window (aluminium)', width: 60, height: 60, note: 'Use manufacturer schedule' },
    'window-timber': { label: 'Window (timber)', width: 10, height: 10, note: 'Use manufacturer schedule' },
    'ext-door-alu': { label: 'External door (aluminium)', width: 60, height: 30, note: 'Check window supplier specs for the height allowance' },
    'ext-door-timber': { label: 'External door (timber)', width: 10, height: 10, note: 'Check window supplier specs for the height allowance' },
    other: { label: 'Other', width: 0, height: 0, note: 'No standard allowance — check the schedule' },
  },
  lintelTable: [
    { minWidth: 600, maxWidth: 1000, minDeflection: 1.0, maxDeflection: 1.5 },
    { minWidth: 1100, maxWidth: 1500, minDeflection: 1.5, maxDeflection: 1.8 },
    { minWidth: 1600, maxWidth: 2000, minDeflection: 1.5, maxDeflection: 2.2 },
    { minWidth: 2100, maxWidth: 2500, minDeflection: 2.0, maxDeflection: 2.5 },
    { minWidth: 2600, maxWidth: 3000, minDeflection: 2.5, maxDeflection: 3.0 },
    { minWidth: 3000, maxWidth: 3500, minDeflection: 3.0, maxDeflection: 4.0 },
    { minWidth: 3600, maxWidth: 4200, minDeflection: 3.5, maxDeflection: 4.5 },
    { minWidth: 4300, maxWidth: 6000, minDeflection: 4.0, maxDeflection: 6.0 },
  ],
  nogTable: DEFAULT_NOG_TABLE,
  openingFraming: DEFAULT_OPENING_FRAMING,
};
