import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router }        from '@angular/router';
import { AuthService }   from '../services/auth.service';

const CHARS    = '0123456789ABCDEF';
const COL_W    = 20;
const FONT_SIZE = 13;

const MAX_ATTEMPTS      = 5;
const LOCKOUT_SECONDS   = 30;
const RATE_KEY          = 'kea_rate';

interface RateState { attempts: number; lockedUntil: number; }

@Component({
  selector:    'app-login',
  templateUrl: './login.component.html',
  styleUrls:   ['./login.component.css']
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('matrixCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pwInput')      pwInput!:   ElementRef<HTMLInputElement>;

  form = this.fb.group({
    password: ['', Validators.required]
  });

  loading          = false;
  error            = '';
  showPw           = false;
  shaking          = false;
  capsLock         = false;
  lockoutRemaining = 0;

  private raf             = 0;
  private drops:  number[] = [];
  private lockoutTimer: ReturnType<typeof setInterval> | null = null;

  get isLockedOut(): boolean { return this.lockoutRemaining > 0; }

  constructor(
    private fb:     FormBuilder,
    private auth:   AuthService,
    private router: Router
  ) {}

  ngAfterViewInit() {
    this.initCanvas();
    window.addEventListener('resize', this.onResize);
    this.checkExistingLockout();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    if (this.lockoutTimer) clearInterval(this.lockoutTimer);
  }

  // B — caps lock detection
  onKey(event: KeyboardEvent) {
    this.capsLock = event.getModifierState('CapsLock');
  }

  submit() {
    if (this.form.invalid || this.isLockedOut || this.loading) return;

    const state = this.getRateState();
    if (state.lockedUntil > Date.now()) return;

    this.loading = true;
    this.error   = '';

    this.auth.login(this.form.value.password!).subscribe({
      next: () => {
        this.clearRateState();
        this.router.navigate(['/dashboard']);
      },
      error: (e) => {
        this.loading = false;

        if (e.status === 401) {
          state.attempts++;
          if (state.attempts >= MAX_ATTEMPTS) {
            state.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
            this.saveRateState(state);
            this.error = `Too many failed attempts. Locked for ${LOCKOUT_SECONDS}s.`;
            this.startLockoutCountdown(LOCKOUT_SECONDS);
          } else {
            this.saveRateState(state);
            const left = MAX_ATTEMPTS - state.attempts;
            this.error = `Invalid password — ${left} attempt${left === 1 ? '' : 's'} remaining`;
          }
        } else {
          this.error = 'Connection failed — is Kea running?';
        }

        // A — shake panel
        this.shaking = true;
        setTimeout(() => this.shaking = false, 600);

        // C — auto-focus + select all
        setTimeout(() => {
          this.pwInput?.nativeElement.focus();
          this.pwInput?.nativeElement.select();
        }, 50);
      }
    });
  }

  // ── Rate limit helpers ──────────────────────────────────────────────────────

  private getRateState(): RateState {
    try {
      const raw = sessionStorage.getItem(RATE_KEY);
      return raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: 0 };
    } catch { return { attempts: 0, lockedUntil: 0 }; }
  }

  private saveRateState(s: RateState) {
    sessionStorage.setItem(RATE_KEY, JSON.stringify(s));
  }

  private clearRateState() {
    sessionStorage.removeItem(RATE_KEY);
  }

  private checkExistingLockout() {
    const state = this.getRateState();
    const remaining = Math.ceil((state.lockedUntil - Date.now()) / 1000);
    if (remaining > 0) {
      this.error = `Too many failed attempts. Locked for ${remaining}s.`;
      this.startLockoutCountdown(remaining);
    }
  }

  private startLockoutCountdown(seconds: number) {
    this.lockoutRemaining = seconds;
    if (this.lockoutTimer) clearInterval(this.lockoutTimer);
    this.lockoutTimer = setInterval(() => {
      this.lockoutRemaining--;
      if (this.lockoutRemaining <= 0) {
        this.lockoutRemaining = 0;
        this.error = '';
        clearInterval(this.lockoutTimer!);
        this.lockoutTimer = null;
        setTimeout(() => this.pwInput?.nativeElement.focus(), 50);
      }
    }, 1000);
  }

  // ── Matrix canvas ────────────────────────────��──────────────────────────────

  private onResize = () => this.initCanvas();

  private initCanvas() {
    const canvas  = this.canvasRef.nativeElement;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const cols    = Math.floor(canvas.width / COL_W);
    this.drops    = Array.from({ length: cols }, () => Math.random() * -canvas.height / FONT_SIZE);
    cancelAnimationFrame(this.raf);
    this.draw();
  }

  private draw() {
    const canvas = this.canvasRef.nativeElement;
    const ctx    = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(13, 17, 23, 0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < this.drops.length; i++) {
      const y = this.drops[i];
      if (y < 0) { this.drops[i] += 0.4; continue; }

      const t = Math.random();
      ctx.font      = `${FONT_SIZE}px "IBM Plex Mono", monospace`;
      ctx.fillStyle = t > 0.92 ? '#ffffff' : '#ddb83a';
      ctx.shadowColor = '#ddb83a';
      ctx.shadowBlur  = t > 0.92 ? 12 : 6;
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * COL_W, y * FONT_SIZE);

      ctx.fillStyle  = 'rgba(139, 100, 20, 0.45)';
      ctx.shadowBlur = 0;
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * COL_W, (y - 1) * FONT_SIZE);

      if (y * FONT_SIZE > canvas.height && Math.random() > 0.975) this.drops[i] = 0;
      this.drops[i] += 0.45;
    }

    ctx.shadowBlur = 0;
    this.raf = requestAnimationFrame(() => this.draw());
  }
}
