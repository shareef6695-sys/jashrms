import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { computeGosi } from '@/lib/gosi'
import { getPolicy } from '@/lib/policy'
function monthRange(yyyymm:string){ const y=Number(yyyymm.slice(0,4)), m=Number(yyyymm.slice(4,6)); const from=new Date(Date.UTC(y,m-1,1)).toISOString().slice(0,10); const to=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10); return { from, to } }
export async function POST(req:NextRequest,{params}:{params:{period:string}}){
  const yyyymm=params.period; const year=Number(yyyymm.slice(0,4)); const month=Number(yyyymm.slice(4,6)); const onDate=new Date(Date.UTC(year,month-1,28))
  const policy=await getPolicy(); const { rows: emps } = await query<any>(`SELECT * FROM employees WHERE status='active'`)
  const { rows: per } = await query<any>(`INSERT INTO payroll_periods(yyyymm,status) VALUES($1,'draft') ON CONFLICT (yyyymm) DO UPDATE SET yyyymm=EXCLUDED.yyyymm RETURNING id`,[yyyymm]); const periodId=per[0].id
  for(const e of emps){
    const basic=Number(e.base_salary||0), housing=Number(e.housing_allowance||0), other=0
    const {from,to}=monthRange(yyyymm)
    const { rows: ts } = await query<any>(`SELECT COALESCE(SUM(ot_regular_amount),0) r, COALESCE(SUM(ot_weekend_amount),0) w, COALESCE(SUM(ot_holiday_amount),0) h FROM timesheets WHERE employee_id=$1 AND work_date BETWEEN $2 AND $3`,[e.id,from,to])
    const otTotal=Number(ts[0].r||0)+Number(ts[0].w||0)+Number(ts[0].h||0)
    const gosi=await computeGosi(onDate, e.gosi_status, basic, housing)
    const gosi_base_final = policy.include_ot_in_gosi_base ? Math.min(gosi.base, basic+housing+otTotal) : gosi.base
    const deductions={ gosi: gosi.employee, loans:0, absences:0, other:0 }
    const earnings={ basic, housing, overtime: otTotal, other }
    const net= basic+housing+otTotal+other - (deductions.gosi+deductions.loans+deductions.absences+deductions.other)
    await query(`INSERT INTO payroll_lines(period_id,employee_id,earnings,deductions,gosi_base,net_pay) VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$6) ON CONFLICT (period_id,employee_id) DO UPDATE SET earnings=EXCLUDED.earnings,deductions=EXCLUDED.deductions,gosi_base=EXCLUDED.gosi_base,net_pay=EXCLUDED.net_pay`,[periodId,e.id,earnings,deductions,gosi_base_final,net])
  }
  await query(`UPDATE payroll_periods SET status='approved' WHERE id=$1`,[periodId])
  return new Response('Payroll calculated',{status:200})
}
