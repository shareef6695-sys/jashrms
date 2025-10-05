import { query } from '@/lib/db'
export async function GET(req:Request,{params}:{params:{period:string}}){
  const yyyymm=params.period; const year=Number(yyyymm.slice(0,4)), month=Number(yyyymm.slice(4,6)); const valueDate=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)
  const { rows: cfg } = await query<any>(`SELECT value FROM settings WHERE key='wps_bank_config'`); const bank=cfg[0]?.value||{destId:'',estbId:'',bankAccount:''}
  const { rows } = await query<any>(`SELECT pl.*, e.name_en, COALESCE(e.iqama_no,e.saudi_id_no) empid, e.iban FROM payroll_periods p JOIN payroll_lines pl ON pl.period_id=p.id JOIN employees e ON e.id=pl.employee_id WHERE p.yyyymm=$1 ORDER BY e.id`,[yyyymm])
  if(rows.length===0) return new Response('No payroll lines',{status:404})
  const lines = rows.map(r=> [r.name_en, r.empid, r.iban, Number(r.earnings.basic||0).toFixed(2), Number(r.earnings.housing||0).toFixed(2), (Number(r.earnings.overtime||0)+Number(r.earnings.other||0)).toFixed(2), (Number(r.deductions.gosi||0)+Number(r.deductions.loans||0)+Number(r.deductions.absences||0)+Number(r.deductions.other||0)).toFixed(2), Number(r.net_pay||0).toFixed(2)].join('\t'))
  const total = rows.reduce((a,c)=>a+Number(c.net_pay||0),0)
  const header = [bank.destId, bank.estbId, bank.bankAccount, 'SAR', valueDate, total.toFixed(2), `${yyyymm}-01`].join('\t')
  const txt = header + '\n' + lines.join('\n') + '\n'
  return new Response(txt,{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="WPS_${yyyymm}.txt"`}})
}
