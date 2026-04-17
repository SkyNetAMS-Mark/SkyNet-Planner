# Resend Email Setup Guide

## Current Status

✅ Resend package installed
✅ API key configured in `.env.local`
✅ Email templates created
✅ API routes implemented
✅ Buttons added to UI

⚠️ **Using testing domain**: `onboarding@resend.dev`

## Verify Your Domain (Recommended for Production)

### Step 1: Add Domain to Resend

1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter: `skynet.be`
4. Click "Add"

### Step 2: Add DNS Records

Resend will provide DNS records to add. You'll need to add these to your domain's DNS settings:

**Typical records:**
- **SPF**: TXT record for email authentication
- **DKIM**: TXT record for email signing
- **DMARC**: TXT record for email policy

### Step 3: Verify Domain

1. After adding DNS records, click "Verify" in Resend dashboard
2. Wait for verification (can take up to 48 hours, usually minutes)
3. Once verified, update the email sender

### Step 4: Update Email Sender

Once `skynet.be` is verified, update both API routes:

**File**: `app/api/send-invite/route.ts` (line 67)
**File**: `app/api/send-reminder/route.ts` (line 67)

Change from:
```typescript
from: 'SkyNet Belgium <onboarding@resend.dev>',
```

To:
```typescript
from: 'SkyNet Belgium <noreply@skynet.be>',
```

## Testing with onboarding@resend.dev

The current setup uses Resend's testing domain which:
- ✅ Works immediately (no verification needed)
- ✅ Sends real emails
- ✅ Perfect for development and testing
- ⚠️ Shows "via resend.dev" in email clients
- ⚠️ Not ideal for production (use verified domain)

## Database Migration Required

Before testing emails, run the database migration:

1. Go to Supabase SQL Editor
2. Run the SQL from `supabase/migrations/add_email_tracking_fields.sql`
3. This adds: `invite_sent_at`, `reminder_sent_at`, `reminder_count` fields

See `RUN_EMAIL_MIGRATION.md` for detailed instructions.

## Testing Emails

1. **Run database migration** (see above)
2. **Go to parcels page**: http://localhost:3000/parcels
3. **Click "Send Invite"** on any pending parcel
4. **Check your email** (the receiver's email address)
5. **Verify**:
   - Email received
   - Button shows "Invite Sent (date)"
   - Can click "Reminder" button
   - Reminder email works

## Production Deployment

When deploying to Cloud Run, add environment variable:
```
RESEND_API_KEY=re_GPK8xLFb_6rwxjQrV3oNGW15HZFha8yuK
```

## Email Limits

**Resend Free Tier:**
- 100 emails per day
- 3,000 emails per month
- Perfect for SkyNet Belgium (~50 parcels/day)

**Paid Plans** (if needed):
- €20/month: 50,000 emails/month
- Scales as needed

## Support

- Resend Docs: https://resend.com/docs
- Domain Verification: https://resend.com/docs/dashboard/domains/introduction
- API Reference: https://resend.com/docs/api-reference/emails/send-email