import { Injectable }  from '@angular/core';
import { Observable }  from 'rxjs';
import { map }         from 'rxjs/operators';
import { KeaService, KeaSubnet } from './kea.service';

const REMOTE = { type: 'mysql' };
const SERVER_TAGS = ['dhcp-admin'];

@Injectable({ providedIn: 'root' })
export class SubnetService {
  constructor(private kea: KeaService) {}

  getAll(): Observable<KeaSubnet[]> {
    return this.kea.command<{ Dhcp4: { subnet4: KeaSubnet[] } }>('config-get').pipe(
      map(r => r.arguments?.['Dhcp4']?.['subnet4'] ?? [])
    );
  }

  set(subnet: KeaSubnet): Observable<void> {
    return this.kea.command('remote-subnet4-set', {
      remote:       REMOTE,
      'server-tags': SERVER_TAGS,
      subnets:      [subnet]
    }).pipe(map(() => void 0));
  }

  deleteById(id: number): Observable<void> {
    return this.kea.command('remote-subnet4-del-by-id', {
      remote:       REMOTE,
      'server-tags': SERVER_TAGS,
      subnets:      [{ id }]
    }).pipe(map(() => void 0));
  }
}
