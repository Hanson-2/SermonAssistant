import scriptures from '../data/scriptures.json';

export const getScripture = (reference, version = 'exb') => {
  const passage = scriptures[reference];
  if (!passage) return `Scripture "${reference}" not found.`;
  return passage[version] || passage['exb'] || `Version "${version}" not available for "${reference}".`;
};

export const getAvailableReferences = () => Object.keys(scriptures);

export const getAvailableVersions = (reference) => {
  const passage = scriptures[reference];
  return passage ? Object.keys(passage) : [];
};
