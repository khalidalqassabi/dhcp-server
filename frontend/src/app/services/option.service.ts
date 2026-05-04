import { Injectable }  from '@angular/core';
import { Observable }  from 'rxjs';
import { map }         from 'rxjs/operators';
import { KeaService, KeaOption } from './kea.service';

const REMOTE = { type: 'mysql' };
const SERVER_TAGS = ['dhcp-admin'];

@Injectable({ providedIn: 'root' })
export class OptionService {
  constructor(private kea: KeaService) {}

  getGlobalAll(): Observable<KeaOption[]> {
    return this.kea.command<{ options: KeaOption[] }>(
      'remote-option4-global-get-all',
      { remote: REMOTE, 'server-tags': SERVER_TAGS }
    ).pipe(map(r => r.arguments?.options ?? []));
  }

  setGlobal(options: KeaOption[]): Observable<void> {
    return this.kea.command('remote-option4-global-set', {
      remote:       REMOTE,
      'server-tags': SERVER_TAGS,
      options
    }).pipe(map(() => void 0));
  }

  deleteGlobal(code: number): Observable<void> {
    return this.kea.command('remote-option4-global-del', {
      remote:       REMOTE,
      'server-tags': SERVER_TAGS,
      options:      [{ code }]
    }).pipe(map(() => void 0));
  }
}
