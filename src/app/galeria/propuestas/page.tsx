import Link from 'next/link';

// El índice del banco de propuestas. No está enlazado desde la app; se entra a
// mano por /galeria/propuestas, igual que al resto de la galería.

const PROPUESTAS = [
  {
    ruta: '/galeria/propuestas/descanso',
    titulo: 'La pantalla del descanso',
    queEs: 'Qué estabas haciendo, un arco con el color del rango, cuánto te pasaste al terminar, y el compañero abajo cuando entrenas con otro.',
  },
  {
    ruta: '/galeria/propuestas/rango',
    titulo: 'El rango, de una sola fuente',
    queEs: 'El nombre, el fondo, la insignia y los colores salen de la racha con una sola función. Muestra, día por día, dónde la app de hoy se contradice.',
  },
  {
    ruta: '/galeria/propuestas/las-tres',
    titulo: 'Las tres que cuentan: decir cuál falta',
    queEs: 'En Mis marcas, la que falta ocupa su lugar en la lista y se carga desde ahí.',
  },
  {
    ruta: '/galeria/propuestas/calendario',
    titulo: 'El calendario: el día que cubrió una vida',
    queEs: 'El día que salvó una vida deja de verse como un día perdido: usa el mismo dibujo que la tira de Inicio.',
  },
  {
    ruta: '/galeria/propuestas/grafico-peso',
    titulo: 'El gráfico de peso, cuando la ventana queda vacía',
    queEs: 'Tocar «1 mes» con una sola anotación en ese mes ya no borra el gráfico con sus botones.',
  },
  {
    ruta: '/galeria/propuestas/quitar-el-punto',
    titulo: 'Quitar el punto del gimnasio: preguntar antes',
    queEs: 'El botón se vuelve la pregunta en su lugar, como «Terminar» en Inicio.',
  },
];

export default function Propuestas() {
  return (
    <main style={{ position: 'relative', zIndex: 1, maxWidth: 620, margin: '0 auto', padding: '18px 20px 70px' }}>
      <div className="titulo-pantalla" style={{ marginLeft: 0 }}>
        Galería · propuestas
      </div>
      <p style={{ color: 'var(--sub)', fontSize: 14, lineHeight: 1.5, margin: '0 0 22px' }}>
        Cada una está armada al lado de lo que hay hoy. La app no se toca hasta decidir.
      </p>
      {PROPUESTAS.map((p) => (
        <Link key={p.ruta} href={p.ruta} className="tarjeta" style={{ display: 'block' }}>
          <div style={{ fontSize: 17 }}>{p.titulo}</div>
          <div style={{ color: 'var(--sub)', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{p.queEs}</div>
        </Link>
      ))}
    </main>
  );
}
