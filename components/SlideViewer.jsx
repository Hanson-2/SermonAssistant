export default function SlideViewer({ slides }) {
    return (
      <div className="p-4">
        {slides.map((slide, index) => (
          <div key={index} className="mb-4 p-4 border rounded">
            <h3 className="text-lg font-bold mb-2">Slide {index + 1}</h3>
            <p>{slide}</p>
          </div>
        ))}
      </div>
    );
  }
  