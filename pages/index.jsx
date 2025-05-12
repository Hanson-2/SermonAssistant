import Dashboard from '../components/Dashboard';

const sampleSermons = [
  { title: 'The Love of God', slides: ['God loves you.', 'John 3:16 explains it.'] },
  { title: 'The Creation Story', slides: ['God created everything.', 'Genesis 1:1 is the beginning.'] },
];

export default function Home() {
  return <Dashboard sermons={sampleSermons} />;
}
