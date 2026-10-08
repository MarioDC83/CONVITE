/*!
 * Convite — widget de reservas embebible.
 * Uso:
 *   <script src="https://TU-DOMINIO/widget.js" defer></script>
 *   <convite-reservas
 *     restaurante-id="uuid-del-restaurante"
 *     api-key="cvt_live_..."
 *     api-base="https://api.tu-dominio.com/api/v1"
 *   ></convite-reservas>
 *
 * Todo el DOM y los estilos viven dentro de un Shadow DOM (mode: "open")
 * para que ni el CSS del sitio anfitrión afecte al widget, ni al revés.
 * Solo habla con los endpoints públicos de disponibilidad/turnos/reservas,
 * autenticado con la X-API-Key del restaurante (nunca JWT de personal).
 */
(function () {
  "use strict";

  const TAG = "convite-reservas";
  if (customElements.get(TAG)) return;

  const API_BASE_POR_DEFECTO = "http://localhost:8000/api/v1";

  const ESTILOS = `
    :host {
      all: initial;
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color-scheme: light;
      --cvt-bg: #ffffff;
      --cvt-bg-suave: #f7f5f2;
      --cvt-borde: #e2ddd4;
      --cvt-texto: #201c16;
      --cvt-texto-suave: #6b6255;
      --cvt-acento: #8a6d3b;
      --cvt-acento-hover: #6f5730;
      --cvt-error: #b3261e;
      --cvt-radio: 10px;
    }
    * { box-sizing: border-box; }
    .cvt {
      background: var(--cvt-bg);
      border: 1px solid var(--cvt-borde);
      border-radius: var(--cvt-radio);
      padding: 24px;
      max-width: 420px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .cvt h3 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 600;
      color: var(--cvt-texto);
      letter-spacing: 0.01em;
    }
    .cvt p.sub {
      margin: 0 0 18px;
      font-size: 13px;
      color: var(--cvt-texto-suave);
    }
    .cvt label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--cvt-texto-suave);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 14px 0 6px;
    }
    .cvt label:first-of-type { margin-top: 0; }
    .cvt input, .cvt select {
      width: 100%;
      padding: 10px 12px;
      font-size: 14px;
      border: 1px solid var(--cvt-borde);
      border-radius: 8px;
      background: var(--cvt-bg-suave);
      color: var(--cvt-texto);
      font-family: inherit;
    }
    .cvt input:focus, .cvt select:focus {
      outline: 2px solid var(--cvt-acento);
      outline-offset: 1px;
    }
    .cvt .fila-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .cvt button {
      margin-top: 20px;
      width: 100%;
      padding: 11px 16px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      background: var(--cvt-acento);
      color: #fff;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s ease;
    }
    .cvt button:hover:not(:disabled) { background: var(--cvt-acento-hover); }
    .cvt button:disabled { opacity: 0.55; cursor: not-allowed; }
    .cvt button.secundario {
      background: transparent;
      color: var(--cvt-texto-suave);
      border: 1px solid var(--cvt-borde);
      margin-top: 8px;
    }
    .cvt button.secundario:hover:not(:disabled) { background: var(--cvt-bg-suave); }
    .cvt .error {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #fdecea;
      color: var(--cvt-error);
      font-size: 13px;
    }
    .cvt .aviso {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--cvt-bg-suave);
      color: var(--cvt-texto-suave);
      font-size: 13px;
    }
    .cvt .confirmacion {
      text-align: center;
      padding: 12px 0;
    }
    .cvt .confirmacion .icono {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: #e8f3ea;
      color: #2e7d32;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      margin: 0 auto 12px;
    }
    .cvt .confirmacion h4 {
      margin: 0 0 6px;
      font-size: 16px;
      color: var(--cvt-texto);
    }
    .cvt .confirmacion p {
      margin: 0;
      font-size: 13px;
      color: var(--cvt-texto-suave);
      line-height: 1.5;
    }
    .cvt .marca {
      margin-top: 18px;
      text-align: center;
      font-size: 11px;
      color: var(--cvt-texto-suave);
      opacity: 0.7;
    }
    .cvt .cargando {
      font-size: 13px;
      color: var(--cvt-texto-suave);
      margin-top: 14px;
    }
  `;

  class ConviteReservas extends HTMLElement {
    constructor() {
      super();
      this._root = this.attachShadow({ mode: "open" });
      this._estado = {
        paso: "form",
        fecha: "",
        turnoId: "",
        comensales: 2,
        turnos: [],
        mesaElegida: null,
        cargando: false,
        error: null,
        nombre: "",
        telefono: "",
        email: "",
      };
    }

    connectedCallback() {
      this._apiBase = (this.getAttribute("api-base") || API_BASE_POR_DEFECTO).replace(/\/$/, "");
      this._restauranteId = this.getAttribute("restaurante-id");
      this._apiKey = this.getAttribute("api-key");

      if (!this._restauranteId || !this._apiKey) {
        this._root.innerHTML =
          '<div style="font-family:sans-serif;color:#b3261e;font-size:13px">' +
          "Convite: faltan los atributos restaurante-id / api-key en &lt;convite-reservas&gt;.</div>";
        return;
      }

      const hoy = new Date();
      this._estado.fecha = hoy.toISOString().slice(0, 10);

      this._render();
      this._cargarTurnos();
    }

    async _fetchApi(path, opciones) {
      const resp = await fetch(`${this._apiBase}/restaurantes/${this._restauranteId}${path}`, {
        ...opciones,
        headers: {
          "X-API-Key": this._apiKey,
          "Content-Type": "application/json",
          ...(opciones && opciones.headers),
        },
      });
      let cuerpo = null;
      try {
        cuerpo = await resp.json();
      } catch (_) {
        /* respuesta sin cuerpo */
      }
      if (!resp.ok) {
        const detalle =
          (cuerpo && (cuerpo.detail || (Array.isArray(cuerpo) && cuerpo[0] && cuerpo[0].msg))) ||
          `Error ${resp.status}`;
        throw new Error(typeof detalle === "string" ? detalle : "No se pudo completar la petición");
      }
      return cuerpo;
    }

    async _cargarTurnos() {
      this._estado.cargando = true;
      this._estado.error = null;
      this._render();
      try {
        const turnos = await this._fetchApi("/turnos/", { method: "GET" });
        this._estado.turnos = (turnos || []).filter((t) => t.activo);
        if (this._estado.turnos.length && !this._estado.turnoId) {
          this._estado.turnoId = this._estado.turnos[0].id;
        }
      } catch (err) {
        this._estado.error = "No se pudieron cargar los turnos: " + err.message;
      } finally {
        this._estado.cargando = false;
        this._render();
      }
    }

    async _buscarDisponibilidad() {
      if (!this._estado.turnoId) {
        this._estado.error = "Elige un turno.";
        this._render();
        return;
      }
      if (!this._estado.comensales || Number(this._estado.comensales) < 1) {
        this._estado.error = "Indica el número de comensales.";
        this._render();
        return;
      }
      this._estado.error = null;
      this._estado.cargando = true;
      this._render();
      try {
        const qs = new URLSearchParams({
          fecha: this._estado.fecha,
          turno_id: this._estado.turnoId,
          comensales: String(this._estado.comensales),
        });
        const mesas = await this._fetchApi(`/disponibilidad/?${qs.toString()}`, { method: "GET" });
        if (!mesas || mesas.length === 0) {
          this._estado.mesaElegida = null;
          this._estado.paso = "sin_disponibilidad";
        } else {
          // El cliente no elige mesa concreta (eso es cosa del restaurante):
          // el widget coge automáticamente la más ajustada al grupo.
          mesas.sort((a, b) => a.capacidad_max - b.capacidad_max);
          this._estado.mesaElegida = mesas[0];
          this._estado.paso = "contacto";
        }
      } catch (err) {
        this._estado.error = err.message;
      } finally {
        this._estado.cargando = false;
        this._render();
      }
    }

    async _confirmarReserva() {
      if (!this._estado.nombre.trim()) {
        this._estado.error = "Indica tu nombre y apellidos.";
        this._render();
        return;
      }
      this._estado.error = null;
      this._estado.cargando = true;
      this._render();
      try {
        const turno = this._estado.turnos.find((t) => t.id === this._estado.turnoId);
        await this._fetchApi("/reservas/", {
          method: "POST",
          body: JSON.stringify({
            cliente_nombre: this._estado.nombre,
            cliente_telefono: this._estado.telefono || undefined,
            cliente_email: this._estado.email || undefined,
            fecha: this._estado.fecha,
            turno_id: this._estado.turnoId,
            hora: turno ? turno.hora_inicio : "20:00:00",
            num_personas: Number(this._estado.comensales),
            mesa_ids: [this._estado.mesaElegida.id],
            origen: "web",
          }),
        });
        this._estado.paso = "confirmado";
      } catch (err) {
        this._estado.error = err.message;
      } finally {
        this._estado.cargando = false;
        this._render();
      }
    }

    _volverAlFormulario() {
      this._estado.paso = "form";
      this._estado.error = null;
      this._render();
    }

    _bind(selector, evento, handler) {
      const el = this._root.querySelector(selector);
      if (el) el.addEventListener(evento, handler);
    }

    _render() {
      const e = this._estado;
      let contenido = "";

      if (e.paso === "form") {
        const opcionesTurno = e.turnos
          .map((t) => `<option value="${t.id}" ${t.id === e.turnoId ? "selected" : ""}>${t.nombre} (${t.hora_inicio.slice(0, 5)} - ${t.hora_fin.slice(0, 5)})</option>`)
          .join("");
        contenido = `
          <h3>Reserva tu mesa</h3>
          <p class="sub">Elige fecha, turno y número de comensales.</p>
          <label for="cvt-fecha">Fecha</label>
          <input id="cvt-fecha" type="date" value="${e.fecha}" min="${new Date().toISOString().slice(0, 10)}" />
          <div class="fila-2">
            <div>
              <label for="cvt-turno">Turno</label>
              <select id="cvt-turno" ${e.turnos.length === 0 ? "disabled" : ""}>
                ${opcionesTurno || '<option value="">Sin turnos disponibles</option>'}
              </select>
            </div>
            <div>
              <label for="cvt-comensales">Comensales</label>
              <input id="cvt-comensales" type="number" min="1" max="30" value="${e.comensales}" />
            </div>
          </div>
          ${e.error ? `<div class="error">${e.error}</div>` : ""}
          ${e.cargando ? `<div class="cargando">Cargando…</div>` : ""}
          <button id="cvt-buscar" ${e.cargando ? "disabled" : ""}>Ver disponibilidad</button>
          <div class="marca">Reservas gestionadas por Convite</div>
        `;
      } else if (e.paso === "sin_disponibilidad") {
        contenido = `
          <h3>Sin disponibilidad</h3>
          <div class="aviso">No hay mesas libres para ${e.comensales} persona(s) ese día en ese turno. Prueba con otra fecha, turno o número de comensales.</div>
          <button id="cvt-volver" class="secundario">Volver a intentar</button>
        `;
      } else if (e.paso === "contacto") {
        contenido = `
          <h3>Tus datos de contacto</h3>
          <p class="sub">Mesa disponible encontrada para ${e.comensales} persona(s).</p>
          <label for="cvt-nombre">Nombre y apellidos *</label>
          <input id="cvt-nombre" type="text" value="${e.nombre}" placeholder="Nombre completo" />
          <label for="cvt-telefono">Teléfono</label>
          <input id="cvt-telefono" type="tel" value="${e.telefono}" placeholder="600 000 000" />
          <label for="cvt-email">Email</label>
          <input id="cvt-email" type="email" value="${e.email}" placeholder="tu@email.com" />
          ${e.error ? `<div class="error">${e.error}</div>` : ""}
          <button id="cvt-confirmar" ${e.cargando ? "disabled" : ""}>${e.cargando ? "Confirmando…" : "Confirmar reserva"}</button>
          <button id="cvt-volver" class="secundario" ${e.cargando ? "disabled" : ""}>Volver</button>
        `;
      } else if (e.paso === "confirmado") {
        contenido = `
          <div class="confirmacion">
            <div class="icono">✓</div>
            <h4>¡Reserva enviada!</h4>
            <p>Gracias, ${this._escapar(e.nombre)}. Tu reserva para ${e.comensales} persona(s) el ${e.fecha} ha quedado registrada. El restaurante se pondrá en contacto contigo si necesita confirmar algún detalle.</p>
          </div>
          <button id="cvt-nueva" class="secundario">Hacer otra reserva</button>
          <div class="marca">Reservas gestionadas por Convite</div>
        `;
      }

      this._root.innerHTML = `<style>${ESTILOS}</style><div class="cvt">${contenido}</div>`;

      // Re-enganchar listeners tras cada render (innerHTML los destruye).
      this._bind("#cvt-fecha", "change", (ev) => {
        e.fecha = ev.target.value;
      });
      this._bind("#cvt-turno", "change", (ev) => {
        e.turnoId = ev.target.value;
      });
      this._bind("#cvt-comensales", "input", (ev) => {
        e.comensales = ev.target.value;
      });
      this._bind("#cvt-buscar", "click", () => this._buscarDisponibilidad());
      this._bind("#cvt-volver", "click", () => this._volverAlFormulario());
      this._bind("#cvt-nueva", "click", () => this._volverAlFormulario());
      this._bind("#cvt-nombre", "input", (ev) => {
        e.nombre = ev.target.value;
      });
      this._bind("#cvt-telefono", "input", (ev) => {
        e.telefono = ev.target.value;
      });
      this._bind("#cvt-email", "input", (ev) => {
        e.email = ev.target.value;
      });
      this._bind("#cvt-confirmar", "click", () => this._confirmarReserva());
    }

    _escapar(texto) {
      const div = document.createElement("div");
      div.textContent = texto;
      return div.innerHTML;
    }
  }

  customElements.define(TAG, ConviteReservas);
})();
