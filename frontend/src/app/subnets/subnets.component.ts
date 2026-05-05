import { Component, OnInit }   from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SubnetService }        from '../services/subnet.service';
import { KeaSubnet }            from '../services/kea.service';

@Component({
  selector:    'app-subnets',
  templateUrl: './subnets.component.html',
  styleUrls:   ['./subnets.component.css']
})
export class SubnetsComponent implements OnInit {
  subnets: KeaSubnet[] = [];
  loading = false;
  saving  = false;
  error   = '';
  showForm = false;

  form = this.fb.group({
    id:         [null as number | null, [Validators.required, Validators.min(1)]],
    subnet:     ['', [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/)]],
    poolStart:  ['', [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,3}){3}$/)]],
    poolEnd:    ['', [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,3}){3}$/)]],
    router:     ['', Validators.pattern(/^\d{1,3}(\.\d{1,3}){3}$/)],
    dns:        [''],
    leaseTime:  [86400, [Validators.required, Validators.min(60)]]
  });

  constructor(private subnetSvc: SubnetService, private fb: FormBuilder) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.subnetSvc.getAll().subscribe({
      next:  s => { this.subnets = s; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.error  = '';
    const v = this.form.value;
    const optionData = [];
    if (v.router)   optionData.push({ name: 'routers',             data: v.router });
    if (v.dns)      optionData.push({ name: 'domain-name-servers', data: v.dns });

    const subnet: KeaSubnet = {
      id:               v.id!,
      subnet:           v.subnet!,
      pools:            [{ pool: `${v.poolStart} - ${v.poolEnd}` }],
      'option-data':    optionData,
      'valid-lifetime': v.leaseTime!
    };

    this.subnetSvc.set(subnet).subscribe({
      next: () => {
        this.saving   = false;
        this.showForm = false;
        this.form.reset({ leaseTime: 86400 });
        this.load();
      },
      error: (e) => { this.error = e.message || 'Save failed'; this.saving = false; }
    });
  }

  delete(id: number, cidr: string) {
    if (!confirm(`Delete subnet ${cidr}? All leases in this subnet will be affected.`)) return;
    this.subnetSvc.deleteById(id).subscribe({
      next:  () => this.load(),
      error: (e) => alert(e.message || 'Delete failed')
    });
  }

  getPool(subnet: KeaSubnet): string {
    return subnet.pools?.[0]?.pool ?? '—';
  }

  getOption(subnet: KeaSubnet, name: string): string {
    return subnet['option-data']?.find(o => o.name === name)?.data ?? '—';
  }
}
