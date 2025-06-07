import React, { useEffect, useState } from "react";
import "./../styles/splashScreen.css";
import logo from "/logo.png"; // Adjust path if needed

export default function SplashScreen({ onFinish }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 4500); // start exit before removal
    const finishTimer = setTimeout(() => onFinish(), 5000);     // remove after exit animation

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className={`splash-container${exiting ? " exit" : ""}`}>
      <div className="splash-content">
        <img
          src={logo}
          alt="Expository Notes Logo"
          className={`splash-logo${exiting ? " exit" : ""}`}
        />
        {/* Title removed for minimalist splash */}
      </div>
    </div>
  );
}
