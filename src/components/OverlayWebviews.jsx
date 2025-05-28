import React, { useState, useRef } from "react";

// Replace with your actual URLs or chat endpoint
const BIBLE_URL = "https://www.biblegateway.com/";

const OverlayWebviews = () => {
  const [overlay, setOverlay] = useState(null); // 'bible', or null

  // Persistent refs for iframes to keep their state
  const bibleIframeRef = useRef();

  // Utility: Only one overlay open at a time
  const openOverlay = (type) => setOverlay(type);
  const closeOverlay = () => setOverlay(null);

  // Accessibility: ESC to close
  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") closeOverlay();
    };
    if (overlay) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [overlay]);

  return (
    <>
      {/* NavBar Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => openOverlay("bible")}
        >
          BibleGateway
        </button>
      </div>

      {/* Overlays */}
      {/* Slide-down overlay (one at a time) */}
      <div
        className={`fixed left-0 top-0 w-full z-50 transition-transform duration-300 ${
          overlay ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{ height: "88vh" }}
        aria-modal={overlay ? "true" : undefined}
        role="dialog"
      >
        {overlay && (
          <div className="bg-black bg-opacity-80 w-full h-full flex flex-col relative shadow-2xl">
            {/* Close button */}
            <button
              onClick={closeOverlay}
              className="absolute top-3 right-5 text-white text-3xl z-50 hover:text-red-400"
              aria-label="Close overlay"
              tabIndex={0}
            >
              ×
            </button>

            {/* Render the requested iframe */}
            {overlay === "bible" && (
              <iframe
                ref={bibleIframeRef}
                title="BibleGateway"
                src={BIBLE_URL}
                className="w-full h-full rounded-b-lg border-0 bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default OverlayWebviews;
