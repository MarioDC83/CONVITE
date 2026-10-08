export type FormaMesa = "cuadrada" | "rectangular" | "circular" | "ovalada"

export interface Restaurante {
  id: string
  nombre: string
  slug: string
  direccion: string | null
  ciudad: string | null
  telefono: string | null
  email: string | null
  timezone: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface RestauranteCreate {
  nombre: string
  slug: string
  direccion?: string | null
  ciudad?: string | null
  telefono?: string | null
  email?: string | null
  admin_nombre: string
  admin_email: string
  admin_password: string
}

export interface Zona {
  id: string
  restaurante_id: string
  nombre: string
  color: string | null
  orden: number
  created_at: string
  updated_at: string
}

export interface ZonaCreate {
  nombre: string
  color?: string | null
  orden?: number
}

export interface ZonaUpdate {
  nombre?: string
  color?: string | null
  orden?: number
}

export interface Mesa {
  id: string
  restaurante_id: string
  zona_id: string
  nombre: string
  capacidad: number
  capacidad_min: number
  capacidad_max: number
  forma: FormaMesa
  pos_x: number
  pos_y: number
  ancho: number
  alto: number
  rotacion: number
  activa: boolean
  created_at: string
  updated_at: string
}

export interface MesaCreate {
  zona_id: string
  nombre: string
  capacidad?: number
  capacidad_min?: number
  capacidad_max?: number
  forma?: FormaMesa
  pos_x?: number
  pos_y?: number
  ancho?: number
  alto?: number
  rotacion?: number
}

export interface MesaUpdate {
  zona_id?: string
  nombre?: string
  capacidad?: number
  capacidad_min?: number
  capacidad_max?: number
  forma?: FormaMesa
  activa?: boolean
}

export interface Plano {
  restaurante: Restaurante
  zonas: Zona[]
  mesas: Mesa[]
}

export interface PlanoMesaUpdate {
  id: string
  pos_x: number
  pos_y: number
  ancho: number
  alto: number
  rotacion: number
}

export interface Turno {
  id: string
  restaurante_id: string
  nombre: string
  hora_inicio: string
  hora_fin: string
  dias_semana: number[]
  duracion_reserva_minutos: number
  activo: boolean
  created_at: string
  updated_at: string
}

export interface TurnoCreate {
  nombre: string
  hora_inicio: string
  hora_fin: string
  dias_semana?: number[]
  duracion_reserva_minutos?: number
}

export interface TurnoUpdate {
  nombre?: string
  hora_inicio?: string
  hora_fin?: string
  dias_semana?: number[]
  duracion_reserva_minutos?: number
  activo?: boolean
}

export type EstadoReserva =
  | "pendiente"
  | "confirmada"
  | "sentada"
  | "finalizada"
  | "cancelada"
  | "no_show"

export type OrigenReserva = "manual" | "ia_n8n" | "google_calendar" | "web"

export interface Reserva {
  id: string
  restaurante_id: string
  turno_id: string | null
  fecha: string
  hora: string
  duracion_minutos: number
  num_personas: number
  cliente_nombre: string
  cliente_telefono: string | null
  cliente_email: string | null
  cliente_id: string | null
  estado: EstadoReserva
  origen: OrigenReserva
  notas: string | null
  mesas: Mesa[]
  encuesta_puntuacion: number | null
  encuesta_comentario: string | null
  created_at: string
  updated_at: string
}

export interface Cliente {
  id: string
  restaurante_id: string
  nombre: string
  telefono: string | null
  email: string | null
  vip: boolean
  alergenos_notas: string | null
  notas: string | null
  created_at: string
  updated_at: string
  total_reservas: number
  no_shows: number
  ultima_visita: string | null
  es_problematico: boolean
}

export interface ClienteUpdate {
  nombre?: string
  vip?: boolean
  alergenos_notas?: string | null
  notas?: string | null
}

export interface DiaEspecial {
  id: string
  restaurante_id: string
  fecha: string
  cerrado: boolean
  motivo: string | null
  created_at: string
  updated_at: string
}

export interface DiaEspecialCreate {
  fecha: string
  cerrado?: boolean
  motivo?: string | null
}

export interface Estadisticas {
  fecha_desde: string
  fecha_hasta: string
  total_reservas: number
  reservas_por_estado: Record<string, number>
  tasa_no_show: number
  ocupacion_por_turno: { turno_id: string; turno_nombre: string; total_reservas: number }[]
  ocupacion_por_dia_semana: { dia_semana: number; total_reservas: number }[]
  ocupacion_por_hora: { hora: number; total_reservas: number }[]
  mesas_mas_solicitadas: { mesa_id: string; mesa_nombre: string; total_reservas: number }[]
  ticket_estimado: number | null
  encuesta_media: number | null
  encuesta_respuestas: number
}

export interface ReservaCreate {
  cliente_nombre: string
  cliente_telefono?: string | null
  cliente_email?: string | null
  fecha: string
  turno_id: string
  hora: string
  num_personas: number
  notas?: string | null
  origen?: OrigenReserva
  mesa_ids: string[]
}

export type EstadoListaEspera = "esperando" | "ofrecida" | "confirmada" | "expirada" | "cancelada"

export interface ListaEspera {
  id: string
  restaurante_id: string
  turno_id: string
  fecha: string
  comensales: number
  cliente_nombre: string
  cliente_telefono: string | null
  cliente_email: string | null
  notas: string | null
  estado: EstadoListaEspera
  mesa_ofrecida: Mesa | null
  oferta_expira_en: string | null
  reserva_id: string | null
  created_at: string
  updated_at: string
}

export interface ListaEsperaCreate {
  turno_id: string
  fecha: string
  comensales: number
  cliente_nombre: string
  cliente_telefono?: string | null
  cliente_email?: string | null
  notas?: string | null
}

export interface ReservaWsEvent {
  type: "reserva_creada" | "reserva_actualizada" | "reserva_cancelada"
  reserva: Reserva
}

export type RolUsuario = "superadmin" | "admin" | "manager" | "staff"

export interface Usuario {
  id: string
  restaurante_id: string | null
  email: string
  nombre: string
  rol: RolUsuario
  activo: boolean
  created_at: string
  updated_at: string
}

export interface UsuarioCreate {
  email: string
  nombre: string
  rol: RolUsuario
  password: string
}

export interface UsuarioUpdate {
  nombre?: string
  rol?: RolUsuario
  activo?: boolean
  password?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  usuario: Usuario
}

export interface ApiKeyInfo {
  activa: boolean
  prefijo: string | null
  scopes: string[]
  creada_en: string | null
}

export interface ApiKeyCreada {
  valor: string
  info: ApiKeyInfo
}

export interface IntegracionesRead {
  api_key: ApiKeyInfo
  n8n_webhook_notificaciones_url: string | null
  google_calendar_conectado: boolean
  google_calendar_email: string | null
  recordatorio_horas_antes: number | null
}

export interface GoogleConectarUrl {
  url: string
}
