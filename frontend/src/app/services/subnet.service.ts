import { Injectable }            from '@angular/core';
import { Observable }            from 'rxjs';
import { map, switchMap }        from 'rxjs/operators';
import { KeaService, KeaSubnet } from './kea.service';

@Injectable({ providedIn: 'root' })
export class SubnetService {
  constructor(private kea: KeaService) {}

  getAll(): Observable<KeaSubnet[]> {
    return this.kea.command<{ Dhcp4: { subnet4: KeaSubnet[] } }>('config-get').pipe(
      map(r => r.arguments?.['Dhcp4']?.['subnet4'] ?? [])
    );
  }

  set(subnet: KeaSubnet): Observable<void> {
    return this.kea.command<{ Dhcp4: Record<string, unknown> }>('config-get').pipe(
      switchMap(r => {
        const cfg     = r.arguments!['Dhcp4'] as Record<string, unknown>;
        const subnets = ((cfg['subnet4'] as KeaSubnet[]) ?? []).filter(s => s.id !== subnet.id);
        subnets.push(subnet);
        cfg['subnet4'] = subnets;
        return this.kea.command('config-set', { Dhcp4: cfg });
      }),
      switchMap(() => this.kea.command('config-write')),
      map(() => void 0)
    );
  }

  deleteById(id: number): Observable<void> {
    return this.kea.command<{ Dhcp4: Record<string, unknown> }>('config-get').pipe(
      switchMap(r => {
        const cfg     = r.arguments!['Dhcp4'] as Record<string, unknown>;
        cfg['subnet4'] = ((cfg['subnet4'] as KeaSubnet[]) ?? []).filter(s => s.id !== id);
        return this.kea.command('config-set', { Dhcp4: cfg });
      }),
      switchMap(() => this.kea.command('config-write')),
      map(() => void 0)
    );
  }
}
