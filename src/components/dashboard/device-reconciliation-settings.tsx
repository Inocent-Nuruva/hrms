"use client"

import { useEffect, useState } from "react"
import { adminRequest } from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { Button } from "@/components/ui/button"

export function DeviceReconciliationSettings({ deviceId }: { deviceId:string }) {
  const [enabled,setEnabled]=useState<boolean | null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const token=readStoredSessionTokens().accessToken
  const path=`/api/access-control/reconciliation-devices/${encodeURIComponent(deviceId)}`
  useEffect(()=>{
    let current=true
    setEnabled(null)
    setError("")
    if(token) adminRequest<{enabled:boolean}>(path,{token}).then(state=>{if(current) setEnabled(state.enabled)}).catch((e:Error)=>{if(current)setError(e.message)})
    return ()=>{current=false}
  },[path,token])
  async function change(){
    if(busy||enabled===null||!token)return
    setBusy(true)
    setError("")
    try{
      const state=await adminRequest<{enabled:boolean}>(path,{token,method:"PUT",body:{enabled:!enabled}})
      if(token===readStoredSessionTokens().accessToken)setEnabled(state.enabled)
    }catch(e){setError(e instanceof Error?e.message:"Cannot update reader settings.")}
    finally{setBusy(false)}
  }
  return <section className="space-y-2 rounded-lg border p-4">
    <h3 className="text-sm font-semibold">Automatic access reconciliation</h3>
    <p className="text-sm">Apply new group, employment and supported card-status changes to this reader. HRMS reads the changes back and preserves independently configured door access.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Button type="button" variant="outline" disabled={busy||enabled===null} onClick={()=>void change()}>{enabled===null?"Loading reader settings…":enabled?"Pause automatic reconciliation":"Enable automatic reconciliation for this reader"}</Button>
  </section>
}
