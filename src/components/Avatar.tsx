export default function Avatar({
  url,
  nombre,
  tam = 34,
}: {
  url: string | null;
  nombre: string | null;
  tam?: number;
}) {
  return (
    <div className="avatar" style={{ width: tam, height: tam }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        <span>{(nombre ?? '?').charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}
