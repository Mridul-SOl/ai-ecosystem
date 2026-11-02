import logging
from typing import Dict, Any, List
from email.message import EmailMessage
from backend.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self.password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL or "noreply@aiecosystem.internal"
        self.use_tls = settings.SMTP_USE_TLS

    def is_configured(self) -> bool:
        return bool(self.user and self.password and self.host)

    async def send_email(self, to_email: str, subject: str, body_text: str) -> Dict[str, Any]:
        """
        Sends email via aiosmtplib if configured, or records mock delivery.
        """
        if not self.is_configured():
            logger.info("SMTP credentials not configured. Mocking email delivery to %s", to_email)
            return {
                "success": True,
                "status": "mock_delivered",
                "recipient": to_email,
                "subject": subject,
                "message": "Email logged in mock mode. Provide SMTP_USER & SMTP_PASSWORD in Settings for live SMTP dispatch."
            }

        try:
            import aiosmtplib
            message = EmailMessage()
            message["From"] = self.from_email
            message["To"] = to_email
            message["Subject"] = subject
            message.set_content(body_text)

            await aiosmtplib.send(
                message,
                hostname=self.host,
                port=self.port,
                username=self.user,
                password=self.password,
                start_tls=self.use_tls
            )
            return {
                "success": True,
                "status": "sent",
                "recipient": to_email,
                "subject": subject
            }
        except Exception as e:
            logger.error("Failed to send email via SMTP: %s", e)
            return {
                "success": False,
                "error": str(e),
                "status": "error"
            }

email_service = EmailService()
