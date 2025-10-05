import { query } from '@/lib/db'
export type PayrollPolicy={ include_ot_in_gosi_base?:boolean; week_start_day?:'fri'|'sat'|'sun'; ot_caps?:{ per_day_minutes?:number; per_week_minutes?:number; enforce?:boolean; excess_handling?:'truncate'|'reject'|'carryover' } }
export async function getPolicy(): Promise<PayrollPolicy>{ const {rows}=await query<any>(`SELECT value FROM settings WHERE key='payroll_policy'`); return rows[0]?.value||{} }
