import asyncio
import logging
import smtplib
import ssl
from datetime import datetime, timedelta
from email.message import EmailMessage

from .services import low_stock

log = logging.getLogger(__name__)


def send_low_stock_alert(sessions, settings):
    with sessions() as db:
        products = low_stock(db, settings.low_stock_threshold)
        if not products:
            return
        message = EmailMessage()
        message["To"] = settings.alert_recipient
        message["From"] = settings.mail_username
        message["Subject"] = (
            f"Low Stock Alert: {len(products)} product(s) need reordering"
        )
        message.set_content(
            "The following products are at or below their low-stock threshold:\n\n"
            + "\n".join(
                f"- {p.name} (SKU: {p.sku}) — {p.stock_quantity} units remaining"
                for p in products
            )
        )
    with smtplib.SMTP(settings.mail_host, settings.mail_port, timeout=30) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(settings.mail_username, settings.mail_password)
        smtp.send_message(message)


def seconds_until_alert(current=None):
    current = current or datetime.now()
    next_run = current.replace(hour=8, minute=0, second=0, microsecond=0)
    if next_run <= current:
        next_run += timedelta(days=1)
    return (next_run - current).total_seconds()


async def daily_alerts(sessions, settings):
    while True:
        await asyncio.sleep(seconds_until_alert())
        try:
            await asyncio.to_thread(send_low_stock_alert, sessions, settings)
        except Exception:
            log.exception("Failed to send low-stock alert email")
