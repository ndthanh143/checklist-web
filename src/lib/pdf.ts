import type { Column, Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ChecklistContent, ChecklistItem, FieldDef } from '../content/types';
import { CONDITION_KEYS, CONDITION_LABELS, FLOOR_LABELS, HOUSE_TYPE_LABELS } from '../content/types';
import type { FieldValue, JobData, Opening, Photo, ReviewEntry } from '../job/types';
import { STATUS_LABELS } from '../job/types';
import { addressLabel, planToFrameDimension, num } from './calc';
import { focusPointsFor } from './focus';
import { METHOD_INFO } from './openings';
import { getBuilder, isFieldVisible, itemState, listValue, loadBearingIssues, openingCalc, rowsValue, usesFrontFacade, visibleItems, wallIssues, type OpeningCalc } from './rules';

export type PdfMode = 'draft' | 'final';

const C = {
  blue: '#0033A0',
  red: '#790000',
  charcoal: '#232323',
  grey: '#F3F5F7',
  line: '#D5DAE1',
  muted: '#5B6470',
  ok: '#21865B',
  warn: '#B87100',
  block: '#C43D3D',
};

/** Roboto has no arrow or check-mark glyphs — replace them with plain text. */
export function pdfText(s: string): string {
  return s
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/[✓✔]/g, '[x]')
    .replace(/⚠/g, '!')
    .replace(/⛔/g, 'X');
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fieldText(f: FieldDef, v: FieldValue | undefined): string | null {
  if (f.kind === 'checks') {
    const ticked = listValue(v);
    return (f.options ?? []).map((o) => `${ticked.includes(o) ? '[x]' : '[  ]'} ${o}`).join('\n');
  }
  if (f.kind === 'rows') {
    const rows = rowsValue(v);
    if (rows.length === 0) return null;
    const cols = f.columns ?? [];
    const lines = rows.map(
      (r) =>
        '- ' +
        cols
          .filter((c) => (r[c.id] ?? '').trim())
          .map((c) => `${c.label}: ${r[c.id]}${c.unit ? ` ${c.unit}` : ''}`)
          .join(' · '),
    );
    return `${f.label}:\n${lines.join('\n')}`;
  }
  if (f.kind === 'photos') {
    const n = listValue(v).length;
    return n ? `${f.label}: ${n} picture${n > 1 ? 's' : ''} (see appendix)` : null;
  }
  if (v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  return `${f.label}: ${Array.isArray(v) ? listValue(v).join(', ') : v}${f.unit ? ` ${f.unit}` : ''}`;
}

/** Lintel, trimmer, studs, girder and detailing methods of one opening. */
function framingText(o: Opening, calc: OpeningCalc): string {
  const f = calc.framing;
  const lines: string[] = [];
  if (f?.lintel === 'none') lines.push('No lintel');
  else if (f?.lintel === 'floor-system') lines.push('No suitable lintel — floor system');
  if (o.hyneTimber) lines.push(`Hyne: ${o.hyneTimber}${o.hyneDeflection ? ` (${o.hyneDeflection} mm)` : ''}`);
  if (o.autobeamTimber) lines.push(`Autobeam: ${o.autobeamTimber}${o.autobeamDeflection ? ` (${o.autobeamDeflection} mm)` : ''}`);
  if (calc.lintelNeeded && !o.hyneTimber && !o.autobeamTimber) lines.push('Lintel: needed');
  if (calc.trimmer) lines.push(`Trimmer: ${calc.trimmer}${o.methods.includes('trimmer-plus') && o.trimmerPlus ? ` ${o.trimmerPlus}` : ''}`);
  if (f) lines.push(`Jamb: ${f.jamb}${f.jambCorner ? ` (corner ${f.jambCorner})` : ''} · Prop: ${f.prop ?? 'none'}`);
  if (o.underGirder) lines.push(`Under girder — critical stud ${o.criticalStud || '?'} (${o.criticalDeflection || '?'} mm)`);
  if (calc.frontBrickVeneer) lines.push('Front elevation brick veneer (+130, floating studs)');
  const methods = o.methods.filter((m) => m !== 'trimmer-plus').map((m) => METHOD_INFO[m].label);
  if (methods.length) lines.push(`Method: ${methods.join(', ')}`);
  if (o.note) lines.push(`Note: ${o.note}`);
  return lines.join('\n');
}

function statusColor(status: string): string {
  if (status === 'done') return C.ok;
  if (status === 'na') return C.muted;
  if (status === 'confirm') return C.warn;
  if (status === 'blocked') return C.block;
  return C.charcoal;
}

function entryLines(entries: ReviewEntry[]): Content[] {
  return entries.map((e) => ({
    margin: [0, 3, 0, 0],
    text: [
      { text: `${e.kind === 'flag' ? 'FLAG' : 'Comment'} (${e.round === 3 ? '3rd' : '2nd'} check, ${e.author}${e.resolved && e.kind === 'flag' ? ', resolved' : e.kind === 'flag' ? ', OPEN' : ''}): `, bold: true, color: e.kind === 'flag' && !e.resolved ? C.block : C.blue },
      { text: pdfText(e.text) },
      ...(e.response ? [{ text: `\nDetailer: ${pdfText(e.response)}`, italics: true, color: C.muted }] : []),
      ...(e.photoIds.length ? [{ text: `  (${e.photoIds.length} photo${e.photoIds.length > 1 ? 's' : ''} — see appendix)`, color: C.muted }] : []),
    ],
  }));
}

function itemRow(item: ChecklistItem, data: JobData, builderId: string, mode: PdfMode, index: string): TableCell[] {
  const st = itemState(data, item.id);
  const values = (item.fields ?? [])
    .filter((f) => isFieldVisible(f, st))
    .map((f) => fieldText(f, st.values[f.id]))
    .filter((x): x is string => !!x);
  const note = item.builderNotes?.[builderId];
  const entries = data.review.entries.filter((e) => e.itemId === item.id);
  const cells: TableCell[] = [
    { text: index, color: C.muted },
    {
      stack: [
        { text: pdfText(item.title), bold: true },
        ...(note ? [{ text: pdfText(`Builder rule: ${note}`), italics: true, color: C.red, fontSize: 7.5, margin: [0, 2, 0, 0] } as Content] : []),
        ...entryLines(entries),
      ],
    },
    { text: STATUS_LABELS[st.status], color: statusColor(st.status), bold: st.status !== 'not-started' },
    { text: pdfText(values.join('\n')), fontSize: 7.5 },
    { text: pdfText(st.note), fontSize: 7.5 },
  ];
  if (mode === 'draft') cells.push({ text: '' });
  return cells;
}

export interface PdfLogos {
  mitek?: string;
  lawmans?: string;
}

/** MiTek first, then Lawmans — same height so the two partners read as equals. */
function logoRow(logos: PdfLogos): Column {
  const cell = (src: string | undefined, fallback: string, color: string): Content =>
    src ? { image: src, fit: [130, 30] } : { text: fallback, bold: true, color, fontSize: 12, margin: [0, 8, 0, 0] };
  return {
    width: 300,
    columns: [cell(logos.mitek, 'MiTek', C.blue), cell(logos.lawmans, 'LAWMANS FRAME & TRUSS', C.red)],
    columnGap: 14,
  };
}

export function buildDocDefinition(content: ChecklistContent, data: JobData, photos: Photo[], mode: PdfMode, logos: PdfLogos = {}): TDocumentDefinitions {
  const builder = getBuilder(content, data.job.builderId);
  const floor = FLOOR_LABELS[data.job.floor];
  const yesConditions = CONDITION_KEYS.filter((k) => data.job.conditions[k]).map((k) => CONDITION_LABELS[k]);
  const body: Content[] = [];

  // Header block
  body.push({
    columns: [
      logoRow(logos),
      {
        stack: [
          { text: mode === 'draft' ? 'Checklist — DRAFT for review' : 'Checklist — Final report', fontSize: 15, bold: true, color: C.blue, alignment: 'right' },
          { text: 'MiTek 20/20 wall frame detailing', color: C.muted, alignment: 'right' },
        ],
      },
    ],
    margin: [0, 0, 0, 12],
  });

  body.push({
    table: {
      widths: [90, '*', 90, '*'],
      body: [
        [{ text: 'Job No', bold: true }, data.job.jobNo || '—', { text: 'Builder', bold: true }, builder?.name ?? data.job.builderId],
        [{ text: 'Address', bold: true }, pdfText(`${data.job.addressLine1}\n${data.job.addressLine2}`), { text: 'House type', bold: true }, HOUSE_TYPE_LABELS[data.job.houseType]],
        [{ text: 'Floor / part', bold: true }, floor, { text: 'Detailer', bold: true }, data.job.detailer || '—'],
        [{ text: 'Job conditions', bold: true }, { text: yesConditions.length ? yesConditions.join(', ') : 'None', colSpan: 3 }, '', ''],
        [{ text: 'Saved', bold: true }, fmtDate(data.savedAt) || '—', { text: 'Rules version', bold: true }, `v${content.version}`],
      ],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 10],
  });

  // Stages
  for (const [si, stage] of content.stages.entries()) {
    const list = visibleItems(content, data.job, stage.id);
    body.push({ text: `${si + 1}. ${stage.title}`, style: 'h2', pageBreak: si === 0 ? undefined : undefined });

    if (stage.id === 'elevations') {
      body.push({
        ul: data.elevations.map((e) => `${e.name}${e.frontFacade && usesFrontFacade(content, data) ? '  — front façade' : ''}`),
        margin: [0, 0, 0, 6],
      });
    }
    if (stage.id === 'wall-panels' && data.walls.length) {
      const issues = [...wallIssues(data.walls), ...loadBearingIssues(data)];
      body.push({
        table: {
          headerRows: 1,
          widths: [40, '*', 60, 30, 45, 45, '*'],
          body: [
            ['Wall', 'Elevation', 'Finish', 'LB', 'Length', 'Height', 'Check'].map((t) => ({ text: t, style: 'th' })),
            ...data.walls.map((w) => [
              w.label,
              data.elevations.find((e) => e.id === w.elevationId)?.name ?? 'Internal',
              w.finish === 'brick-veneer' ? 'Brick veneer' : w.finish === 'cladding' ? 'Cladding' : '—',
              w.loadBearing ? 'Yes' : 'No',
              w.length,
              w.height,
              {
                text: pdfText(issues.filter((i) => i.wallId === w.id).map((i) => i.check.message).join('\n') || 'OK'),
                color: issues.some((i) => i.wallId === w.id && i.check.level === 'block') ? C.block : issues.some((i) => i.wallId === w.id) ? C.warn : C.ok,
              },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
        fontSize: 7.5,
        margin: [0, 0, 0, 6],
      });
    }
    if (stage.id === 'openings' && data.openings.length) {
      body.push({
        table: {
          headerRows: 1,
          widths: [28, 28, 60, 48, 52, 30, 52, '*', '*'],
          body: [
            ['Label', 'Wall', 'Type', 'Schedule H×W', 'Stud opening', 'Head', 'Position', 'Lintel & framing', 'Checks'].map((t) => ({ text: t, style: 'th' })),
            ...data.openings.map((o) => {
              const wall = data.walls.find((w) => w.id === o.wallId);
              const calc = openingCalc(content, data, o);
              const pos =
                o.position === 'middle'
                  ? 'Middle'
                  : o.position === 'corner90' || o.position === 'corner70'
                    ? `${o.position === 'corner90' ? 90 : 70} mm from corner ${o.side}`
                    : (() => {
                      const d = num(o.dimension);
                      const r = d !== null && wall ? planToFrameDimension(d, wall.finish) : null;
                      return `${o.dimension} ${o.side}${r ? ` (frame ${r.min === r.max ? r.min : `${r.min}–${r.max}`})` : ''}`;
                    })();
              const lintel = framingText(o, calc);
              const checks = [...calc.issues, ...calc.deflection];
              return [
                o.label,
                wall?.label ?? '—',
                content.allowances[o.type].label,
                `${o.scheduleH}×${o.scheduleW}`,
                calc.stud ? `${calc.stud.height}×${calc.stud.width}` : '—',
                o.headHeight,
                pos,
                pdfText(lintel || '—'),
                {
                  text: pdfText(checks.map((c) => c.message).join('\n') || 'OK'),
                  color: checks.some((c) => c.level === 'block') ? C.block : checks.some((c) => c.level === 'warn') ? C.warn : C.ok,
                },
              ];
            }),
          ],
        },
        layout: 'lightHorizontalLines',
        fontSize: 7,
        margin: [0, 0, 0, 6],
      });
    }

    const header = ['#', 'Item', 'Status', 'Values', 'Note', ...(mode === 'draft' ? ['Checker notes'] : [])].map((t) => ({ text: t, style: 'th' }));
    body.push({
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: mode === 'draft' ? [18, '*', 48, 120, 80, 80] : [18, '*', 52, 140, 100],
        body: [header, ...list.map((item, i) => itemRow(item, data, data.job.builderId, mode, `${si + 1}.${i + 1}`))],
      },
      layout: {
        hLineColor: () => C.line,
        vLineColor: () => C.line,
        fillColor: (row: number) => (row === 0 ? C.grey : null),
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
      fontSize: 8,
      margin: [0, 0, 0, 10],
    });
  }

  // General comments
  const general = data.review.entries.filter((e) => e.itemId === null);
  if (general.length) {
    body.push({ text: 'General review comments', style: 'h2' });
    body.push({ stack: entryLines(general), fontSize: 8, margin: [0, 0, 0, 10] });
  }

  // Layout label preview
  body.push({ text: 'Frame layout label', style: 'h2' });
  body.push({
    text: pdfText(addressLabel(data.job.jobNo, floor, builder?.name ?? '', data.job.addressLine1, data.job.addressLine2).join('\n')),
    margin: [0, 0, 0, 10],
    fontSize: 9,
  });

  // Checker focus (#24)
  const points = focusPointsFor(data);
  body.push({ text: `Checker focus (${points.filter((p) => data.review.focusChecks[p.id]).length}/${points.length} verified)`, style: 'h2' });
  body.push({
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [120, '*', 80],
      body: [
        ['Point', 'What was entered', 'Verified'].map((t) => ({ text: t, style: 'th' })),
        ...points.map((p) => {
          const info = p.info(content, data);
          const v = data.review.focusChecks[p.id];
          return [
            { text: pdfText(p.title), bold: true },
            {
              stack: [
                { text: pdfText(info.lines.join('\n')) },
                ...(info.warnings.length ? [{ text: pdfText(info.warnings.map((w) => `! ${w}`).join('\n')), color: C.warn } as Content] : []),
              ],
            },
            v ? { text: `Yes — ${v.by}`, color: C.ok } : { text: mode === 'draft' ? '[  ]' : 'No', color: C.muted },
          ];
        }),
      ],
    },
    layout: 'lightHorizontalLines',
    fontSize: 7.5,
    margin: [0, 0, 0, 10],
  });

  // Sign-off
  body.push({ text: 'Review and sign-off', style: 'h2' });
  body.push({
    table: {
      widths: [60, '*', 110, 110],
      body: [
        ['Check', 'Checker', 'Started', 'Signed off'].map((t) => ({ text: t, style: 'th' })),
        ...(data.review.rounds.length
          ? data.review.rounds.map((r) => [r.round === 3 ? '3rd check' : '2nd check', r.checker, fmtDate(r.startedAt), r.signedOffAt ? fmtDate(r.signedOffAt) : 'Not signed off'])
          : [['—', 'No review yet', '', '']]),
      ],
    },
    layout: 'lightHorizontalLines',
    fontSize: 8,
    margin: [0, 0, 0, 10],
  });
  if (mode === 'draft') {
    body.push({ text: 'Checker signature: ______________________________     Date: ______________', margin: [0, 16, 0, 0] });
  }

  // Pictures attached by the detailer (bracing screenshots, beam pockets…)
  const itemPictures = visibleItems(content, data.job).flatMap((item) =>
    (item.fields ?? [])
      .filter((f) => f.kind === 'photos' && isFieldVisible(f, itemState(data, item.id)))
      .map((f) => ({ item, field: f, ids: listValue(itemState(data, item.id).values[f.id]) }))
      .filter((x) => x.ids.length > 0),
  );
  if (itemPictures.length) {
    body.push({ text: 'Appendix — pictures from the checklist', style: 'h2', pageBreak: 'before' });
    for (const { item, field, ids } of itemPictures) {
      body.push({ text: pdfText(`${item.title} — ${field.label}`), bold: true, margin: [0, 6, 0, 4] });
      for (const pid of ids) {
        const p = photos.find((x) => x.id === pid);
        if (p) body.push({ image: p.dataUrl, fit: [500, 320], margin: [0, 0, 0, 6] });
      }
    }
  }

  // Photos appendix
  const withPhotos = data.review.entries.filter((e) => e.photoIds.length > 0);
  if (withPhotos.length) {
    body.push({ text: 'Appendix — review photos', style: 'h2', pageBreak: 'before' });
    for (const e of withPhotos) {
      const item = content.items.find((i) => i.id === e.itemId);
      body.push({ text: pdfText(`${item ? item.title : 'General'} — ${e.text}`), bold: true, margin: [0, 6, 0, 4] });
      for (const pid of e.photoIds) {
        const p = photos.find((x) => x.id === pid);
        if (p) body.push({ image: p.dataUrl, fit: [500, 320], margin: [0, 0, 0, 6] });
      }
    }
  }

  return {
    pageSize: 'A4',
    pageMargins: [32, 36, 32, 40],
    info: { title: `${data.job.jobNo} ${floor} — ${mode === 'draft' ? 'Draft' : 'Final'} checklist`, author: 'Smart Check Wall' },
    watermark: mode === 'draft' ? { text: 'DRAFT', color: C.block, opacity: 0.08, bold: true } : undefined,
    defaultStyle: { font: 'Roboto', fontSize: 9, color: C.charcoal, lineHeight: 1.15 },
    styles: {
      h2: { fontSize: 11.5, bold: true, color: C.blue, margin: [0, 8, 0, 5] },
      th: { bold: true, fontSize: 8, color: C.charcoal },
    },
    footer: (page: number, pages: number) => ({
      columns: [
        { text: `${data.job.jobNo} ${floor} · ${mode === 'draft' ? 'DRAFT — not for client' : 'Final report'}`, color: C.muted },
        { text: `Page ${page} of ${pages}`, alignment: 'right', color: C.muted },
      ],
      margin: [32, 12, 32, 0],
      fontSize: 7.5,
    }),
    content: body,
  };
}

async function fetchDataUrl(path: string): Promise<string | undefined> {
  try {
    const res = await fetch(path);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/** Generates the PDF in the browser. pdfmake is loaded only when needed. */
export async function generatePdf(content: ChecklistContent, data: JobData, photos: Photo[], mode: PdfMode): Promise<Blob> {
  const [pdfMakeMod, vfsMod] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  const pdfMake = (pdfMakeMod as unknown as { default: typeof import('pdfmake/build/pdfmake') }).default ?? pdfMakeMod;
  const vfs = (vfsMod as unknown as { default: Record<string, string> }).default ?? vfsMod;
  pdfMake.addVirtualFileSystem(vfs);
  const [mitek, lawmans] = await Promise.all([fetchDataUrl('/logos/mitek.png'), fetchDataUrl('/logos/lawmans.png')]);
  const doc = buildDocDefinition(content, data, photos, mode, { mitek, lawmans });
  return pdfMake.createPdf(doc).getBlob();
}
