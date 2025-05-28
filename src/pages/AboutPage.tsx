import React from 'react';
import './AboutPage.css'; // We'll create this CSS file next

const AboutPage: React.FC = () => {
  // Replace with your actual app information
  const appInfo = {
    name: 'Sermon Notes Assistant', // Replace with your app name
    version: '1.0.0', // Replace with your app version
    purpose: 'This application helps users create, manage, and organize sermon notes and related scripture references efficiently.', // Replace with your app's purpose
    author: 'Your Name/Company', // Replace with author/company
    license: 'MIT License', // Replace with your license
    contact: 'https://github.com/your-repo', // Replace with your support/GitHub link
  };

  return (
    <div className="about-page-container">
      <div className="about-page-content">
        <h1>About {appInfo.name}</h1>
        <p><strong>Version:</strong> {appInfo.version}</p>
        <p><strong>Purpose:</strong> {appInfo.purpose}</p>
        <p><strong>Author:</strong> {appInfo.author}</p>
        <p><strong>License:</strong> {appInfo.license}</p>
        <p>
          <strong>Support/Contribute:</strong>{' '}
          <a href={appInfo.contact} target="_blank" rel="noopener noreferrer">
            {appInfo.contact}
          </a>
        </p>
        <p className="mt-6">
          Thank you for using {appInfo.name}!
        </p>
      </div>
    </div>
  );
};

export default AboutPage;
