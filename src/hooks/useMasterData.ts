import { useState, useEffect, useCallback } from 'react'
import { taskService } from '../services/taskService'
import { useTasks } from '../context/TaskContext'

export type MasterEntityType = 'clients' | 'consultants' | 'programmers'

export interface MasterRecord {
  id: string
  name: string
  email?: string
  active: boolean
}

export function useMasterData(entity: MasterEntityType) {
  const [data, setData] = useState<MasterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // live sync: biar TaskForm langsung lihat data baru tanpa refresh manual
  const { refreshData } = useTasks()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let result: MasterRecord[] = []
      if (entity === 'clients') result = await taskService.listClients()
      else if (entity === 'consultants') result = await taskService.listConsultants()
      else result = await taskService.listProgrammers()
      setData(result)
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [entity])

  const create = useCallback(async (name: string, email?: string) => {
    if (entity === 'clients') await taskService.createClient({ name })
    else if (entity === 'consultants') await taskService.createConsultant({ name, email })
    else await taskService.createProgrammer({ name, email })
    await fetchData()
    // sync ke TaskContext biar dropdown di TaskForm langsung kebaca
    await refreshData()
  }, [entity, fetchData, refreshData])

  const update = useCallback(async (id: string, name: string, email?: string, active?: boolean) => {
    if (entity === 'clients') await taskService.updateClient(id, { name, active })
    else if (entity === 'consultants') await taskService.updateConsultant(id, { name, email, active })
    else await taskService.updateProgrammer(id, { name, email, active })
    await fetchData()
    await refreshData()
  }, [entity, fetchData, refreshData])

  const remove = useCallback(async (id: string) => {
    if (entity === 'clients') await taskService.deleteClient(id)
    else if (entity === 'consultants') await taskService.deleteConsultant(id)
    else await taskService.deleteProgrammer(id)
    await fetchData()
    await refreshData()
  }, [entity, fetchData, refreshData])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData, create, update, remove }
}
