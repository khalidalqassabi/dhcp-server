import { Component }     from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router }        from '@angular/router';
import { AuthService }   from '../services/auth.service';

@Component({
  selector:    'app-login',
  templateUrl: './login.component.html',
  styleUrls:   ['./login.component.css']
})
export class LoginComponent {
  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  loading = false;
  error   = '';
  showPw  = false;

  constructor(
    private fb:   FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {}

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error   = '';
    const { username, password } = this.form.value;
    this.auth.login(username!, password!).subscribe({
      next:  () => this.router.navigate(['/dashboard']),
      error: (e) => {
        this.error   = e.error?.error || 'Login failed';
        this.loading = false;
      }
    });
  }
}
