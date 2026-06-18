import { useEffect, useState } from 'react';
import { type CompanyZone, subscribeCompanyZones } from '@/lib/companyZones';

export function useCompanyZones(companyId: string | null): CompanyZone[] {
  const [zones, setZones] = useState<CompanyZone[]>([]);

  useEffect(() => {
    if (!companyId) {
      setZones([]);
      return;
    }
    return subscribeCompanyZones(companyId, setZones);
  }, [companyId]);

  return zones;
}
