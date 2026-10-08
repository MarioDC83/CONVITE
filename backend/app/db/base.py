# Importa Base y todos los modelos para que Alembic los detecte en autogenerate.
from app.db.base_class import Base  # noqa: F401
from app.models.cliente import Cliente  # noqa: F401
from app.models.dia_especial import DiaEspecial  # noqa: F401
from app.models.google_calendar import GoogleCalendarConexion  # noqa: F401
from app.models.lista_espera import ListaEspera  # noqa: F401
from app.models.mesa import Mesa  # noqa: F401
from app.models.restaurante import Restaurante  # noqa: F401
from app.models.reserva import Reserva  # noqa: F401
from app.models.turno import Turno  # noqa: F401
from app.models.usuario import Usuario  # noqa: F401
from app.models.zona import Zona  # noqa: F401
