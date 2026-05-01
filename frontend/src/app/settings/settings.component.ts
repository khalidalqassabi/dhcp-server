import { Component }      from '@angular/core';
import { FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService }    from '../services/auth.service';

@Component({
  selector:    'app-settings',
  templateUrl: './settings.component.html',
  styleUrls:   ['./settings.component.css']
})
export class SettingsComponent {
  loading  = false;
  success  = false;
  errorMsg = '';

  form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword:     ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: this.passwordsMatch }
  );

  constructor(private fb: FormBuilder, public auth: AuthService) {}

  private passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const np = group.get('newPassword')?.value;
    const cp = group.get('confirmPassword')?.value;
    return np && cp && np !== cp ? { mismatch: true } : null;
  }

  passwordStrength(pw: string): 'weak' | 'fair' | 'strong' {
    if (!pw || pw.length < 8) return 'weak';
    if (
      pw.length >= 12 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /[0-9]/.test(pw)
    ) return 'strong';
    if (/[0-9]/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) return 'fair';
    return 'weak';
  }

  get strengthLabel(): string {
    return this.passwordStrength(this.form.get('newPassword')?.value ?? '').toUpperCase();
  }

  get newPasswordValue(): string {
    return this.form.get('newPassword')?.value ?? '';
  }

  submit() {
    if (this.form.invalid || this.loading || this.success) return;
    this.loading  = true;
    this.errorMsg = '';
    const { currentPassword, newPassword } = this.form.value;
    this.auth.changePassword(currentPassword!, newPassword!).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        setTimeout(() => this.auth.logout(), 2000);
      },
      error: (e) => {
        this.loading  = false;
        this.errorMsg = e.error?.error || 'An error occurred';
      }
    });
  }
}
