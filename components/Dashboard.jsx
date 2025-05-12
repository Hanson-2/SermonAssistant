import Link from 'next/link';

export default function Dashboard({ sermons }) {
  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Sermon Dashboard</h1>
      <ul>
        {sermons.map((sermon, index) => (
          <li key={index} className="mb-2">
            <Link href={`/sermon/${index}`} className="text-blue-500 underline">{sermon.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
