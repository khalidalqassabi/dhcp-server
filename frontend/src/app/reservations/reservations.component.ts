import { Component, OnInit }   from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ReservationService }  from '../services/reservation.service';
import { SubnetService }        from '../services/subnet.service';
import { KeaReservation, KeaSubnet } from '../services/kea.service';

@Component({
  selector:    'app-reservations',
  templateUrl: './reservations.component.html',
  styleUrls:   ['./reservations.component.css']
})
export class ReservationsComponent implements OnInit {
  reservations: KeaReservation[] = [];
  subnets:      KeaSubnet[]      = [];
  loading   = false;
  saving    = false;
  error     = '';
  showForm  = false;
  selectedSubnetId = 0;

  form = this.fb.group({
    subnetId:  [0, [Validators.required, Validators.min(1)]],
    hwAddress: ['', [Validators.required, Validators.pattern(/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/)]],
    ipAddress: ['', [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,3}){3}$/)]],
    hostname:  ['']
  });

  constructor(
    private reservSvc:  ReservationService,
    private subnetSvc:  SubnetService,
    private fb:         FormBuilder
  ) {}

  ngOnInit() {
    this.subnetSvc.getAll().subscribe({
      next: subnets => {
        this.subnets = subnets;
        if (subnets.length) {
          this.selectedSubnetId = subnets[0].id;
          this.loadReservations();
        }
      }
    });
  }

  loadReservations() {
    if (!this.selectedSubnetId) return;
    this.loading = true;
    this.reservSvc.getPage(this.selectedSubnetId).subscribe({
      next:  r => { this.reservations = r; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  selectSubnet(id: number) {
    this.selectedSubnetId = id;
    this.loadReservations();
  }

  add() {
    if (this.form.invalid) return;
    this.saving = true;
    this.error  = '';
    const v = this.form.value;
    const reservation: KeaReservation = {
      'subnet-id':  Number(v.subnetId),
      'hw-address': v.hwAddress!.toLowerCase(),
      'ip-address': v.ipAddress!,
      hostname:     v.hostname || ''
    };
    this.reservSvc.add(reservation).subscribe({
      next: () => {
        this.saving   = false;
        this.showForm = false;
        this.form.reset({ subnetId: this.selectedSubnetId });
        this.loadReservations();
      },
      error: (e) => {
        this.error  = e.message || 'Failed to add reservation';
        this.saving = false;
      }
    });
  }

  delete(r: KeaReservation) {
    if (!confirm(`Delete reservation for ${r['hw-address']} (${r['ip-address']})?`)) return;
    this.reservSvc.delete(r['subnet-id'], r['hw-address']).subscribe({
      next: () => this.loadReservations(),
      error: (e) => alert(e.message || 'Delete failed')
    });
  }
}
