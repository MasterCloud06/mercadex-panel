import { useCallback, useEffect, useState } from 'react';
import { alVencerSesion, api, API_URL, ENTORNO, esAdministrador, guardarSesion, leerSesion, type PagoApp, type Sesion } from './api';
import Comprobantes from './paginas/Comprobantes';
import DatosPago from './paginas/DatosPago';
import Deudas from './paginas/Deudas';
import Ingreso from './paginas/Ingreso';
import RegistroCambios from './paginas/RegistroCambios';
import Reportes from './paginas/Reportes';
import Socios from './paginas/Socios';

type Seccion = 'comprobantes' | 'socios' | 'deudas' | 'datos' | 'reportes' | 'registro';

// soloAdmin: la directiva (usuario de consulta) ve solo reportes y registro de cambios.
const secciones: { id: Seccion; nombre: string; soloAdmin: boolean }[] = [
  { id: 'comprobantes', nombre: 'Comprobantes', soloAdmin: true },
  { id: 'socios', nombre: 'Socios y acceso', soloAdmin: true },
  { id: 'deudas', nombre: 'Deudas', soloAdmin: true },
  { id: 'datos', nombre: 'Datos de pago', soloAdmin: true },
  { id: 'reportes', nombre: 'Reportes', soloAdmin: false },
  { id: 'registro', nombre: 'Registro de cambios', soloAdmin: false },
];

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion());
  const [seccion, setSeccion] = useState<Seccion>(() => (sesion && !esAdministrador(sesion) ? 'reportes' : 'comprobantes'));
  const admin = sesion ? esAdministrador(sesion) : false;
  const visibles = secciones.filter((s) => admin || !s.soloAdmin);
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
    if (!sesion || !admin) return;
    void contarPendientes();
    const t = setInterval(() => void contarPendientes(), 60_000);
    return () => clearInterval(t);
  }, [sesion, admin, contarPendientes]);

  const franja = ENTORNO === 'desarrollo' ? <div className="franja-dev">Desarrollo · {API_URL.replace(/^https?:\/\//, '')}</div> : null;

  if (!sesion)
    return (
      <>
        {franja}
        <Ingreso
          alIngresar={(s) => {
            setSesion(s);
            setSeccion(esAdministrador(s) ? 'comprobantes' : 'reportes');
          }}
        />
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
              <div className="marca-sub">{admin ? 'Caja · App de socios' : 'Directiva · Consulta'}</div>
            </div>
          </div>
          <nav aria-label="Secciones">
            {visibles.map((s) => (
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
            Sesión: {sesion.nombre ?? sesion.usuario}
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
          {seccion === 'comprobantes' && admin ? <Comprobantes alCambiar={contarPendientes} /> : null}
          {seccion === 'socios' && admin ? <Socios /> : null}
          {seccion === 'deudas' && admin ? <Deudas /> : null}
          {seccion === 'datos' && admin ? <DatosPago /> : null}
          {seccion === 'reportes' ? <Reportes /> : null}
          {seccion === 'registro' ? <RegistroCambios /> : null}
        </main>
      </div>
    </>
  );
}
