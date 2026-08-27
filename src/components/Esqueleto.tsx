/**
 * El armazón de una pantalla mientras llegan los datos.
 *
 * `/yo` y `/album` devolvían un `<div>` vacío mientras cargaban: pantalla
 * negra, sin una señal de que algo estaba pasando. En una conexión lenta —o
 * en el subsuelo de un gimnasio— eso no se lee como "cargando", se lee como
 * "se rompió", y la reacción es cerrar y volver a abrir.
 *
 * No es una animación de carga dando vueltas: es la FORMA de lo que va a
 * aparecer. Así el salto de esto al contenido real no mueve nada de lugar, y
 * de paso promete lo correcto —"acá va tu foto y tu nombre"— en vez de
 * prometer solo "esperá".
 */
export default function Esqueleto({ como }: { como: 'perfil' | 'grilla' }) {
  if (como === 'perfil') {
    return (
      <div className="esqueleto" aria-hidden>
        <div className="esq-cabecera">
          <div className="esq-foto" />
          <div style={{ flex: 1 }}>
            <div className="esq-linea" style={{ width: '55%', height: 20 }} />
            <div className="esq-linea" style={{ width: '35%', height: 12, marginTop: 10 }} />
          </div>
        </div>
        <div className="esq-linea" style={{ height: 64, marginTop: 26, borderRadius: 2 }} />
        <div className="esq-linea" style={{ width: '40%', height: 12, marginTop: 26 }} />
        <div className="esq-grilla" style={{ marginTop: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="esq-celda" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="esqueleto" aria-hidden>
      <div className="esq-grilla">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="esq-celda" />
        ))}
      </div>
    </div>
  );
}
