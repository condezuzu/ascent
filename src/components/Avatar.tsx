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
        // <img> y no next/image: son URLs firmadas de Supabase que vencen en una hora, y el optimizador las cachearia vencidas.
        <img src={url} alt="" />
      ) : (
        <span>{(nombre ?? '?').charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}
