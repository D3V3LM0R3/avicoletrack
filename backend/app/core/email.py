import smtplib
import logging
from email.message import EmailMessage

from app.core.config import settings

import httpx

logger = logging.getLogger(__name__)


def send_auth_email(recipient: str, subject: str, body: str) -> bool:
    provider = settings.email_provider.strip().lower()
    resend_api_key = settings.resend_api_key.strip() if settings.resend_api_key else None
    resend_from_email = settings.resend_from_email.strip() if settings.resend_from_email else None

    if provider not in {"auto", "resend", "smtp"}:
        logger.error("Unsupported EMAIL_PROVIDER value: %s", provider)
        return False

    if provider in {"auto", "resend"} and resend_api_key and resend_from_email:
        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_api_key}"},
                json={"from": resend_from_email, "to": [recipient], "subject": subject, "text": body},
                timeout=10,
            )
            response.raise_for_status()
            return True
        except (OSError, httpx.HTTPError):
            logger.exception("Unable to send authentication email with Resend to %s", recipient)
            if provider == "resend":
                return False

    if provider == "resend":
        logger.error("Resend selected but RESEND_API_KEY or RESEND_FROM_EMAIL is missing")
        return False

    smtp_host = settings.smtp_host.strip() if settings.smtp_host else None
    smtp_username = settings.smtp_username.strip() if settings.smtp_username else None
    # Google displays app passwords in groups; ignore copied spaces/newlines.
    smtp_password = "".join(settings.smtp_password.split()) if settings.smtp_password else None
    smtp_from_email = settings.smtp_from_email.strip() if settings.smtp_from_email else None

    if not all((smtp_host, smtp_username, smtp_password, smtp_from_email)):
        logger.error("SMTP selected but SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, or SMTP_FROM_EMAIL is missing")
        return False

    message = EmailMessage()
    message["From"] = smtp_from_email
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    try:
        smtp_client = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
        with smtp_client(smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls and not settings.smtp_use_ssl:
                server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(message)
            return True
    except smtplib.SMTPAuthenticationError:
        logger.exception(
            "SMTP authentication failed for host %s and username %s; verify the Gmail app password and account",
            smtp_host,
            smtp_username,
        )
    except (OSError, smtplib.SMTPException):
        logger.exception("Unable to send authentication email through SMTP host %s", smtp_host)
    return False