# admin@magnetclimbers.com

Use Cloudflare Email Routing (free): it forwards mail for the domain to an inbox you already have.

1. Cloudflare dashboard → magnetclimbers.com → **Email** → **Email Routing** → Get started.
2. Destination address: the Gmail (or other) inbox that should receive it; confirm the verification email.
3. Custom address: `admin` → forward to that destination. Also add a catch-all → same inbox if you like.
4. Click **Add records and enable**. Cloudflare writes the MX and TXT (SPF) records itself; nothing to
   add to `magnetclimbers.com.zone`. If it warns about existing MX records, there are none, proceed.
5. Test: send a mail to admin@magnetclimbers.com from another account.

Sending *from* admin@ (replies) is optional: Gmail → Settings → Accounts → "Send mail as" with
Cloudflare's SMTP is not supported; use a Gmail alias or reply from your own address. If you want proper
outbound mail later, add Resend or Postmark and their SPF/DKIM records.
