export const API_URL: string = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5189').replace(/\/$/, '');
export const ENTORNO: 'desarrollo' | 'produccion' =
  import.meta.env.VITE_ENTORNO === 'produccion' ? 'produccion' : 'desarrollo';

const CLAVE = 'mercadex.panel.sesion';

export type Sesion = { token: string; usuario: string; expira: string };

// La sesión vive en sessionStorage: se borra al cerrar la pestaña,
// conveniente en computadoras compartidas de la caja.
export function leerSesion(): Sesion | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null') as Sesion | null;
    return s && new Date(s.expira).getTime() > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function guardarSesion(s: Sesion | null) {
  try {
    if (s) sessionStorage.setItem(CLAVE, JSON.stringify(s));
    else sessionStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: la sesión dura mientras la página esté abierta.
  }
}

let alExpirar: () => void = () => undefined;
export function alVencerSesion(f: () => void) {
  alExpirar = f;
}

async function solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown, comoBlob = false): Promise<T> {
  const sesion = leerSesion();
  let r: Response;
  try {
    r = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(sesion ? { Authorization: `Bearer ${sesion.token}` } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new Error(`No hay conexión con la API (${API_URL}). Revisa que esté encendida.`);
  }

  if (r.status === 401 && ruta !== '/api/auth/login') {
    guardarSesion(null);
    alExpirar();
    throw new Error('Tu sesión terminó. Vuelve a ingresar.');
  }

  if (!r.ok) {
    let mensaje = `No se pudo completar (error ${r.status}).`;
    if (r.status === 429) mensaje = 'Demasiados intentos. Espera unos minutos y vuelve a intentar.';
    try {
      const d = (await r.json()) as { mensaje?: string };
      if (d?.mensaje) mensaje = d.mensaje;
    } catch {
      // Respuesta sin cuerpo.
    }
    throw new Error(mensaje);
  }

  if (comoBlob) return (await r.blob()) as T;
  const texto = await r.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

export const api = {
  get: <T>(ruta: string) => solicitar<T>('GET', ruta),
  post: <T>(ruta: string, cuerpo: unknown = {}) => solicitar<T>('POST', ruta, cuerpo),
  put: <T>(ruta: string, cuerpo: unknown) => solicitar<T>('PUT', ruta, cuerpo),
  blob: (ruta: string) => solicitar<Blob>('GET', ruta, undefined, true),
};

export async function ingresar(usuario: string, password: string): Promise<Sesion> {
  const r = await api.post<{ token: string; usuario: string; expira: string }>('/api/auth/login', { usuario, password });
  const s = { token: r.token, usuario: r.usuario, expira: r.expira };
  guardarSesion(s);
  return s;
}

// ------------------------------------------------------------ Tipos

export type PagoApp = {
  id: string;
  socio: string;
  documento: string;
  caseta: string;
  bloque: string | null;
  moneda: string;
  monto: number;
  referencia: string;
  fecha: string;
  estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
  motivoRechazo: string | null;
  revisadoPor: string | null;
  numeroRecibo: number | null;
  deudas: string;
};

export type SocioPanel = {
  id: string;
  nombre: string;
  documento: string;
  telefono: string | null;
  casetas: string[];
  estadoApp: 'sin-acceso' | 'activa' | 'codigo-pendiente' | 'codigo-vencido';
  ultimoAcceso: string | null;
};

export type ConfiguracionPago = {
  banco: string | null;
  numeroCuenta: string | null;
  titularCuenta: string | null;
  instrucciones: string | null;
  tieneQr: boolean;
  qrBase64: string | null;
};

// ------------------------------------------------------------ Formato

const numero = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function dinero(monto: number, moneda: string) {
  return `${moneda === 'BOB' ? 'Bs' : moneda === 'USD' ? '$us' : moneda} ${numero.format(monto)}`;
}

const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Muestra la hora de Bolivia que envía el servidor (…-04:00). */
export function fechaHora(valor: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor);
  return m ? `${Number(m[3])} ${meses[Number(m[2]) - 1]} ${m[1]}, ${m[4]}:${m[5]}` : valor;
}
