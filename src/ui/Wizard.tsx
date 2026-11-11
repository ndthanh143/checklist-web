import { useState } from 'react';
import { CONDITION_KEYS, CONDITION_LABELS, FLOOR_LABELS, HOUSE_TYPES, HOUSE_TYPE_LABELS } from '../content/types';
import type { FloorKind } from '../content/types';
import { floorsFor, jobForOtherFloor, newJobData } from '../job/factory';
import type { JobData, JobInfo } from '../job/types';
import { addressWarnings } from '../lib/calc';
import { newJobInfo, useSession } from '../store/session';
import { BuilderLogo, toast, YesNo } from './common';
import { confirmDiscard, pickJobFile } from './fileActions';
import { IconBack, IconInfo, IconNext, IconOpen, IconWarn } from './icons';

const STEPS = ['Job details', 'House type', 'Job conditions'];

export function Wizard({ initialBuilder, onCancel }: { initialBuilder: string; onCancel: () => void }) {
  const { content, startJob } = useSession();
  const [step, setStep] = useState(0);
  const [info, setInfo] = useState<JobInfo>({ ...newJobInfo(), builderId: initialBuilder });
  const [copyFrom, setCopyFrom] = useState<JobData | null>(null);
  const set = (patch: Partial<JobInfo>) => setInfo((i) => ({ ...i, ...patch }));

  const floorOptions: FloorKind[] = [...floorsFor(info.houseType), 'granny-flat', 'studio'];
  const addrWarn = addressWarnings(info.addressLine1, info.addressLine2);
  const canNext = step === 0 ? !!info.builderId && info.jobNo.trim() !== '' : true;

  const copyFromFile = async () => {
    const p = await pickJobFile();
    if (!p) return;
    const src = p.parsed.data;
    setCopyFrom(src);
    const otherFloor: FloorKind = src.job.floor === 'ground' ? 'first' : src.job.floor === 'first' ? 'ground' : info.floor;
    setInfo({ ...src.job, floor: otherFloor });
    toast(`Copied job details from ${p.name}`, 'ok');
  };

  const start = () => {
    if (!confirmDiscard()) return;
    const data = copyFrom ? jobForOtherFloor(copyFrom, info.floor) : newJobData(info);
    data.job = { ...info };
    startJob(data);
  };

  return (
    <main className="page page-narrow">
      <h1>New checklist</h1>
      <div className="steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`step-pill${i === step ? ' active' : i < step ? ' done' : ''}`}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="stack">
          <div className="section-title">Builder</div>
          <div className="builder-grid">
            {content.builders
              .filter((b) => b.active)
              .map((b) => (
                <button key={b.id} className={`builder-card${info.builderId === b.id ? ' selected' : ''}`} onClick={() => set({ builderId: b.id })} aria-pressed={info.builderId === b.id}>
                  <BuilderLogo builder={b} />
                  <span className="name">{b.name}</span>
                </button>
              ))}
          </div>
          <div className="field-row mt">
            <div className="field">
              <label className="label" htmlFor="jobno">
                Job No <span className="block-text">*</span>
              </label>
              <input id="jobno" className="input" value={info.jobNo} placeholder="e.g. 26-175" onChange={(e) => set({ jobNo: e.target.value })} />
              <span className="hint">The number from the customer.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="detailer">
                Detailer
              </label>
              <input id="detailer" className="input" value={info.detailer} placeholder="Your name" onChange={(e) => set({ detailer: e.target.value })} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="addr1">
                Address line 1 — Lot, No, Street
              </label>
              <input id="addr1" className="input" value={info.addressLine1} placeholder="Lot 1531 No. 7 May Lane" onChange={(e) => set({ addressLine1: e.target.value })} />
            </div>
            <div className="field">
              <label className="label" htmlFor="addr2">
                Address line 2 — Suburb
              </label>
              <input id="addr2" className="input" value={info.addressLine2} placeholder="Wilton" onChange={(e) => set({ addressLine2: e.target.value })} />
            </div>
          </div>
          <span className="hint">No state, postcode or DP number — all jobs are in NSW.</span>
          {addrWarn.length > 0 && (
            <div className="problems">
              {addrWarn.map((w) => (
                <div key={w}>
                  <IconWarn size={14} /> {w}
                </div>
              ))}
            </div>
          )}
          <div className="calc-box row" style={{ justifyContent: 'space-between' }}>
            <span>
              <IconInfo size={16} /> Doing the other floor of a double-storey job? Copy the job details from that floor’s file.
            </span>
            <button className="btn small" onClick={copyFromFile}>
              <IconOpen size={16} /> Copy from a .chck file
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <div className="section-title">House type</div>
          <div className="option-grid">
            {HOUSE_TYPES.map((h) => (
              <label key={h} className={`option${info.houseType === h ? ' selected' : ''}`}>
                <input
                  type="radio"
                  name="houseType"
                  checked={info.houseType === h}
                  onChange={() => set({ houseType: h, floor: floorsFor(h)[0] })}
                />
                <span>{HOUSE_TYPE_LABELS[h]}</span>
              </label>
            ))}
          </div>
          <div className="section-title mt">This checklist is for</div>
          <div className="option-grid">
            {floorOptions.map((f) => (
              <label key={f} className={`option${info.floor === f ? ' selected' : ''}`}>
                <input type="radio" name="floor" checked={info.floor === f} onChange={() => set({ floor: f })} />
                <span>{FLOOR_LABELS[f]}</span>
              </label>
            ))}
          </div>
          {info.houseType.startsWith('double') && (
            <div className="calc-box">
              <IconInfo size={16} /> The client needs a separate file for each floor, so a double-storey house has <b>two checklists</b>. Start with one floor. When it is
              done, start a new checklist for the other floor and use “Copy from a .chck file”.
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <p className="muted">Answer Yes for anything this job has. Items for “No” answers are hidden. You can change these later on the Job Review page.</p>
          {CONDITION_KEYS.map((k) => (
            <div key={k} className="yesno">
              <span>{CONDITION_LABELS[k]}</span>
              <YesNo label={CONDITION_LABELS[k]} value={info.conditions[k]} onChange={(v) => set({ conditions: { ...info.conditions, [k]: v } })} />
            </div>
          ))}
        </div>
      )}

      <div className="wizard-foot">
        <button className="btn" onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>
          <IconBack size={18} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn primary big" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next <IconNext size={18} />
          </button>
        ) : (
          <button className="btn primary big" onClick={start}>
            Start checklist <IconNext size={18} />
          </button>
        )}
      </div>
      {step === 0 && !canNext && <p className="hint" style={{ textAlign: 'right', marginTop: 6 }}>Choose the builder and enter the Job No to continue.</p>}
    </main>
  );
}
