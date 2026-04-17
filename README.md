# SkyNet Belgium - Parcel Delivery Management System

A comprehensive parcel delivery management platform for SkyNet's Belgium operations.

30-12-2025

## Features

- **Admin Dashboard**: Manage drivers, regions, postal codes, and delivery schedules
- **Parcel Management**: Upload, track, and manage parcel deliveries
- **Customer Portal**: Allow customers to select delivery time slots
- **Route Planning**: Visual route planning with interactive maps
- **Reporting**: Export data to CSV/Excel for analysis

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deployment**: Google Cloud Run
- **Maps**: Leaflet for interactive route visualization

## Environment Variables

Required environment variables are configured in Cloud Build trigger substitution variables.

## Deployment

Automatic deployment via Cloud Build when pushing to GitHub.

Build with environment variables: ✅
