import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription }   from 'rxjs';
import { StatisticsService, KeaStats, statValue } from '../services/statistics.service';
import { SubnetService }   from '../services/subnet.service';
import { KeaSubnet }       from '../services/kea.service';

interface SubnetStat {
  id:        number;
  subnet:    string;
  total:     number;
  assigned:  number;
  declined:  number;
  available: number;
  utilPct:   number;
}

@Component({
  selector:    'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls:   ['./statistics.component.css']
})
export class StatisticsComponent implements OnInit, OnDestroy {
  stats:       KeaStats     = {};
  subnets:     KeaSubnet[]  = [];
  subnetStats: SubnetStat[] = [];

  private sub!: Subscription;

  constructor(
    private statsSvc:  StatisticsService,
    private subnetSvc: SubnetService
  ) {}

  ngOnInit() {
    this.subnetSvc.getAll().subscribe(s => this.subnets = s);
    this.sub = this.statsSvc.stats$.subscribe(s => {
      this.stats = s;
      this.buildSubnetStats();
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  get pktReceived():   number { return statValue(this.stats, 'pkt4-received'); }
  get pktSent():       number { return statValue(this.stats, 'pkt4-sent'); }
  get totalDeclined(): number { return statValue(this.stats, 'declined-addresses'); }

  private buildSubnetStats() {
    this.subnetStats = this.subnets.map(s => {
      const total     = statValue(this.stats, `subnet[${s.id}].total-addresses`);
      const assigned  = statValue(this.stats, `subnet[${s.id}].assigned-addresses`);
      const declined  = statValue(this.stats, `subnet[${s.id}].declined-addresses`);
      const available = Math.max(0, total - assigned);
      const utilPct   = total > 0 ? (assigned / total) * 100 : 0;
      return { id: s.id, subnet: s.subnet, total, assigned, declined, available, utilPct };
    });
  }

  utilColor(pct: number): string {
    if (pct < 60) return '#3de89a';
    if (pct < 85) return '#ddb83a';
    return '#e84040';
  }
}
