import { useCallback, useEffect, useState } from 'react';
import { alVencerSesion, api, API_URL, ENTORNO, guardarSesion, leerSesion, type PagoApp, type Sesion } from './api';
import Comprobantes from './paginas/Comprobantes';
import DatosPago from './paginas/DatosPago';
import Ingreso from './paginas/Ingreso';
import Socios from './paginas/Socios';

type Seccion = 'comprobantes' | 'socios' | 'datos';

const secciones: { id: Seccion; nombre: string }[] = [
  { id: 'comprobantes', nombre: 'Comprobantes' },
  { id: 'socios', nombre: 'Socios y acceso' },
  { id: 'datos', nombre: 'Datos de pago' },
];

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion());
  const [seccion, setSeccion] = useState<Seccion>('comprobantes');
  const [pendientes, setPendientes] = useState<number | null>(null);

  useEffect(() => alVencerSesion(() => setSesion(null)), []);

  const contarPendientes = useCallback(async () => {
    try {
      setPendientes((await api.get<PagoApp[]>('/api/panel/pagos?estado=pendiente')).length);
    } catch {
      setPendientes(null);
    }
  }, []);

  // El contador se actualiza solo cada minuto.
  useEffect(() => {
    if (!sesion) return;
    void contarPendientes();
    const t = setInterval(() => void contarPendientes(), 60_000);
    return () => clearInterval(t);
  }, [sesion, contarPendientes]);

  const franja = ENTORNO === 'desarrollo' ? <div className="franja-dev">Desarrollo · {API_URL.replace(/^https?:\/\//, '')}</div> : null;

  if (!sesion)
    return (
      <>
        {franja}
        <Ingreso alIngresar={setSesion} />
      </>
    );

  return (
    <>
      {franja}
      <div className={`app${franja ? ' con-franja' : ''}`}>
        <aside className="menu">
          <div className="marca">
            <div className="sello">M</div>
            <div>
              <div className="marca-nombre">Mercadex</div>
              <div className="marca-sub">Caja · App de socios</div>
            </div>
          </div>
          <nav aria-label="Secciones">
            {secciones.map((s) => (
              <button
                key={s.id}
                className={`opcion${seccion === s.id ? ' activa' : ''}`}
                aria-current={seccion === s.id ? 'page' : undefined}
                onClick={() => setSeccion(s.id)}>
                {s.nombre}
                {s.id === 'comprobantes' && pendientes ? <span className="contador" aria-label={`${pendientes} por revisar`}>{pendientes}</span> : null}
              </button>
            ))}
          </nav>
          <div className="pie-menu">
            Sesión: {sesion.usuario}
            <br />
            <button
              onClick={() => {
                guardarSesion(null);
                setSesion(null);
              }}>
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="contenido">
          {seccion === 'comprobantes' ? <Comprobantes alCambiar={contarPendientes} /> : null}
          {seccion === 'socios' ? <Socios /> : null}
          {seccion === 'datos' ? <DatosPago /> : null}
        </main>
      </div>
    </>
  );
}
