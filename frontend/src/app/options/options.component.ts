import { Component, OnInit }   from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { OptionService }        from '../services/option.service';
import { KeaOption }            from '../services/kea.service';

const COMMON_OPTIONS: { name: string; placeholder: string }[] = [
  { name: 'routers',              placeholder: '192.168.1.1' },
  { name: 'domain-name-servers',  placeholder: '8.8.8.8, 8.8.4.4' },
  { name: 'domain-name',          placeholder: 'example.com' },
  { name: 'ntp-servers',          placeholder: '192.168.1.1' },
  { name: 'broadcast-address',    placeholder: '192.168.1.255' },
];

@Component({
  selector:    'app-options',
  templateUrl: './options.component.html',
  styleUrls:   ['./options.component.css']
})
export class OptionsComponent implements OnInit {
  options:      KeaOption[] = [];
  commonOptions = COMMON_OPTIONS;
  loading  = false;
  saving   = false;
  error    = '';
  showForm = false;

  form = this.fb.group({
    name:       ['', Validators.required],
    data:       ['', Validators.required],
    customName: ['']
  });

  get nameValue(): string { return this.form.value.name || ''; }

  constructor(private optionSvc: OptionService, private fb: FormBuilder) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.optionSvc.getGlobalAll().subscribe({
      next:  o => { this.options = o; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  getPlaceholder(name: string): string {
    return this.commonOptions.find(o => o.name === name)?.placeholder ?? '';
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.error  = '';
    const v = this.form.value;
    const name = v.name === 'custom' ? v.customName! : v.name!;
    this.optionSvc.setGlobal([{ name, data: v.data! }]).subscribe({
      next: () => {
        this.saving   = false;
        this.showForm = false;
        this.form.reset();
        this.load();
      },
      error: (e) => { this.error = e.message || 'Save failed'; this.saving = false; }
    });
  }

  delete(option: KeaOption) {
    if (!option.code) { alert('Cannot delete option without a code.'); return; }
    if (!confirm(`Delete global option "${option.name}"?`)) return;
    this.optionSvc.deleteGlobal(option.code).subscribe({
      next:  () => this.load(),
      error: (e) => alert(e.message || 'Delete failed')
    });
  }
}
