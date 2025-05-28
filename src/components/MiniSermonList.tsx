import React, { useEffect, useState } from 'react';
import { fetchSermons } from '../services/firebaseService';
import SermonCard, { Sermon } from '../components/SermonCard/SermonCard';
import '../styles/edit-expository.css';

export default function MiniSermonList() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchSermons().then((data) => {
      setSermons(data);
      setLoading(false);
    });
  }, []);
  return (
    <div className='mini-sermon-list-scroll'>
      {loading && <div className='mini-sermon-list-placeholder'>Loading sermons...</div>}
      {!loading && sermons.length === 0 && <div className='mini-sermon-list-placeholder'>No expositories found.</div>}
      {sermons.map((sermon) => (
        <div key={sermon.id} className='mini-sermon-card'><SermonCard sermon={sermon} hideActions /></div>
      ))}
    </div>
  );
}
