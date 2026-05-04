import { Injectable }  from '@angular/core';
import { Observable }  from 'rxjs';
import { map }         from 'rxjs/operators';
import { KeaService, KeaLease, Lease, keaLeaseToLease } from './kea.service';

@Injectable({ providedIn: 'root' })
export class LeaseService {
  constructor(private kea: KeaService) {}

  getAll(): Observable<Lease[]> {
    return this.kea.command<{ leases: KeaLease[] }>('lease4-get-all').pipe(
      map(r => (r.arguments?.leases ?? []).map(keaLeaseToLease))
    );
  }

  delete(ipAddress: string): Observable<void> {
    return this.kea.command('lease4-del', { 'ip-address': ipAddress }).pipe(
      map(() => void 0)
    );
  }

  wipe(subnetId: number): Observable<void> {
    return this.kea.command('lease4-wipe', { 'subnet-id': subnetId }).pipe(
      map(() => void 0)
    );
  }
}
