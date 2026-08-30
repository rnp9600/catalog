# OTP sign-in — Fast2SMS, no DLT registration

Supabase Auth generates the OTP; this function delivers it through Fast2SMS.

## Why Fast2SMS's `otp` route

Sending SMS in India normally needs DLT registration (TRAI rule): register the
business, a 6-letter sender ID, and the exact message template. That is days of
paperwork.

Fast2SMS's `route: "otp"` sidesteps it — they send on **their own**
pre-approved template, `Your OTP: 123456`. No DLT registration on our side.

The trade-offs, accepted deliberately:

- The message wording is fixed. It cannot say "Patel Marketing".
- The sender ID is Fast2SMS's, not ours.
- Roughly ₹0.35 per SMS (a DLT-registered sender is ~₹0.11–0.25).

If Raj later wants the SMS to read as Patel Marketing, do the DLT registration
and change **only** `sendViaFast2SMS()` in `index.ts` (switch to
`route: "dlt"` with the approved `sender_id` and template id). Nothing in the
catalogue or the database changes.

## One-time setup

1. **Fast2SMS**: copy the API key from *Dev API*, then complete the OTP KYC —
   the `otp` route refuses to send until this is done, answering
   *"Before using OTP Message API, complete website verification."*
   In the Fast2SMS panel: **OTP SMS section → KYC button (top)**, then
   - add at least ₹100 credit,
   - enter the website URL (`https://patelmarketing-catalog.vercel.app`),
   - verify Aadhaar — the OTP goes to the **Aadhaar-linked** mobile, which is
     not necessarily the number on the Fast2SMS account.

2. **Supabase → Authentication → Providers → Phone**: enable phone sign-in.
   (No SMS provider needs choosing there — the hook below replaces it.)

3. **Supabase → Authentication → Hooks → Send SMS hook**: enable it, choose
   *HTTPS*, and point it at:

   ```
   https://vcrzauuxvgpsbforiszz.supabase.co/functions/v1/send-sms
   ```

   Copy the secret it shows — it looks like `v1,whsec_…`.

4. **Supabase → Edge Functions → send-sms → Secrets**, add both:

   | Name | Value |
   |---|---|
   | `FAST2SMS_API_KEY` | the key from step 1 |
   | `SEND_SMS_HOOK_SECRET` | the `v1,whsec_…` from step 3 |

   Neither belongs in this repo or in `config.js`. They live only here.

5. Sign in on **`/v3/`** with a number that is on `catalog.allowlist`. A code
   should arrive within a minute. (`/v2/` is the previous, still-live version
   and deliberately keeps the old plain-text sign-in — it will never send an
   OTP.)

## Notes

- The function refuses to send unless `SEND_SMS_HOOK_SECRET` is set and the
  request carries a valid Standard Webhooks signature, so a stranger who finds
  the URL cannot burn SMS credits.
- The signature scheme was verified against the published Standard Webhooks
  test vector.
- Fast2SMS answers HTTP 200 with `{"return": false}` for failures such as an
  empty wallet, so the function checks that field rather than trusting the
  status code.
- Failures are logged without the OTP or the full phone number, since Edge
  Function logs are readable in the dashboard.
- Supabase's own per-hour OTP rate limit stays on; the sign-in screens already
  show a "too many attempts" message.
