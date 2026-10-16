import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, fechaHora, hoyIso } from '../api';

type Linea = {
  id: string;
  fecha: string;
  usuario: string;
  rol: string | null;
  origen: string;
  modulo: string;
  accion: string;
  detalle: string | null;
};

type Respuesta = {
  total: number;
  pagina: number;
  paginas: number;
  modulos: string[];
  usuarios: string[];
  filas: Linea[];
};

const roles: Record<string, string> = {
  Administrador: 'Administrador',
  Cajero: 'Caja',
  Consulta: 'Consulta',
  Socio: 'Socio',
};

// Acciones que la directiva suele querer ver resaltadas.
const sensibles = ['anulado', 'rechazado', 'corregido', 'contraseña incorrecta', 'inexistente', 'desactivado', 'dado de baja'];

export default function RegistroCambios() {
  const [desde, setDesde] = useState(hoyIso(-7));
  const [hasta, setHasta] = useState(hoyIso());
  const [modulo, setModulo] = useState('');
  const [usuario, setUsuario] = useState('');
  const [texto, setTexto] = useState('');
  const [buscado, setBuscado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const filtros = useCallback(() => {
    const q = new URLSearchParams({ desde, hasta });
    if (modulo) q.set('modulo', modulo);
    if (usuario) q.set('usuario', usuario);
    if (buscado.trim()) q.set('texto', buscado.trim());
    return q;
  }, [desde, hasta, modulo, usuario, buscado]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    const q = filtros();
    q.set('pagina', String(pagina));
    q.set('tamano', '50');
    api
      .get<Respuesta>(`/api/registro-cambios?${q}`)
      .then((r) => vigente && setDatos(r))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : 'No se pudo cargar.'))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [filtros, pagina]);

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    setPagina(1);
    setBuscado(texto);
  };

  const exportar = async () => {
    try {
      await api.descargar(`/api/registro-cambios/csv?${filtros()}`, `Registro_de_cambios_${desde}_a_${hasta}.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar.');
    }
  };

  const cambiar = (f: () => void) => {
    f();
    setPagina(1);
  };

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Registro de cambios</h1>
          <p className="bajada">
            Quién hizo qué y cuándo: cobros, anulaciones, pagos QR aprobados o rechazados, cierres de caja, cambios en deudas, socios, casetas y
            usuarios, e ingresos al sistema. Las líneas no se pueden editar ni borrar.
          </p>
        </div>
        <button className="boton secundario" onClick={() => void exportar()} disabled={!datos?.total}>
          Descargar Excel
        </button>
      </div>

      <form className="filtros" onSubmit={buscar}>
        <label className="campo">
          <span>Desde</span>
          <input type="date" value={desde} max={hasta} onChange={(e) => e.target.value && cambiar(() => setDesde(e.target.value))} />
        </label>
        <label className="campo">
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde} onChange={(e) => e.target.value && cambiar(() => setHasta(e.target.value))} />
        </label>
        <label className="campo">
          <span>Módulo</span>
          <select value={modulo} onChange={(e) => cambiar(() => setModulo(e.target.value))}>
            <option value="">Todos</option>
            {(datos?.modulos ?? []).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Usuario</span>
          <select value={usuario} onChange={(e) => cambiar(() => setUsuario(e.target.value))}>
            <option value="">Todos</option>
            {(datos?.usuarios ?? []).map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Buscar (caseta, recibo, socio…)</span>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: A-12" />
        </label>
        <div className="atajos">
          <button className="boton">Buscar</button>
        </div>
      </form>

      {error ? <div className="aviso error">{error}</div> : null}
      {cargando && !datos ? <p className="bajada">Cargando…</p> : null}

      {datos ? (
        <p className="bajada" style={{ marginBottom: 10 }}>
          {datos.total === 0
            ? 'No hay cambios registrados con esos filtros.'
            : `${datos.total.toLocaleString('es-BO')} ${datos.total === 1 ? 'línea' : 'líneas'} · las más recientes primero`}
        </p>
      ) : null}

      {datos?.filas.length ? (
        <table className="tabla registro">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Quién</th>
              <th>Qué hizo</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {datos.filas.map((l) => {
              const resaltar = sensibles.some((s) => l.accion.toLowerCase().includes(s));
              return (
                <tr key={l.id}>
                  <td className="sin-cortar">{fechaHora(l.fecha)}</td>
                  <td>
                    <strong>{l.usuario}</strong>
                    <div className="ayuda">
                      {[l.rol ? roles[l.rol] ?? l.rol : null, l.origen].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td>
                    <span className={resaltar ? 'chip rojo' : 'chip gris'}>{l.accion}</span>
                    <div className="ayuda">{l.modulo}</div>
                  </td>
                  <td className="detalle-cambio">{l.detalle ?? <span className="ayuda">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}

      {datos && datos.paginas > 1 ? (
        <div className="paginador">
          <button className="boton secundario" disabled={pagina <= 1 || cargando} onClick={() => setPagina((p) => p - 1)}>
            ‹ Anterior
          </button>
          <span>
            Página {datos.pagina} de {datos.paginas}
          </span>
          <button className="boton secundario" disabled={pagina >= datos.paginas || cargando} onClick={() => setPagina((p) => p + 1)}>
            Siguiente ›
          </button>
        </div>
      ) : null}
    </>
  );
}
