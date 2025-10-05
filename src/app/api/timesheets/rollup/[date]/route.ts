import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { getActiveOtRule, isHoliday, getShift, computeDay, weekWindow, capOtMinutes } from '@/lib/ot'
import { getLatestOtPayCfg, monthlyToMinuteRate, computeOtAmounts } from '@/lib/otpay'
import { getPolicy } from '@/lib/policy'

export async function POST(req: NextRequest, { params }: { params: { date: string } }){
  const workDate = params.date; const onDate = new Date(workDate+'T00:00:00Z'); const rule = await getActiveOtRule(onDate); const holiday = await isHoliday(onDate)
  const policy = await getPolicy(); const caps = policy.ot_caps || {}; const week = weekWindow(workDate, (policy.week_start_day as any)||'sun')
  const { rows: emps } = await query<any>(`SELECT id FROM employees WHERE status='active'`)
  for(const e of emps){
    const shift = await getShift(e.id, onDate)
    const { rows: punches } = await query<any>(`SELECT ts, action FROM attendance_logs WHERE employee_id=$1 AND ts::date=$2 ORDER BY ts`,[e.id, workDate])
    const res = computeDay(onDate, shift, punches, rule, holiday)
    // caps
    let minutes = { regular: res.ot_regular, weekend: res.ot_weekend, holiday: res.ot_holiday }
    if(caps.enforce){
      const { rows: used } = await query<any>(`SELECT COALESCE(SUM(ot_regular_minutes+ot_weekend_minutes+ot_holiday_minutes),0) AS mins FROM timesheets WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3`,[e.id, week.start, workDate])
      const weekUsed = Number(used[0].mins||0)
      const before = minutes; minutes = capOtMinutes(before, caps.per_day_minutes, weekUsed, caps.per_week_minutes)
      await query(`INSERT INTO ot_caps_audit(employee_id, work_date, policy_snapshot, before_regular, before_weekend, before_holiday, after_regular, after_weekend, after_holiday, week_used_before)
                   VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10)
                   ON CONFLICT (employee_id, work_date) DO UPDATE SET policy_snapshot=EXCLUDED.policy_snapshot, before_regular=EXCLUDED.before_regular, before_weekend=EXCLUDED.before_weekend, before_holiday=EXCLUDED.before_holiday, after_regular=EXCLUDED.after_regular, after_weekend=EXCLUDED.after_weekend, after_holiday=EXCLUDED.after_holiday, week_used_before=EXCLUDED.week_used_before`,
                   [e.id, workDate, JSON.stringify({ week_start_day: policy.week_start_day||'sun', caps }), before.regular, before.weekend, before.holiday, minutes.regular, minutes.weekend, minutes.holiday, weekUsed])
    }
    res.ot_regular = minutes.regular; res.ot_weekend = minutes.weekend; res.ot_holiday = minutes.holiday
    // amounts
    const payCfg = await getLatestOtPayCfg(onDate)
    const { rows: bs } = await query<any>(`SELECT base_salary, housing_allowance FROM employees WHERE id=$1`,[e.id])
    const baseMonthly = (payCfg.basis==='basic')? Number(bs[0].base_salary||0) : Number(bs[0].base_salary||0) + Number(bs[0].housing_allowance||0)
    const minuteRate = monthlyToMinuteRate(baseMonthly, payCfg.hour_divisor||240)
    const otAmts = computeOtAmounts({regular:res.ot_regular,weekend:res.ot_weekend,holiday:res.ot_holiday}, minuteRate, payCfg)
    await query(`INSERT INTO timesheets(employee_id, work_date, shift_id, scheduled_minutes, worked_minutes, night_minutes, late_minutes, early_leave_minutes, ot_regular_minutes, ot_weekend_minutes, ot_holiday_minutes, status, ot_regular_amount, ot_weekend_amount, ot_holiday_amount)
                 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'posted',$12,$13,$14)
                 ON CONFLICT (employee_id, work_date) DO UPDATE SET shift_id=EXCLUDED.shift_id, scheduled_minutes=EXCLUDED.scheduled_minutes, worked_minutes=EXCLUDED.worked_minutes, night_minutes=EXCLUDED.night_minutes, late_minutes=EXCLUDED.late_minutes, early_leave_minutes=EXCLUDED.early_leave_minutes, ot_regular_minutes=EXCLUDED.ot_regular_minutes, ot_weekend_minutes=EXCLUDED.ot_weekend_minutes, ot_holiday_minutes=EXCLUDED.ot_holiday_minutes, ot_regular_amount=EXCLUDED.ot_regular_amount, ot_weekend_amount=EXCLUDED.ot_weekend_amount, ot_holiday_amount=EXCLUDED.ot_holiday_amount, status='posted'`,
                 [e.id, workDate, shift?.id||null, res.scheduled, res.worked, res.night, res.late, res.early, res.ot_regular, res.ot_weekend, res.ot_holiday, otAmts.regular, otAmts.weekend, otAmts.holiday])
  }
  return new Response('Rolled up',{status:200})
}
