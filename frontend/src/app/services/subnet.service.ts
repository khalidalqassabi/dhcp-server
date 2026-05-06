import { Injectable }           from '@angular/core';
import { Observable }           from 'rxjs';
import { map, switchMap }       from 'rxjs/operators';
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
    return this.kea.command('subnet4-add', { subnets: [subnet] }).pipe(
      switchMap(() => this.kea.command('config-write')),
      map(() => void 0)
    );
  }

  deleteById(id: number): Observable<void> {
    return this.kea.command('subnet4-del', { id }).pipe(
      switchMap(() => this.kea.command('config-write')),
      map(() => void 0)
    );
  }
}
