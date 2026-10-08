import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.crypto import cifrar, descifrar
from app.models.google_calendar import GoogleCalendarConexion


class CRUDGoogleCalendar:
    def get_by_restaurante(
        self, db: Session, *, restaurante_id: uuid.UUID
    ) -> GoogleCalendarConexion | None:
        return (
            db.query(GoogleCalendarConexion)
            .filter(GoogleCalendarConexion.restaurante_id == restaurante_id)
            .first()
        )

    def get_by_canal_id(self, db: Session, *, canal_id: str) -> GoogleCalendarConexion | None:
        return (
            db.query(GoogleCalendarConexion)
            .filter(GoogleCalendarConexion.canal_id == canal_id)
            .first()
        )

    def guardar_tokens(
        self,
        db: Session,
        *,
        restaurante_id: uuid.UUID,
        access_token: str,
        refresh_token: str,
        expira_en: datetime,
        email_cuenta: str | None,
        calendar_id: str = "primary",
    ) -> GoogleCalendarConexion:
        conexion = self.get_by_restaurante(db, restaurante_id=restaurante_id)
        if not conexion:
            conexion = GoogleCalendarConexion(restaurante_id=restaurante_id)

        conexion.access_token_cifrado = cifrar(access_token)
        # Google solo manda refresh_token la primera vez que se autoriza (o si
        # se fuerza prompt=consent); si no llega uno nuevo, se conserva el que
        # ya había en vez de borrarlo.
        if refresh_token:
            conexion.refresh_token_cifrado = cifrar(refresh_token)
        conexion.token_expira_en = expira_en
        conexion.email_cuenta = email_cuenta
        conexion.calendar_id = calendar_id

        db.add(conexion)
        db.commit()
        db.refresh(conexion)
        return conexion

    def guardar_canal_watch(
        self,
        db: Session,
        *,
        conexion: GoogleCalendarConexion,
        canal_id: str,
        resource_id: str,
        expira_en: datetime,
    ) -> GoogleCalendarConexion:
        conexion.canal_id = canal_id
        conexion.canal_resource_id = resource_id
        conexion.canal_expira_en = expira_en
        db.add(conexion)
        db.commit()
        db.refresh(conexion)
        return conexion

    def guardar_sync_token(
        self, db: Session, *, conexion: GoogleCalendarConexion, sync_token: str | None
    ) -> GoogleCalendarConexion:
        conexion.sync_token = sync_token
        db.add(conexion)
        db.commit()
        db.refresh(conexion)
        return conexion

    def eliminar(self, db: Session, *, conexion: GoogleCalendarConexion) -> None:
        db.delete(conexion)
        db.commit()

    def access_token(self, conexion: GoogleCalendarConexion) -> str:
        return descifrar(conexion.access_token_cifrado)

    def refresh_token(self, conexion: GoogleCalendarConexion) -> str:
        return descifrar(conexion.refresh_token_cifrado)


google_calendar = CRUDGoogleCalendar()
