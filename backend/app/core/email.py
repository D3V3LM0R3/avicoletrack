import smtplib
import logging
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_auth_email(recipient: str, subject: str, body: str) -> None:
    smtp_host = settings.smtp_host.strip() if settings.smtp_host else None
    smtp_username = settings.smtp_username.strip() if settings.smtp_username else None
    smtp_password = settings.smtp_password.strip() if settings.smtp_password else None
    smtp_from_email = settings.smtp_from_email.strip() if settings.smtp_from_email else None

    if not all((smtp_host, smtp_username, smtp_password, smtp_from_email)):
        return

    message = EmailMessage()
    message["From"] = smtp_from_email
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(message)
    except (OSError, smtplib.SMTPException):
        logger.exception("Unable to send authentication email to %s", recipient)