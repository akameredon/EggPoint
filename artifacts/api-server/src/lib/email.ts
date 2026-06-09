import { Resend } from "resend";
import { logger } from "./logger";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Eggpoint <no-reply@eggpoint.ng>";

export async function sendFeaturedExpiryWarning(opts: {
  toEmail: string;
  toName: string;
  farmName: string;
  expiresAt: Date;
}): Promise<void> {
  const { toEmail, toName, farmName, expiresAt } = opts;
  const expiryStr = expiresAt.toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `Your Featured listing expires in 3 days — ${farmName}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <div style="background:#c0392b;padding:24px 32px;border-radius:8px 8px 0 0">
            <img src="https://eggpoint.ng/logo.png" alt="Eggpoint" style="height:32px" />
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #e5e5e5;border-radius:0 0 8px 8px">
            <p style="margin:0 0 8px">Hi ${toName},</p>
            <p style="margin:0 0 20px;color:#555">
              Your <strong>Featured listing</strong> for <strong>${farmName}</strong> on Eggpoint
              expires on <strong>${expiryStr}</strong> — that's in 3 days.
            </p>
            <p style="margin:0 0 20px;color:#555">
              As a Featured supplier you appear at the top of search results and get the gold
              badge that buyers trust. After expiry your farm will revert to a standard listing.
            </p>
            <a href="https://eggpoint.ng/dashboard" 
               style="display:inline-block;background:#c0392b;color:#fff;text-decoration:none;
                      padding:12px 28px;border-radius:6px;font-weight:600;margin-bottom:24px">
              Renew Now — ₦15,000/month
            </a>
            <p style="margin:0;color:#999;font-size:13px">
              You're receiving this because you have an active Featured listing on Eggpoint.
              Questions? Reply to this email.
            </p>
          </div>
        </div>
      `,
    });
    logger.info({ toEmail, farmName }, "Sent featured expiry warning email");
  } catch (err) {
    logger.error({ err, toEmail, farmName }, "Failed to send expiry warning email");
  }
}

export async function sendFeaturedExpiredNotice(opts: {
  toEmail: string;
  toName: string;
  farmName: string;
}): Promise<void> {
  const { toEmail, toName, farmName } = opts;

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `Your Featured listing has expired — ${farmName}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <div style="background:#c0392b;padding:24px 32px;border-radius:8px 8px 0 0">
            <img src="https://eggpoint.ng/logo.png" alt="Eggpoint" style="height:32px" />
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #e5e5e5;border-radius:0 0 8px 8px">
            <p style="margin:0 0 8px">Hi ${toName},</p>
            <p style="margin:0 0 20px;color:#555">
              Your <strong>Featured listing</strong> for <strong>${farmName}</strong> has expired
              and the farm has been moved back to the standard free tier.
            </p>
            <p style="margin:0 0 20px;color:#555">
              Renew anytime to get back to the top of buyer search results with the Featured badge.
            </p>
            <a href="https://eggpoint.ng/dashboard"
               style="display:inline-block;background:#c0392b;color:#fff;text-decoration:none;
                      padding:12px 28px;border-radius:6px;font-weight:600;margin-bottom:24px">
              Renew Featured — ₦15,000/month
            </a>
            <p style="margin:0;color:#999;font-size:13px">
              You're receiving this because you have a supplier account on Eggpoint.
              Questions? Reply to this email.
            </p>
          </div>
        </div>
      `,
    });
    logger.info({ toEmail, farmName }, "Sent featured expired notice email");
  } catch (err) {
    logger.error({ err, toEmail, farmName }, "Failed to send expired notice email");
  }
}
