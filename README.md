# HRMS KSA — v4
- Payroll + WPS (tab-delimited)
- Shifts & Overtime: rules, caps (day/week) with audit, approvals, policy toggle for including OT in GOSI base; configurable week start (Fri/Sat/Sun)
- Attendance → Timesheet rollup (OT minutes & SAR amounts)
- Holidays importer with Saudi National Day 2025–2027 preset
- Ramadan shift templates + deactivate utility

## Quick Start
```bash
npm i
cp .env.example .env.local
# set DATABASE_URL
npm run db:apply
# seed a demo admin
psql $DATABASE_URL -c "INSERT INTO users(email,password_hash,role_id) SELECT 'admin@company.com','8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',(SELECT id FROM roles WHERE name='admin') WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='admin@company.com')"
npm run dev
# open /login (admin/admin123)
```

## Routes
- Admin: `/admin`, `/admin/shifts`, `/admin/policy`, `/admin/ot`, `/admin/ot/audit`, `/admin/holidays-import`
- Rollup: `POST /api/timesheets/rollup/YYYY-MM-DD`
- Payroll: `POST /api/payroll/YYYYMM/calc`
- WPS: `GET /api/wps/YYYYMM/build`
