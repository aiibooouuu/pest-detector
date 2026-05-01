export default function ImageCanvas({ src }) {
  return (
    <div className="image-wrap">
      <img src={src} alt="Detection result" className="result-image" />
      <div className="image-badge">Detection result</div>
    </div>
  );
}