import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, descargarCsv, dinero, fechaCorta, fechaHora, hoyIso, nombresMes, primeroDelMes } from '../api';

// Reportes para la directiva: lo mismo que ve la administración en
// Mercadex de escritorio, desde cualquier navegador y solo para consultar.

type Pestana = 'resumen' | 'ingresos' | 'deudores' | 'cierres';

const pestanas: { id: Pestana; nombre: string }[] = [
  { id: 'resumen', nombre: 'Resumen' },
  { id: 'ingresos', nombre: 'Ingresos y gastos' },
  { id: 'deudores', nombre: 'Deudores' },
  { id: 'cierres', nombre: 'Cierres de caja' },
];

export default function Reportes() {
  const [pestana, setPestana] = useState<Pestana>('resumen');

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Reportes</h1>
          <p className="bajada">
            Recaudación, deudas, gastos y cierres de caja al día. Los datos salen directo del sistema: no se pueden modificar desde aquí.
          </p>
        </div>
        <button className="boton secundario no-imprimir" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>

      <div className="pestanas no-imprimir" role="tablist">
        {pestanas.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={pestana === p.id}
            className={`pestana${pestana === p.id ? ' activa' : ''}`}
            onClick={() => setPestana(p.id)}>
            {p.nombre}
          </button>
        ))}
      </div>

      {pestana === 'resumen' ? <Resumen /> : null}
      {pestana === 'ingresos' ? <IngresosGastos /> : null}
      {pestana === 'deudores' ? <Deudores /> : null}
      {pestana === 'cierres' ? <Cierres /> : null}
    </>
  );
}

// ------------------------------------------------------------ Común

/** Fecha y hora en la zona de la computadora (el servidor envía UTC). */
function horaLocal(valor: string) {
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? valor
    : d.toLocaleString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function useCarga<T>(ruta: string | null) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!ruta) return;
    setCargando(true);
    setError(null);
    try {
      setDatos(await api.get<T>(ruta));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.');
    } finally {
      setCargando(false);
    }
  }, [ruta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { datos, error, cargando, cargar };
}

function Estado({ error, cargando, hay }: { error: string | null; cargando: boolean; hay: boolean }) {
  if (error) return <div className="aviso error">{error}</div>;
  if (cargando && !hay) return <p className="bajada">Cargando… (si el servidor estaba inactivo puede tardar hasta un minuto)</p>;
  return null;
}

function Indicador({ titulo, valor, nota, tono }: { titulo: string; valor: ReactNode; nota?: ReactNode; tono?: 'rojo' | 'verde' }) {
  return (
    <div className="indicador">
      <div className="indicador-titulo">{titulo}</div>
      <div className={`indicador-valor${tono ? ' ' + tono : ''}`}>{valor}</div>
      {nota ? <div className="ayuda">{nota}</div> : null}
    </div>
  );
}

function Periodo({
  desde,
  hasta,
  alCambiar,
  children,
}: {
  desde: string;
  hasta: string;
  alCambiar: (desde: string, hasta: string) => void;
  children?: ReactNode;
}) {
  const atajo = (d: string, h: string) => () => alCambiar(d, h);
  const mesAnterior = () => {
    const d = new Date();
    const ini = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const fin = new Date(d.getFullYear(), d.getMonth(), 0);
    const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    alCambiar(iso(ini), iso(fin));
  };

  return (
    <div className="filtros no-imprimir">
      <label className="campo">
        <span>Desde</span>
        <input type="date" value={desde} max={hasta} onChange={(e) => e.target.value && alCambiar(e.target.value, hasta)} />
      </label>
      <label className="campo">
        <span>Hasta</span>
        <input type="date" value={hasta} min={desde} onChange={(e) => e.target.value && alCambiar(desde, e.target.value)} />
      </label>
      <div className="atajos">
        <button className="boton secundario" onClick={atajo(hoyIso(), hoyIso())}>
          Hoy
        </button>
        <button className="boton secundario" onClick={atajo(primeroDelMes(), hoyIso())}>
          Este mes
        </button>
        <button className="boton secundario" onClick={mesAnterior}>
          Mes anterior
        </button>
        <button className="boton secundario" onClick={atajo(hoyIso().slice(0, 4) + '-01-01', hoyIso())}>
          Este año
        </button>
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Resumen

type Dashboard = {
  generado: string;
  unidades: { casetas: number; comedores: number; ambulantes: number; activas: number; conDeuda: number; alDia: number };
  recaudacion: { moneda: string; hoy: number; recibosHoy: number; mes: number; recibosMes: number; mesAnteriorMismoTramo: number }[];
  deuda: { moneda: string; total: number; obligaciones: number; casetas: number }[];
  mensual: { anio: number; mes: number; total: number; recibos: number }[];
  porConcepto: { concepto: string; total: number; pagos: number }[];
  antiguedad: { tramo: string; total: number; obligaciones: number }[];
  topDeudores: { caseta: string; bloque: string | null; total: number; obligaciones: number; desde: string }[];
  anulacionesMes: number;
  egresosMes: { moneda: string; total: number }[];
};

function Resumen() {
  const { datos: d, error, cargando } = useCarga<Dashboard>('/api/dashboard');

  if (!d) return <Estado error={error} cargando={cargando} hay={false} />;

  const bob = d.recaudacion.find((r) => r.moneda === 'BOB');
  const deudaBob = d.deuda.find((x) => x.moneda === 'BOB');
  const egresoBob = d.egresosMes.find((x) => x.moneda === 'BOB');
  const variacion =
    bob && bob.mesAnteriorMismoTramo > 0 ? Math.round(((bob.mes - bob.mesAnteriorMismoTramo) / bob.mesAnteriorMismoTramo) * 100) : null;
  const maximo = Math.max(1, ...d.mensual.map((m) => m.total));
  const maxConcepto = Math.max(1, ...d.porConcepto.map((c) => c.total));
  const mesActual = nombresMes[new Date().getMonth()];

  return (
    <>
      <p className="ayuda solo-imprimir">Generado el {fechaHora(d.generado)}</p>
      <div className="indicadores">
        <Indicador
          titulo={`Recaudado en ${mesActual}`}
          valor={dinero(bob?.mes ?? 0, 'BOB')}
          nota={
            <>
              {bob?.recibosMes ?? 0} recibos
              {variacion !== null ? ` · ${variacion >= 0 ? '+' : ''}${variacion}% que el mismo tramo del mes anterior` : ''}
            </>
          }
        />
        <Indicador titulo="Recaudado hoy" valor={dinero(bob?.hoy ?? 0, 'BOB')} nota={`${bob?.recibosHoy ?? 0} recibos`} />
        <Indicador
          titulo="Deuda pendiente"
          valor={dinero(deudaBob?.total ?? 0, 'BOB')}
          tono={(deudaBob?.total ?? 0) > 0 ? 'rojo' : undefined}
          nota={`${deudaBob?.casetas ?? 0} casetas · ${deudaBob?.obligaciones ?? 0} deudas`}
        />
        <Indicador
          titulo="Casetas al día"
          valor={`${d.unidades.alDia} de ${d.unidades.activas}`}
          tono="verde"
          nota={`${d.unidades.conDeuda} con deuda`}
        />
        <Indicador
          titulo={`Gastos de ${mesActual}`}
          valor={dinero(egresoBob?.total ?? 0, 'BOB')}
          nota={d.anulacionesMes ? `${d.anulacionesMes} recibos anulados este mes` : 'Sin recibos anulados este mes'}
        />
      </div>

      {d.recaudacion.some((r) => r.moneda !== 'BOB') || d.deuda.some((x) => x.moneda !== 'BOB') ? (
        <div className="aviso info">
          Otras monedas:{' '}
          {d.recaudacion
            .filter((r) => r.moneda !== 'BOB')
            .map((r) => `recaudado ${dinero(r.mes, r.moneda)} este mes`)
            .concat(d.deuda.filter((x) => x.moneda !== 'BOB').map((x) => `deuda ${dinero(x.total, x.moneda)}`))
            .join(' · ')}
        </div>
      ) : null}

      <div className="dos-columnas">
        <section className="tarjeta">
          <h2>Recaudación de los últimos 12 meses</h2>
          <p className="ayuda">En bolivianos, cobros válidos (sin anulados).</p>
          <div className="barras" role="img" aria-label="Recaudación mensual de los últimos 12 meses">
            {d.mensual.map((m) => (
              <div key={`${m.anio}-${m.mes}`} className="barra-col" title={`${nombresMes[m.mes - 1]} ${m.anio}: ${dinero(m.total, 'BOB')} (${m.recibos} recibos)`}>
                <div className="barra-valor">{m.total >= 1000 ? `${Math.round(m.total / 1000)}k` : Math.round(m.total)}</div>
                <div className="barra" style={{ height: `${Math.max(2, (m.total / maximo) * 100)}%` }} />
                <div className="barra-mes">{nombresMes[m.mes - 1].slice(0, 3)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <h2>Cobrado por concepto en {mesActual}</h2>
          <p className="ayuda">En bolivianos.</p>
          {d.porConcepto.length === 0 ? <p className="bajada">Todavía no hay cobros este mes.</p> : null}
          {d.porConcepto.map((c) => (
            <div key={c.concepto} className="fila-barra">
              <div className="fila-barra-texto">
                <span>{c.concepto}</span>
                <strong>{dinero(c.total, 'BOB')}</strong>
              </div>
              <div className="pista">
                <div className="relleno" style={{ width: `${(c.total / maxConcepto) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>

        <section className="tarjeta">
          <h2>Antigüedad de la deuda</h2>
          <p className="ayuda">Desde la fecha en que se cargó cada deuda. En bolivianos.</p>
          <table className="tabla simple">
            <tbody>
              {d.antiguedad.map((a) => (
                <tr key={a.tramo}>
                  <td>{a.tramo}</td>
                  <td className="numero">{a.obligaciones}</td>
                  <td className="numero">
                    <strong>{dinero(a.total, 'BOB')}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="tarjeta">
          <h2>Casetas con más deuda</h2>
          <p className="ayuda">La lista completa está en la pestaña Deudores.</p>
          {d.topDeudores.length === 0 ? <p className="bajada">Ninguna caseta tiene deuda.</p> : null}
          <table className="tabla simple">
            <tbody>
              {d.topDeudores.map((t) => (
                <tr key={t.caseta}>
                  <td>
                    <strong>{t.caseta}</strong>
                    {t.bloque ? <div className="ayuda">Bloque {t.bloque}</div> : null}
                  </td>
                  <td className="ayuda">desde {fechaCorta(t.desde)}</td>
                  <td className="numero">
                    <strong>{dinero(t.total, 'BOB')}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

// ------------------------------------------------------------ Ingresos y gastos

type Informe = {
  desde: string;
  hasta: string;
  generado: string;
  monedas: {
    moneda: string;
    recibos: number;
    ingresos: { concepto: string; cantidad: number; total: number }[];
    totalIngresos: number;
    egresos: { categoria: string; cantidad: number; total: number }[];
    totalEgresos: number;
    saldo: number;
  }[];
};

function IngresosGastos() {
  const [desde, setDesde] = useState(primeroDelMes());
  const [hasta, setHasta] = useState(hoyIso());
  const { datos, error, cargando } = useCarga<Informe>(`/api/informes/ingresos-gastos?desde=${desde}&hasta=${hasta}`);

  const exportar = () => {
    if (!datos) return;
    const filas: (string | number)[][] = [[`Ingresos y gastos del ${fechaCorta(datos.desde)} al ${fechaCorta(datos.hasta)}`], []];
    for (const m of datos.monedas) {
      filas.push([`Moneda ${m.moneda}`], ['Tipo', 'Concepto o categoría', 'Cantidad', 'Monto']);
      m.ingresos.forEach((i) => filas.push(['Ingreso', i.concepto, String(i.cantidad), i.total]));
      filas.push(['', 'Total ingresos', '', m.totalIngresos]);
      m.egresos.forEach((e) => filas.push(['Gasto', e.categoria, String(e.cantidad), e.total]));
      filas.push(['', 'Total gastos', '', m.totalEgresos], ['', 'Saldo', '', m.saldo], []);
    }
    descargarCsv(`Ingresos_y_gastos_${datos.desde}_a_${datos.hasta}.csv`, filas);
  };

  return (
    <>
      <Periodo
        desde={desde}
        hasta={hasta}
        alCambiar={(d, h) => {
          setDesde(d);
          setHasta(h);
        }}>
        <button className="boton secundario" disabled={!datos?.monedas.length} onClick={exportar}>
          Descargar Excel
        </button>
      </Periodo>

      <h2 className="solo-imprimir">
        Ingresos y gastos del {fechaCorta(desde)} al {fechaCorta(hasta)}
      </h2>
      <Estado error={error} cargando={cargando} hay={!!datos} />

      {datos && datos.monedas.length === 0 ? (
        <div className="tarjeta vacio">
          <strong>Sin movimientos</strong>
          No hubo cobros ni gastos en ese período.
        </div>
      ) : null}

      {datos?.monedas.map((m) => (
        <section key={m.moneda} className="tarjeta bloque-informe">
          <div className="indicadores">
            <Indicador titulo="Ingresos" valor={dinero(m.totalIngresos, m.moneda)} nota={`${m.recibos} recibos`} />
            <Indicador titulo="Gastos" valor={dinero(m.totalEgresos, m.moneda)} />
            <Indicador titulo="Saldo" valor={dinero(m.saldo, m.moneda)} tono={m.saldo < 0 ? 'rojo' : 'verde'} />
          </div>
          <div className="dos-columnas">
            <div>
              <h2>Ingresos por concepto</h2>
              <table className="tabla simple">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th className="numero">Cobros</th>
                    <th className="numero">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {m.ingresos.map((i) => (
                    <tr key={i.concepto}>
                      <td>{i.concepto}</td>
                      <td className="numero">{i.cantidad}</td>
                      <td className="numero">{dinero(i.total, m.moneda)}</td>
                    </tr>
                  ))}
                  {m.ingresos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="ayuda">
                        Sin cobros
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div>
              <h2>Gastos por categoría</h2>
              <table className="tabla simple">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th className="numero">Gastos</th>
                    <th className="numero">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {m.egresos.map((e) => (
                    <tr key={e.categoria}>
                      <td>{e.categoria}</td>
                      <td className="numero">{e.cantidad}</td>
                      <td className="numero">{dinero(e.total, m.moneda)}</td>
                    </tr>
                  ))}
                  {m.egresos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="ayuda">
                        Sin gastos
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

// ------------------------------------------------------------ Deudores

type Deudores = {
  casetas: number;
  deudas: number;
  totales: { moneda: string; monto: number }[];
  filas: {
    unidadId: string;
    codigo: string;
    bloque: string | null;
    pasillo: string | null;
    titular: string | null;
    telefono: string | null;
    servicios: string[];
    cantidad: number;
    desde: string;
    totales: { moneda: string; monto: number }[];
  }[];
};

function Deudores() {
  const [bloque, setBloque] = useState('');
  const [filtro, setFiltro] = useState('');
  const { datos, error, cargando, cargar } = useCarga<Deudores>(
    `/api/reportes/deudores${bloque.trim() ? `?bloque=${encodeURIComponent(bloque.trim())}` : ''}`,
  );

  const texto = filtro.trim().toLowerCase();
  const filas = (datos?.filas ?? []).filter(
    (f) => !texto || f.codigo.toLowerCase().includes(texto) || (f.titular ?? '').toLowerCase().includes(texto),
  );

  const exportar = () => {
    if (!datos) return;
    descargarCsv(`Deudores_${hoyIso()}.csv`, [
      ['Caseta', 'Bloque', 'Pasillo', 'Titular', 'Teléfono', 'Servicios', 'Deudas', 'Debe desde', 'Total Bs', 'Total $us'],
      ...filas.map((f) => [
        f.codigo,
        f.bloque ?? '',
        f.pasillo ?? '',
        f.titular ?? '',
        f.telefono ?? '',
        f.servicios.join(', '),
        String(f.cantidad),
        fechaCorta(f.desde),
        f.totales.find((t) => t.moneda === 'BOB')?.monto ?? 0,
        f.totales.find((t) => t.moneda === 'USD')?.monto ?? 0,
      ]),
    ]);
  };

  return (
    <>
      <div className="filtros no-imprimir">
        <label className="campo">
          <span>Bloque</span>
          <input value={bloque} onChange={(e) => setBloque(e.target.value)} placeholder="Todos" style={{ width: 110 }} />
        </label>
        <label className="campo">
          <span>Buscar caseta o titular</span>
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Ej.: A-12" />
        </label>
        <div className="atajos">
          <button className="boton secundario" onClick={() => void cargar()}>
            Actualizar
          </button>
          <button className="boton secundario" disabled={!filas.length} onClick={exportar}>
            Descargar Excel
          </button>
        </div>
      </div>

      <h2 className="solo-imprimir">Lista de deudores al {fechaCorta(hoyIso())}</h2>
      <Estado error={error} cargando={cargando} hay={!!datos} />

      {datos ? (
        <div className="indicadores">
          <Indicador titulo="Casetas con deuda" valor={datos.casetas} />
          <Indicador titulo="Deudas pendientes" valor={datos.deudas} />
          {datos.totales.map((t) => (
            <Indicador key={t.moneda} titulo={`Total adeudado (${t.moneda})`} valor={dinero(t.monto, t.moneda)} tono="rojo" />
          ))}
        </div>
      ) : null}

      {datos && filas.length === 0 ? (
        <div className="tarjeta vacio">
          <strong>Sin deudores</strong>
          {texto || bloque ? 'Ninguna caseta coincide con el filtro.' : 'Todas las casetas están al día.'}
        </div>
      ) : null}

      {filas.length ? (
        <table className="tabla">
          <thead>
            <tr>
              <th>Caseta</th>
              <th>Titular</th>
              <th>Servicios que debe</th>
              <th>Debe desde</th>
              <th className="numero">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.unidadId}>
                <td>
                  <strong>{f.codigo}</strong>
                  <div className="ayuda">{[f.bloque ? `Bloque ${f.bloque}` : null, f.pasillo].filter(Boolean).join(' · ')}</div>
                </td>
                <td>
                  {f.titular ?? <span className="ayuda">Sin titular</span>}
                  {f.telefono ? <div className="ayuda">Tel. {f.telefono}</div> : null}
                </td>
                <td>
                  {f.servicios.join(', ')}
                  <div className="ayuda">
                    {f.cantidad} {f.cantidad === 1 ? 'deuda' : 'deudas'}
                  </div>
                </td>
                <td>{fechaCorta(f.desde)}</td>
                <td className="numero">
                  {f.totales.map((t) => (
                    <div key={t.moneda}>
                      <strong>{dinero(t.monto, t.moneda)}</strong>
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------ Cierres de caja

type Cierre = {
  id: string;
  fecha: string;
  moneda: string;
  total: number;
  efectivo: number;
  qr: number;
  otros: number;
  cantidadPagos: number;
  egresosEfectivo: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  responsable: string;
  observacion: string | null;
  fechaRegistro: string;
  cajaNombre?: string;
  esCajaGeneral?: boolean;
};

function Cierres() {
  const [desde, setDesde] = useState(hoyIso(-30));
  const [hasta, setHasta] = useState(hoyIso());
  const { datos, error, cargando } = useCarga<Cierre[]>(`/api/arqueo-diario/cierres?desde=${desde}&hasta=${hasta}`);

  const conDiferencia = (datos ?? []).filter((c) => c.diferencia !== 0);
  const caja = (c: Cierre) => (c.esCajaGeneral === false ? c.cajaNombre ?? c.responsable : 'Caja general');

  const exportar = () => {
    if (!datos) return;
    descargarCsv(`Cierres_de_caja_${desde}_a_${hasta}.csv`, [
      ['Fecha', 'Caja', 'Moneda', 'Efectivo', 'QR', 'Otros', 'Total', 'Gastos en efectivo', 'Debía haber', 'Contado', 'Diferencia', 'Responsable', 'Observación'],
      ...datos.map((c) => [
        fechaCorta(c.fecha),
        caja(c),
        c.moneda,
        c.efectivo,
        c.qr,
        c.otros,
        c.total,
        c.egresosEfectivo,
        c.efectivoEsperado,
        c.efectivoContado,
        c.diferencia,
        c.responsable,
        c.observacion ?? '',
      ]),
    ]);
  };

  return (
    <>
      <Periodo
        desde={desde}
        hasta={hasta}
        alCambiar={(d, h) => {
          setDesde(d);
          setHasta(h);
        }}>
        <button className="boton secundario" disabled={!datos?.length} onClick={exportar}>
          Descargar Excel
        </button>
      </Periodo>

      <h2 className="solo-imprimir">
        Cierres de caja del {fechaCorta(desde)} al {fechaCorta(hasta)}
      </h2>
      <Estado error={error} cargando={cargando} hay={!!datos} />

      {datos?.length ? (
        <div className={`aviso ${conDiferencia.length ? 'error' : 'ok'}`}>
          {conDiferencia.length
            ? `${conDiferencia.length} ${conDiferencia.length === 1 ? 'cierre tiene' : 'cierres tienen'} diferencia de efectivo. Revisa la observación de cada uno.`
            : 'Todos los cierres del período cuadran: el efectivo contado coincide con lo que debía haber.'}
        </div>
      ) : null}

      {datos && datos.length === 0 ? (
        <div className="tarjeta vacio">
          <strong>Sin cierres</strong>
          No se registraron cierres de caja en ese período.
        </div>
      ) : null}

      {datos?.length ? (
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Caja</th>
              <th className="numero">Recaudado</th>
              <th className="numero">Debía haber en efectivo</th>
              <th className="numero">Contado</th>
              <th className="numero">Diferencia</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((c) => (
              <tr key={c.id}>
                <td>
                  {fechaCorta(c.fecha)}
                  <div className="ayuda">Cerró {horaLocal(c.fechaRegistro)}</div>
                </td>
                <td>
                  {caja(c)}
                  <div className="ayuda">{c.responsable}</div>
                </td>
                <td className="numero">
                  {dinero(c.total, c.moneda)}
                  <div className="ayuda">{c.cantidadPagos} cobros</div>
                </td>
                <td className="numero">
                  {dinero(c.efectivoEsperado, c.moneda)}
                  {c.egresosEfectivo ? <div className="ayuda">gastos {dinero(c.egresosEfectivo, c.moneda)}</div> : null}
                </td>
                <td className="numero">{dinero(c.efectivoContado, c.moneda)}</td>
                <td className="numero">
                  {c.diferencia === 0 ? (
                    <span className="chip verde">Cuadra</span>
                  ) : (
                    <span className="chip rojo">
                      {c.diferencia > 0 ? 'Sobra ' : 'Falta '}
                      {dinero(Math.abs(c.diferencia), c.moneda)}
                    </span>
                  )}
                </td>
                <td>{c.observacion ?? <span className="ayuda">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
