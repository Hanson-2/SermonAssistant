import { useState } from 'react';
import { getVerse as getScripture } from '../services/FirebaseService';


export default function ScriptureOverlay({ reference, onClose }) {
  const [version, setVersion] = useState('exb');
  const versions = getAvailableVersions(reference);
  const text = getScripture(reference, version);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded shadow max-w-xl w-full">
        <h2 className="text-xl mb-4">{reference} ({version.toUpperCase()})</h2>
        <p className="mb-4">{text}</p>
        <div className="mb-4">
          <select value={version} onChange={(e) => setVersion(e.target.value)} className="border p-1 rounded">
            {versions.map((v) => <option key={v} value={v}>{v.toUpperCase()}</option>)}
          </select>
        </div>
        <button onClick={onClose} className="bg-blue-500 text-white px-4 py-2 rounded">Close</button>
      </div>
    </div>
  );
}
