import { Injectable }  from '@angular/core';
import { HttpClient }  from '@angular/common/http';
import { Observable }  from 'rxjs';
import { map }         from 'rxjs/operators';

export interface KeaResponse<T = unknown> {
  result:     number;
  text:       string;
  arguments?: T;
}

export interface KeaLease {
  'ip-address': string;
  'hw-address': string;
  hostname:     string;
  cltt:         number;
  'valid-lft':  number;
  'subnet-id':  number;
  state:        number;
}

export interface KeaReservation {
  'hw-address': string;
  'ip-address': string;
  hostname:     string;
  'subnet-id':  number;
}

export interface KeaOption {
  name:   string;
  data:   string;
  code?:  number;
  space?: string;
}

export interface KeaSubnet {
  id:               number;
  subnet:           string;
  pools:            { pool: string }[];
  'option-data':    KeaOption[];
  'valid-lifetime'?: number;
}

export interface Lease {
  mac:        string;
  ip:         string;
  hostname:   string;
  expiry:     string;
  assignedAt: string;
}

export interface PoolStats {
  total:     number;
  used:      number;
  available: number;
}

export function keaLeaseToLease(kl: KeaLease): Lease {
  return {
    ip:         kl['ip-address'],
    mac:        kl['hw-address'],
    hostname:   kl.hostname ?? '',
    assignedAt: new Date(kl.cltt * 1000).toISOString(),
    expiry:     new Date((kl.cltt + kl['valid-lft']) * 1000).toISOString()
  };
}

@Injectable({ providedIn: 'root' })
export class KeaService {
  constructor(private http: HttpClient) {}

  command<T>(
    command: string,
    args:    Record<string, unknown> = {},
    service: string[] = ['dhcp4']
  ): Observable<KeaResponse<T>> {
    const body: Record<string, unknown> = { command, service };
    if (Object.keys(args).length) body['arguments'] = args;
    return this.http.post<KeaResponse<T>[]>('/api/', body).pipe(
      map(responses => {
        const r = responses[0];
        if (r.result !== 0 && r.result !== 3) {
          throw new Error(r.text || 'Kea command failed');
        }
        return r;
      })
    );
  }
}
