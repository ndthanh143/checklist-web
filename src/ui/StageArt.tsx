import type { ReactNode } from 'react';
import type { StageId } from '../content/types';

// Small flat illustrations for the stage headers (#4), in the colours of the
// Smart Check Wall logo: timber + green check, with MiTek blue accents.

const T = '#e6ae6d'; // timber
const TD = '#b9793a'; // timber edge
const L = '#cf8f4a'; // lintel / beam
const G = '#1f7a32'; // check green
const B = '#0033a0'; // MiTek blue
const GL = '#dfeefa'; // glass
const GR = '#8a96a3'; // steel / pencil grey

const wood = { fill: T, stroke: TD, strokeWidth: 1.2 };

/** A simple wall panel: plates and studs between x0 and x1. */
function Panel({ x0 = 14, x1 = 106, top = 14, bottom = 66, studs = [] as number[] }) {
  return (
    <>
      <rect x={x0} y={top} width={x1 - x0} height={5} rx={1} {...wood} />
      <rect x={x0} y={bottom} width={x1 - x0} height={5} rx={1} {...wood} />
      {studs.map((x) => (
        <rect key={x} x={x} y={top + 5} width={5} height={bottom - top - 5} {...wood} />
      ))}
    </>
  );
}

function Check({ x, y, r = 10 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#fff" stroke={G} strokeWidth={2} />
      <path d={`M${x - r * 0.5} ${y} l${r * 0.35} ${r * 0.38} l${r * 0.65} -${r * 0.75}`} fill="none" stroke={G} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

const ART: Record<StageId, ReactNode> = {
  'job-review': (
    <>
      <rect x={20} y={8} width={58} height={64} rx={3} fill="#fff" stroke="#c7cdd5" strokeWidth={1.5} />
      <path d="M30 36 L49 22 L68 36" fill="none" stroke={TD} strokeWidth={2.5} strokeLinejoin="round" />
      <rect x={33} y={36} width={32} height={18} fill="none" stroke={TD} strokeWidth={2} />
      <path d="M30 60 H68 M30 65 H56" stroke="#c7cdd5" strokeWidth={2} strokeLinecap="round" />
      <circle cx={84} cy={50} r={12} fill={GL} fillOpacity={0.6} stroke={B} strokeWidth={3} />
      <path d="M93 59 L104 70" stroke={B} strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  'job-setup': (
    <>
      <rect x={30} y={8} width={44} height={6} rx={1} {...wood} />
      <rect x={30} y={14} width={44} height={6} rx={1} {...wood} />
      <rect x={47} y={20} width={10} height={42} {...wood} />
      <rect x={30} y={62} width={44} height={7} rx={1} {...wood} />
      <path d="M88 8 V69 M84 8 H92 M84 69 H92" stroke={B} strokeWidth={1.8} />
      <text x={96} y={42} fontSize={9} fontWeight={700} fill={B} fontFamily="Segoe UI, Arial, sans-serif">
        2450
      </text>
    </>
  ),
  'wall-input': (
    <>
      <rect x={16} y={10} width={88} height={60} fill="#fffaf2" stroke={TD} strokeWidth={4} />
      <path d="M60 10 V44 M16 44 H82 M82 44 V70" stroke={TD} strokeWidth={3} fill="none" />
      <path d="M22 28 H100" stroke={B} strokeWidth={2} strokeDasharray="5 3" />
      <text x={64} y={25} fontSize={8} fontWeight={700} fill={B} fontFamily="Segoe UI, Arial, sans-serif">
        BEAM
      </text>
      <rect x={78} y={40} width={8} height={8} fill={GR} />
    </>
  ),
  elevations: (
    <>
      <path d="M18 38 L54 14 L90 38" fill={L} stroke={TD} strokeWidth={1.5} strokeLinejoin="round" />
      <rect x={24} y={38} width={60} height={32} fill="#fff7ec" stroke={TD} strokeWidth={1.5} />
      <rect x={32} y={46} width={14} height={11} fill={GL} stroke="#9cc3e6" />
      <rect x={60} y={46} width={14} height={24} fill={T} stroke={TD} />
      <circle cx={102} cy={20} r={11} fill="#fff" stroke={B} strokeWidth={1.8} />
      <path d="M102 11 L106 22 H98 Z" fill={B} />
      <text x={99} y={42} fontSize={9} fontWeight={700} fill={B} fontFamily="Segoe UI, Arial, sans-serif">
        N
      </text>
    </>
  ),
  'wall-panels': (
    <>
      <Panel studs={[14, 36, 58, 80, 101]} />
      <rect x={19} y={42} width={17} height={4} {...wood} />
      <rect x={63} y={46} width={17} height={4} {...wood} />
      <g transform="translate(40 30) rotate(-6)">
        <rect width={26} height={14} rx={3} fill={B} />
        <text x={13} y={10.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff" fontFamily="Segoe UI, Arial, sans-serif">
          E1
        </text>
      </g>
    </>
  ),
  openings: (
    <>
      <Panel studs={[14, 30, 85, 101]} />
      <rect x={35} y={19} width={50} height={12} fill={L} stroke={TD} strokeWidth={1.2} />
      <rect x={35} y={31} width={4} height={35} {...wood} />
      <rect x={81} y={31} width={4} height={35} {...wood} />
      <rect x={39} y={34} width={42} height={4} {...wood} />
      <rect x={39} y={52} width={42} height={4} {...wood} />
      <rect x={40} y={38} width={40} height={14} fill={GL} stroke="#9cc3e6" />
    </>
  ),
  'wall-adjustment': (
    <>
      <Panel x0={10} x1={56} studs={[10, 30, 51]} />
      <Panel x0={64} x1={110} studs={[64, 84, 105]} />
      <path d="M60 8 V76" stroke={B} strokeWidth={1.5} strokeDasharray="3 3" />
      <rect x={82} y={19} width={9} height={47} fill={T} stroke={G} strokeWidth={2.2} />
      <path d="M86.5 2 V14 M82 9 L86.5 14 L91 9" stroke={G} strokeWidth={2} fill="none" strokeLinecap="round" />
    </>
  ),
  'elevation-check': (
    <>
      <Panel studs={[14, 37, 60, 83, 101]} />
      <path d="M19 66 L83 19 M19 19 L83 66" stroke={GR} strokeWidth={2.2} strokeLinecap="round" />
      <Check x={100} y={14} r={10} />
    </>
  ),
  'labels-notes': (
    <>
      <g transform="translate(14 18) rotate(-8)">
        <rect width={34} height={18} rx={4} fill={B} />
        <text x={17} y={13} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" fontFamily="Segoe UI, Arial, sans-serif">
          W1
        </text>
      </g>
      <g transform="translate(46 42) rotate(5)">
        <rect width={34} height={18} rx={4} fill={L} />
        <text x={17} y={13} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" fontFamily="Segoe UI, Arial, sans-serif">
          D1
        </text>
      </g>
      <g transform="translate(92 8) rotate(35)">
        <rect width={8} height={44} rx={1.5} fill={T} stroke={TD} />
        <path d="M0 44 L4 54 L8 44 Z" fill="#f2d9b8" stroke={TD} />
        <path d="M3 51 L4 54 L5 51 Z" fill="#333" />
      </g>
    </>
  ),
};

export function StageArt({ stage }: { stage: StageId }) {
  return (
    <svg className="stage-art" viewBox="0 0 120 80" aria-hidden="true" focusable="false">
      {ART[stage]}
    </svg>
  );
}
