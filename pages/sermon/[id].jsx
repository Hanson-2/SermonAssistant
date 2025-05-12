import { useRouter } from 'next/router';
import SlideViewer from '../../components/SlideViewer';
import ScriptureBar from '../../components/ScriptureBar';

const sampleSermons = [
  { title: 'The Love of God', slides: ['God loves you.', 'John 3:16 explains it.'], scriptures: ['John 3:16'] },
  { title: 'The Creation Story', slides: ['God created everything.', 'Genesis 1:1 is the beginning.'], scriptures: ['Genesis 1:1'] },
];

export default function SermonView() {
  const router = useRouter();
  const { id } = router.query;
  const sermon = sampleSermons[parseInt(id)];

  if (!sermon) return <div>Loading...</div>;

  return (
    <div>
      <ScriptureBar references={sermon.scriptures} />
      <SlideViewer slides={sermon.slides} />
    </div>
  );
}
