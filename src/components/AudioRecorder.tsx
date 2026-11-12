import { useRef, useState } from 'react';
import { putAsset, assetURL } from '../lib/db';
import { uid } from '../lib/util';
import { IconMic, IconPlay, IconStop, IconTrash } from './Icons';

/** Record a custom voice clip (e.g. a family member's voice or a favourite sound). */
export function AudioRecorder({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const rec = useRef<MediaRecorder | null>(null);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false); // also covers the 15-second auto-stop
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        const id = uid('audio-');
        await putAsset(id, blob);
        // The old clip is kept: the editor may still be cancelled, and undo/snapshots may refer to it.
        onChange(id);
      };
      mr.start();
      rec.current = mr;
      setRecording(true);
      setTimeout(() => mr.state === 'recording' && mr.stop(), 15000);
    } catch {
      setError('Microphone not available. Check permissions.');
    }
  };

  const stop = () => {
    rec.current?.stop();
    setRecording(false);
  };

  const play = async () => {
    if (!value) return;
    const url = await assetURL(value);
    if (url) new Audio(url).play();
  };

  return (
    <div className="recorder">
      {!recording ? (
        <button className="btn" onClick={start}><IconMic /> {value ? 'Re-record' : 'Record voice'}</button>
      ) : (
        <button className="btn danger pulse" onClick={stop}><IconStop /> Stop</button>
      )}
      {value && !recording && (
        <>
          <button className="btn" onClick={play}><IconPlay /> Play</button>
          <button className="btn" onClick={() => onChange(undefined)}><IconTrash /> Remove</button>
        </>
      )}
      {error && <span className="error">{error}</span>}
    </div>
  );
}
