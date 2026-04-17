# SkyNet Delivery - Setup Instructions

Follow these steps to get your SkyNet delivery system up and running.

## Prerequisites Completed ✅

- ✅ Next.js 14 project created
- ✅ TypeScript configured
- ✅ Tailwind CSS installed
- ✅ Shadcn/ui components installed
- ✅ Supabase clients configured
- ✅ Environment variables set up

## Next Steps - Database Setup

### 1. Set Up Supabase Database

1. Go to your Supabase project: https://supabase.com/dashboard/project/gcinrqwfecwdrphzhgiy

2. Navigate to the SQL Editor

3. Copy the entire contents of `supabase-schema.sql`

4. Paste into the SQL Editor and click "Run"

5. Wait for the script to complete (should see success message)

6. Verify tables were created:
   - Go to Table Editor
   - You should see: drivers, regions, postal_codes, delivery_periods, region_schedules, senders, parcels, parcel_history, admin_users

### 2. Create Your First Admin User

1. In Supabase Dashboard, go to Authentication > Users

2. Click "Add User" (or "Invite User")

3. Enter:
   - Email: your-email@example.com
   - Password: (create a strong password)
   - Auto Confirm User: Yes

4. Copy the User ID (UUID) that was created

5. Go back to SQL Editor and run:
   ```sql
   INSERT INTO admin_users (id, full_name, role)
   VALUES ('YOUR-USER-ID-HERE', 'Your Name', 'admin');
   ```

### 3. Import Postal Codes (Optional but Recommended)

For Brussels region (1000-1299):
```sql
INSERT INTO postal_codes (code, region_id, city)
SELECT 
  code,
  (SELECT id FROM regions WHERE name = 'Brussels'),
  'Brussels'
FROM generate_series(1000, 1299) AS code;
```

You can repeat this for other regions with their respective postal code ranges.

### 4. Verify Database Setup

Run this query to check everything is set up:
```sql
SELECT 
  (SELECT COUNT(*) FROM drivers) as drivers_count,
  (SELECT COUNT(*) FROM regions) as regions_count,
  (SELECT COUNT(*) FROM postal_codes) as postal_codes_count,
  (SELECT COUNT(*) FROM delivery_periods) as periods_count,
  (SELECT COUNT(*) FROM admin_users) as admin_users_count;
```

You should see:
- regions_count: 4
- periods_count: 3
- admin_users_count: 1 (or more if you added multiple)

## Running the Application

### 1. Start the Development Server

```bash
cd skynet-delivery
npm run dev
```

### 2. Access the Application

Open your browser and go to: http://localhost:3000

### 3. Log In

1. Navigate to http://localhost:3000/login
2. Enter your admin credentials
3. You should be redirected to the dashboard

## What's Been Built So Far

### ✅ Completed
- Project structure
- Database schema
- TypeScript types
- Supabase authentication
- Environment configuration
- UI component library (Shadcn/ui)

### 🚧 In Progress
- Login page
- Admin dashboard layout
- Authentication flow

### 📋 Coming Next
- Dashboard home page
- Drivers management
- Regions management
- Postal codes management
- Delivery schedules
- Parcel management
- Customer slot selection
- N8N webhook integration

## Troubleshooting

### Database Connection Issues
- Verify your `.env.local` file has the correct Supabase credentials
- Check that your Supabase project is active
- Ensure the database schema was run successfully

### Authentication Issues
- Make sure you created an admin_users record for your user
- Check that the user ID matches between auth.users and admin_users
- Verify the user is confirmed in Supabase Auth

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Delete `.next` folder and restart dev server
- Check for TypeScript errors in the terminal

## Next Development Steps

1. **Complete Authentication Pages** (Current)
   - Login page
   - Logout functionality
   - Protected routes

2. **Build Admin Layout**
   - Sidebar navigation
   - Header with user menu
   - Responsive design

3. **Implement Core Features**
   - Drivers CRUD
   - Regions CRUD
   - Postal codes management
   - Schedule configuration

4. **Parcel Management**
   - Upload interface
   - Tracking dashboard
   - Status management

5. **Customer Interface**
   - Slot selection page
   - Token validation
   - Confirmation flow

6. **Integration**
   - N8N webhook
   - Email notifications

## Support

If you encounter any issues:
1. Check the console for error messages
2. Verify database setup in Supabase
3. Ensure environment variables are correct
4. Review the ARCHITECTURE.md for system design details

---

**Current Status**: Foundation complete, ready to build features! 🚀