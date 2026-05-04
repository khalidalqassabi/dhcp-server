import { Injectable }  from '@angular/core';
import { Observable }  from 'rxjs';
import { map }         from 'rxjs/operators';
import { KeaService, KeaReservation } from './kea.service';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  constructor(private kea: KeaService) {}

  getPage(subnetId: number, from = 0, limit = 200): Observable<KeaReservation[]> {
    return this.kea.command<{ hosts: KeaReservation[]; count: number }>(
      'reservation-get-page',
      { 'subnet-id': subnetId, 'source-index': 0, from, limit }
    ).pipe(
      map(r => r.arguments?.hosts ?? [])
    );
  }

  add(reservation: KeaReservation): Observable<void> {
    return this.kea.command('reservation-add', { reservation }).pipe(
      map(() => void 0)
    );
  }

  delete(subnetId: number, hwAddress: string): Observable<void> {
    return this.kea.command('reservation-del', {
      'subnet-id':       subnetId,
      'identifier-type': 'hw-address',
      'identifier':      hwAddress
    }).pipe(map(() => void 0));
  }
}
