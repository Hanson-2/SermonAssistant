import { useState } from 'react';
import ScriptureOverlay from './ScriptureOverlay';

export default function ScriptureBar({ references }) {
  const [activeRef, setActiveRef] = useState(null);

  return (
    <>
      <div className="flex gap-2 p-2 bg-gray-100 border-b">
        {references.map(ref => (
          <button key={ref} onClick={() => setActiveRef(ref)} className="bg-gray-200 px-3 py-1 rounded">
            {ref}
          </button>
        ))}
      </div>
      {activeRef && <ScriptureOverlay reference={activeRef} onClose={() => setActiveRef(null)} />}
    </>
  );
}
