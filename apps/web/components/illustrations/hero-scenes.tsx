import type { ReactNode } from 'react';

// Hero scenes share the construction scene's visual language: thin light line-art, translucent
// navy blocks, orange accents and a glowing disc. Hero background is always dark navy, so the
// line colour is the chrome foreground token. All scenes are decorative.
const LINE = 'var(--chrome-foreground)';

type SceneProps = { className?: string };

function Scene({ className, children }: SceneProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 480 360" className={className} aria-hidden="true" focusable="false">
      <circle cx="380" cy="80" r="46" fill="var(--brand)" opacity="0.18" />
      <circle cx="380" cy="80" r="26" fill="var(--brand)" opacity="0.35" />
      {children}
      <path d="M0 358h480" stroke={LINE} strokeOpacity="0.4" />
    </svg>
  );
}

function line(props: { w?: number; o?: number } = {}) {
  return { stroke: LINE, strokeOpacity: props.o ?? 0.85, strokeWidth: props.w ?? 3, fill: 'none' };
}

/** CNC machining centre next to a robot arm. */
export function MachinerySceneArt({ className }: SceneProps) {
  return (
    <Scene className={className}>
      {/* CNC cabinet */}
      <rect x="280" y="170" width="160" height="170" rx="4" fill={LINE} fillOpacity="0.12" />
      <rect x="280" y="170" width="160" height="170" rx="4" {...line()} />
      <rect
        x="296"
        y="192"
        width="92"
        height="84"
        {...line({ w: 2 })}
        fill={LINE}
        fillOpacity="0.08"
      />
      <rect x="398" y="192" width="30" height="84" fill={LINE} fillOpacity="0.2" />
      <g fill="var(--brand)">
        <rect x="404" y="200" width="18" height="8" />
        <rect x="404" y="216" width="18" height="8" fillOpacity="0.6" />
      </g>
      <g fill={LINE} fillOpacity="0.5">
        <circle cx="413" cy="244" r="5" />
        <circle cx="413" cy="262" r="5" />
      </g>
      {/* spindle, tool, table, workpiece */}
      <path d="M342 192v32M342 238v18" {...line({ w: 3 })} />
      <rect x="333" y="224" width="18" height="14" fill={LINE} fillOpacity="0.4" />
      <rect x="306" y="262" width="72" height="8" fill={LINE} fillOpacity="0.9" />
      <rect x="330" y="252" width="24" height="10" fill="var(--brand)" />
      <path d="M280 300h160" stroke={LINE} strokeOpacity="0.3" />
      {/* robot arm */}
      <rect x="50" y="316" width="100" height="24" fill={LINE} fillOpacity="0.28" />
      <rect x="90" y="290" width="20" height="26" fill={LINE} fillOpacity="0.12" />
      <path
        d="M100 286 148 186"
        stroke={LINE}
        strokeOpacity="0.2"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path d="M100 286 148 186" {...line()} />
      <path
        d="M148 186 214 160"
        stroke={LINE}
        strokeOpacity="0.2"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path d="M148 186 214 160" {...line()} />
      <g fill="var(--chrome)" stroke={LINE} strokeWidth="3" strokeOpacity="0.9">
        <circle cx="100" cy="286" r="12" />
        <circle cx="148" cy="186" r="10" />
        <circle cx="214" cy="160" r="8" />
      </g>
      <path d="M214 160l16 8M230 168l10-8M230 168l8 14" {...line({ w: 3 })} />
      <rect x="236" y="180" width="26" height="10" fill="var(--brand)" />
    </Scene>
  );
}

/** Excavator digging a soil pile. */
export function HeavyMachineSceneArt({ className }: SceneProps) {
  return (
    <Scene className={className}>
      <path d="M330 340q50-70 130 0z" fill={LINE} fillOpacity="0.12" />
      {/* tracks */}
      <rect x="80" y="296" width="200" height="40" rx="20" fill={LINE} fillOpacity="0.14" />
      <rect x="80" y="296" width="200" height="40" rx="20" {...line()} />
      <g {...line({ w: 2 })}>
        <circle cx="102" cy="316" r="9" />
        <circle cx="180" cy="316" r="9" />
        <circle cx="258" cy="316" r="9" />
      </g>
      {/* body, cab, counterweight */}
      <rect x="110" y="246" width="140" height="50" fill={LINE} fillOpacity="0.12" />
      <rect x="110" y="246" width="140" height="50" {...line()} />
      <rect x="96" y="256" width="20" height="40" rx="3" fill="var(--brand)" />
      <path d="M170 246v-42h48l22 42" {...line()} />
      <path d="M180 246v-32h34l14 32z" fill={LINE} fillOpacity="0.22" />
      {/* boom, stick, bucket, hydraulics */}
      <path
        d="M236 258 332 168"
        stroke={LINE}
        strokeOpacity="0.2"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path d="M236 258 332 168" {...line()} />
      <path
        d="M332 168 400 236"
        stroke={LINE}
        strokeOpacity="0.2"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path d="M332 168 400 236" {...line()} />
      <path d="M242 244 318 186M352 192l30 32" {...line({ w: 2, o: 0.7 })} />
      <path d="M400 236l32 6-8 30-30-14z" fill="var(--brand)" />
      <g fill="var(--chrome)" stroke={LINE} strokeWidth="3" strokeOpacity="0.9">
        <circle cx="236" cy="258" r="8" />
        <circle cx="332" cy="168" r="8" />
        <circle cx="400" cy="236" r="7" />
      </g>
    </Scene>
  );
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) =>
    `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(1)}`;
  return `M${p(a0)}A${String(r)} ${String(r)} 0 0 1 ${p(a1)}`;
}

/** Scrap bales and a recycling loop. */
export function ScrapSceneArt({ className }: SceneProps) {
  const bale = (x: number, y: number) => (
    <g key={`${String(x)}-${String(y)}`}>
      <rect x={x} y={y} width="96" height="60" fill={LINE} fillOpacity="0.12" />
      <rect x={x} y={y} width="96" height="60" {...line()} />
      <path
        d={`M${String(x + 8)} ${String(y + 14)}h80M${String(x + 8)} ${String(y + 30)}h80M${String(x + 8)} ${String(y + 46)}h80`}
        {...line({ w: 1.5, o: 0.35 })}
      />
      <path
        d={`M${String(x + 24)} ${String(y)}v60M${String(x + 72)} ${String(y)}v60`}
        stroke="var(--brand)"
        strokeWidth="4"
      />
    </g>
  );
  return (
    <Scene className={className}>
      <defs>
        <marker
          id="hero-recycle-arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="3"
          markerHeight="3"
          orient="auto"
        >
          <path d="M0 0 10 5 0 10z" fill="var(--brand)" />
        </marker>
      </defs>
      {bale(40, 280)}
      {bale(144, 280)}
      {bale(92, 218)}
      <g
        fill="none"
        stroke="var(--brand)"
        strokeWidth="6"
        strokeLinecap="round"
        markerEnd="url(#hero-recycle-arrow)"
      >
        <path d={arc(350, 215, 62, -70, 30)} />
        <path d={arc(350, 215, 62, 50, 150)} />
        <path d={arc(350, 215, 62, 170, 270)} />
      </g>
      <circle cx="350" cy="215" r="34" {...line({ w: 2, o: 0.5 })} />
      <path d="M338 215h24M350 203v24" {...line({ w: 2, o: 0.35 })} />
    </Scene>
  );
}

function gearPath(cx: number, cy: number, ro: number, ri: number, teeth: number) {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [da, r] of [
      [-0.28, ri],
      [-0.16, ro],
      [0.16, ro],
      [0.28, ri],
    ] as const) {
      const t = a + da * step * 2;
      pts.push(`${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`);
    }
  }
  return `M${pts.join('L')}Z`;
}

/** Gears, ball bearing and an electric motor. */
export function HardwareSceneArt({ className }: SceneProps) {
  const balls = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return [300 + 40 * Math.cos(a), 275 + 40 * Math.sin(a)] as const;
  });
  return (
    <Scene className={className}>
      <path d={gearPath(150, 215, 72, 58, 12)} fill={LINE} fillOpacity="0.12" />
      <path d={gearPath(150, 215, 72, 58, 12)} {...line()} />
      <circle cx="150" cy="215" r="34" {...line({ w: 2 })} />
      <circle cx="150" cy="215" r="12" fill={LINE} fillOpacity="0.5" />
      <path d="M150 181v-12M150 249v12M116 215h-12M184 215h12" {...line({ w: 2, o: 0.5 })} />
      <path d={gearPath(236, 142, 40, 30, 8)} fill="var(--brand)" fillOpacity="0.9" />
      <circle cx="236" cy="142" r="10" fill="var(--chrome)" />
      {/* ball bearing */}
      <circle cx="300" cy="275" r="52" fill={LINE} fillOpacity="0.12" />
      <circle cx="300" cy="275" r="52" {...line()} />
      <circle cx="300" cy="275" r="28" {...line({ w: 2 })} />
      <circle cx="300" cy="275" r="10" fill={LINE} fillOpacity="0.5" />
      {balls.map(([x, y]) => (
        <circle key={`${x.toFixed(0)}-${y.toFixed(0)}`} cx={x} cy={y} r="6" fill="var(--brand)" />
      ))}
      {/* motor */}
      <rect x="375" y="258" width="76" height="52" rx="6" fill={LINE} fillOpacity="0.12" />
      <rect x="375" y="258" width="76" height="52" rx="6" {...line()} />
      <path
        d="M390 264v40M402 264v40M414 264v40M426 264v40M438 264v40"
        {...line({ w: 1.5, o: 0.4 })}
      />
      <rect x="357" y="278" width="18" height="12" fill="var(--brand)" />
      <rect x="383" y="310" width="60" height="8" fill={LINE} fillOpacity="0.9" />
    </Scene>
  );
}

/** Racking, overhead conveyor and a forklift. */
export function WarehouseSceneArt({ className }: SceneProps) {
  const crate = (x: number, y: number, w: number, accent = false) => (
    <rect
      key={`${String(x)}-${String(y)}`}
      x={x}
      y={y}
      width={w}
      height="30"
      fill={accent ? 'var(--brand)' : LINE}
      fillOpacity={accent ? 1 : 0.22}
    />
  );
  return (
    <Scene className={className}>
      {/* rack */}
      <g {...line()}>
        <path d="M40 110V340M135 110V340M230 110V340" />
        <path d="M40 130h190M40 205h190M40 280h190" />
      </g>
      {crate(52, 100, 34)}
      {crate(96, 100, 30)}
      {crate(52, 175, 70)}
      {crate(148, 175, 40, true)}
      {crate(52, 250, 36)}
      {crate(100, 250, 26)}
      {crate(148, 250, 70)}
      {/* overhead conveyor */}
      <path d="M275 130v210M462 130v210" {...line({ w: 2, o: 0.5 })} />
      <rect x="268" y="122" width="202" height="10" rx="5" fill={LINE} fillOpacity="0.4" />
      <g fill={LINE} fillOpacity="0.8">
        {[290, 330, 370, 410, 450].map((x) => (
          <circle key={x} cx={x} cy="136" r="3" />
        ))}
      </g>
      <rect x="300" y="94" width="34" height="28" fill={LINE} fillOpacity="0.22" />
      <rect x="404" y="98" width="30" height="24" fill="var(--brand)" />
      {/* forklift */}
      <path d="M352 180V332" stroke={LINE} strokeOpacity="0.2" strokeWidth="10" />
      <path d="M352 180V332" {...line()} />
      <path d="M304 322h48" {...line({ w: 4 })} />
      <rect x="306" y="288" width="44" height="32" fill="var(--brand)" />
      <rect x="368" y="252" width="80" height="60" rx="4" fill={LINE} fillOpacity="0.14" />
      <rect x="368" y="252" width="80" height="60" rx="4" {...line()} />
      <path d="M378 252v-58h58v58" {...line()} />
      <path d="M388 252v-20h30v20z" fill={LINE} fillOpacity="0.3" />
      <g fill="var(--chrome)" stroke={LINE} strokeWidth="3" strokeOpacity="0.9">
        <circle cx="390" cy="324" r="14" />
        <circle cx="432" cy="324" r="14" />
      </g>
    </Scene>
  );
}

/** Steel frame under construction beside a blueprint with a compass. */
export function ProjectSceneArt({ className }: SceneProps) {
  return (
    <Scene className={className}>
      {/* steel frame */}
      <g {...line()}>
        <path d="M60 340V104M140 340V104M220 340V104" />
        <path d="M60 110h160M60 190h160M60 270h160" />
        <path d="M60 270l80-80M140 270l-80-80M140 190l80-80" strokeWidth="2" strokeOpacity="0.6" />
      </g>
      <path d="M140 270l80-80" stroke="var(--brand)" strokeWidth="5" />
      <g fill={LINE} fillOpacity="0.9">
        <rect x="40" y="338" width="200" height="6" />
      </g>
      {/* blueprint */}
      <rect x="290" y="130" width="160" height="190" rx="6" fill={LINE} fillOpacity="0.1" />
      <rect x="290" y="130" width="160" height="190" rx="6" {...line({ w: 2 })} />
      <g {...line({ w: 1, o: 0.25 })}>
        <path d="M290 170h160M290 210h160M290 250h160M290 290h160M330 130v190M370 130v190M410 130v190" />
      </g>
      <path d="M312 300V230h46v-50h72v120z" {...line({ w: 2.5 })} />
      <path d="M312 312h118" stroke="var(--brand)" strokeWidth="3" />
      {/* compass */}
      <circle cx="372" cy="150" r="6" fill="var(--chrome)" stroke={LINE} strokeWidth="3" />
      <path d="M372 156 346 262M372 156 398 262" {...line({ w: 3 })} />
      <path
        d="M346 262l-3 10M398 262l8 6"
        stroke="var(--brand)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M346 232 398 232" {...line({ w: 2, o: 0.5 })} />
    </Scene>
  );
}
