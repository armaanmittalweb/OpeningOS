import { useEffect, useRef, useState } from 'react';
import { generatePhrase, validatePhrase, type Remote } from '../lib/sync';
import { store, type AppData } from '../lib/store';
import { link, loadMeta, resolve, saveMeta, SYNC_URL, syncNow, unlink, type SyncMeta } from './syncFlow';

type View = { v: 'loading' } | { v: 'off' } | { v: 'new'; phrase: string } | { v: 'enter' } | { v: 'linked'; meta: SyncMeta } | { v: 'conflict'; meta: SyncMeta; remote: Remote; first?: boolean };

function when(ms: number) {
  return ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never';
}

export default function SyncDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<View>({ v: 'loading' });
  const [phraseInput, setPhraseInput] = useState('');
  const [written, setWritten] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    void loadMeta().then((m) => setView(m ? { v: 'linked', meta: m } : { v: 'off' }));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Sync failed.' });
    } finally {
      setBusy(false);
    }
  };

  const doSync = (meta: SyncMeta) =>
    run(async () => {
      const r = await syncNow(meta);
      if (r.kind === 'conflict') setView({ v: 'conflict', meta: r.meta, remote: r.remote });
      else {
        setView({ v: 'linked', meta: r.meta });
        setMsg({ tone: 'ok', text: r.kind === 'pushed' ? 'Uploaded this device’s data.' : r.kind === 'pulled' ? 'Downloaded the latest data from your other device.' : 'Already up to date.' });
      }
    });

  const linkWith = (phrase: string) =>
    run(async () => {
      const { meta, remote } = await link(phrase);
      await saveMeta(meta);
      if (remote && store.get().data.lines.length) setView({ v: 'conflict', meta, remote, first: true });
      else if (remote) setView({ v: 'linked', meta: await resolve.useOtherDevice(meta, remote) });
      else await doSync(meta);
    });

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(store.get().data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `openingos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppData;
      if (data?.v !== 1 || !Array.isArray(data.lines)) throw new Error();
      store.replaceData({ ...data, updatedAt: Date.now() });
      setMsg({ tone: 'ok', text: `Restored ${data.lines.length} lines and ${data.games.length} games.` });
    } catch {
      setMsg({ tone: 'err', text: 'That file is not an OpeningOS backup.' });
    }
  };

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="sync-title" onClose={onClose} onCancel={onClose}>
      <div className="dialog-head">
        <h2 id="sync-title" className="title">
          Sync and backup
        </h2>
        <button type="button" className="link" onClick={() => ref.current?.close()}>
          Close
        </button>
      </div>
      <p className="lede">Everything lives in this browser. Sync is optional: a six-word phrase links your devices, with no account. Your data is encrypted with the phrase before it leaves the device.</p>

      <div className="block">
        <h3 className="label">Sync</h3>
        {!SYNC_URL && <p className="meta">No sync server is configured for this build (set VITE_SYNC_URL). Backups below still work.</p>}
        {SYNC_URL && view.v === 'loading' && <p className="meta">Loading…</p>}
        {SYNC_URL && view.v === 'off' && (
          <div className="row">
            <button type="button" className="btn btn-ink" onClick={() => setView({ v: 'new', phrase: generatePhrase() })}>
              Create a sync phrase
            </button>
            <button type="button" className="link" onClick={() => setView({ v: 'enter' })}>
              I have a phrase
            </button>
          </div>
        )}
        {view.v === 'new' && (
          <>
            <ol className="phrase" aria-label="Your sync phrase">
              {view.phrase.split(' ').map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ol>
            <p className="meta">Write these six words down. They are the only way to reach your synced data, and nobody can recover them for you.</p>
            <label className="check">
              <input type="checkbox" checked={written} onChange={(e) => setWritten(e.target.checked)} /> I have written the phrase down
            </label>
            <div className="row">
              <button type="button" className="btn btn-ink" disabled={!written || busy} onClick={() => void linkWith(view.phrase)}>
                Link this device
              </button>
              <button type="button" className="link" onClick={() => void navigator.clipboard?.writeText(view.phrase)}>
                Copy phrase
              </button>
            </div>
          </>
        )}
        {view.v === 'enter' && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const r = validatePhrase(phraseInput);
              if (!r.ok) setMsg({ tone: 'err', text: r.error });
              else void linkWith(r.phrase);
            }}
          >
            <label htmlFor="phrase-input" className="meta">
              Enter the six words from your other device
            </label>
            <input id="phrase-input" className="input" autoComplete="off" spellCheck={false} value={phraseInput} onChange={(e) => setPhraseInput(e.target.value)} />
            <div className="row">
              <button type="submit" className="btn btn-ink" disabled={busy}>
                Link this device
              </button>
              <button type="button" className="link" onClick={() => setView({ v: 'off' })}>
                Cancel
              </button>
            </div>
          </form>
        )}
        {view.v === 'linked' && (
          <>
            <p>
              Linked. Last synced {when(view.meta.syncedAt)}
              {view.meta.version ? `, version ${view.meta.version}` : ''}.
            </p>
            <div className="row">
              <button type="button" className="btn btn-ink" disabled={busy} onClick={() => void doSync(view.meta)}>
                {busy ? 'Syncing…' : 'Sync now'}
              </button>
              <button type="button" className="link" onClick={() => void run(async () => (await unlink(false, view.meta), setView({ v: 'off' })))}>
                Unlink this device
              </button>
              <button type="button" className="link" onClick={() => void run(async () => (await unlink(true, view.meta), setView({ v: 'off' })))}>
                Delete the synced copy
              </button>
            </div>
          </>
        )}
        {view.v === 'conflict' && (
          <>
            <p>
              <strong>{view.first ? 'This phrase already has synced data.' : 'Another device synced since this one did.'}</strong> Choose which copy to keep; the other is replaced.
            </p>
            <div className="row">
              <button type="button" className="btn btn-ink" disabled={busy} onClick={() => void run(async () => setView({ v: 'linked', meta: await resolve.useOtherDevice(view.meta, view.remote) }))}>
                Use the synced copy
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void run(async () => setView({ v: 'linked', meta: await resolve.keepThisDevice(view.meta, view.remote) }))}>
                Keep this device’s data
              </button>
            </div>
          </>
        )}
      </div>

      <div className="block">
        <h3 className="label">Backup</h3>
        <div className="row">
          <button type="button" className="btn" onClick={exportBackup}>
            Download backup
          </button>
          <label className="btn">
            Restore from file
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importBackup(f);
              }}
            />
          </label>
        </div>
      </div>
      <p className={`status ${msg?.tone === 'err' ? 'is-error' : ''}`} role="status">
        {msg?.text ?? ''}
      </p>
    </dialog>
  );
}
