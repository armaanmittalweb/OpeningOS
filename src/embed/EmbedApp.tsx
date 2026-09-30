import { useCallback, useState } from 'react';
import { STAGES, type Command, type StageIndex } from './protocol';
import type { StageEvent } from './pipeline';
import { useParent } from './useParent';
import { DrillDemo } from './DrillDemo';
import { TransposeDemo } from './TransposeDemo';

type Mode = 'drill' | 'transpose';

export function EmbedApp() {
  const [mode, setMode] = useState<Mode>('drill');
  const [run, setRun] = useState(0);
  const [stages, setStages] = useState<Partial<Record<StageIndex, StageEvent>>>({});

  const start = (m: Mode) => {
    setStages({});
    setMode(m);
    setRun((r) => r + 1);
  };
  const post = useParent((c: Command) => start(c === 'transpose' ? 'transpose' : 'drill'));

  const emit = useCallback(
    (e: StageEvent) => {
      // Stages are timed during render; report them after it.
      queueMicrotask(() => {
        setStages((s) => ({ ...s, [e.i]: e }));
        post({ type: 'stage', ...e });
      });
    },
    [post],
  );

  return (
    <div className="embed">
      <div className="embed-top">
        <p className="embed-mark">
          OpeningOS <span className="meta">demo</span>
        </p>
        <div className="seg" role="group" aria-label="Demo">
          <button type="button" aria-pressed={mode === 'drill'} onClick={() => start('drill')}>
            Drill
          </button>
          <button type="button" aria-pressed={mode === 'transpose'} onClick={() => start('transpose')}>
            Transposition
          </button>
        </div>
      </div>
      {mode === 'drill' ? <DrillDemo key={run} run={run} emit={emit} onRestart={() => start('drill')} /> : <TransposeDemo key={run} run={run} emit={emit} />}
      <ol className="stages" aria-label="Pipeline stages">
        {STAGES.map((name, i) => {
          const s = stages[i as StageIndex];
          return (
            <li key={name} className={s ? (s.ok ? 'is-ok' : 'is-fail') : undefined}>
              <span className="stage-i">{i}</span> {name}
              <span className="stage-ms">{s ? `${s.ms < 1 ? '<1' : Math.round(s.ms)} ms` : ''}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
