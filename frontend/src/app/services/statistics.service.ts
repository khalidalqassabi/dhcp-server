import { Injectable }     from '@angular/core';
import { Observable }     from 'rxjs';
import { map, shareReplay, switchMap, catchError } from 'rxjs/operators';
import { timer, of }      from 'rxjs';
import { KeaService }     from './kea.service';
import { environment }    from '../../environments/environment';

export type KeaStats = Record<string, [[number, string]]>;

export function statValue(stats: KeaStats, name: string): number {
  return stats[name]?.[0]?.[0] ?? 0;
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  readonly stats$: Observable<KeaStats> = timer(0, environment.pollIntervalMs).pipe(
    switchMap(() =>
      this.kea.command<KeaStats>('statistic-get-all').pipe(
        catchError(() => of({ result: 0, text: '', arguments: {} as KeaStats }))
      )
    ),
    map(r => r.arguments ?? {}),
    shareReplay(1)
  );

  constructor(private kea: KeaService) {}
}
