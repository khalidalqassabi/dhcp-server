import { Injectable }         from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { switchMap, map, catchError, shareReplay } from 'rxjs/operators';
import { of }                 from 'rxjs';
import { KeaService }         from './kea.service';
import { environment }        from '../../environments/environment';

export interface ServerStatus {
  running: boolean;
  pid?:    number;
}

@Injectable({ providedIn: 'root' })
export class ServerService {
  private runningSubject = new BehaviorSubject<boolean>(true);
  readonly running$ = this.runningSubject.asObservable();

  readonly config$: Observable<Record<string, unknown>> = timer(0, environment.pollIntervalMs).pipe(
    switchMap(() =>
      this.kea.command<{ Dhcp4: Record<string, unknown> }>('config-get').pipe(
        catchError(() => of({ result: 0, text: '', arguments: { Dhcp4: {} } }))
      )
    ),
    map(r => (r.arguments?.['Dhcp4'] as Record<string, unknown>) ?? {}),
    shareReplay(1)
  );

  constructor(private kea: KeaService) {
    this.kea.command<{ pid: number; sockets: { ready: number } }>('status-get')
      .pipe(catchError(() => of(null)))
      .subscribe(r => {
        if (r) this.runningSubject.next((r.arguments?.sockets?.ready ?? 0) > 0);
      });
  }

  enable(): Observable<void> {
    return this.kea.command('dhcp-enable').pipe(
      map(() => { this.runningSubject.next(true); })
    );
  }

  disable(): Observable<void> {
    return this.kea.command('dhcp-disable').pipe(
      map(() => { this.runningSubject.next(false); })
    );
  }

  writeConfig(): Observable<void> {
    return this.kea.command('config-write').pipe(map(() => void 0));
  }
}
