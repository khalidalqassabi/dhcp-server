import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router }        from '@angular/router';
import { AuthService }   from '../services/auth.service';

const CHARS = '0123456789ABCDEF';
const COL_W = 20;
const FONT_SIZE = 13;

@Component({
  selector:    'app-login',
  templateUrl: './login.component.html',
  styleUrls:   ['./login.component.css']
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('matrixCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  form = this.fb.group({
    password: ['', Validators.required]
  });

  loading = false;
  error   = '';
  showPw  = false;

  private raf = 0;
  private drops: number[] = [];

  constructor(
    private fb:     FormBuilder,
    private auth:   AuthService,
    private router: Router
  ) {}

  ngAfterViewInit() {
    this.initCanvas();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.initCanvas();
  };

  private initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const cols = Math.floor(canvas.width / COL_W);
    this.drops = Array.from({ length: cols }, () => Math.random() * -canvas.height / FONT_SIZE);
    this.draw();
  }

  private draw() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(13, 17, 23, 0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < this.drops.length; i++) {
      const y = this.drops[i];
      if (y < 0) { this.drops[i] += 0.4; continue; }

      const t = Math.random();
      // head char — bright amber
      ctx.font        = `${FONT_SIZE}px "IBM Plex Mono", monospace`;
      ctx.fillStyle   = t > 0.92 ? '#ffffff' : '#ddb83a';
      ctx.shadowColor = '#ddb83a';
      ctx.shadowBlur  = t > 0.92 ? 12 : 6;
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * COL_W, y * FONT_SIZE);

      // trail char one step up — dim
      ctx.fillStyle   = 'rgba(139, 100, 20, 0.45)';
      ctx.shadowBlur  = 0;
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * COL_W, (y - 1) * FONT_SIZE);

      if (y * FONT_SIZE > canvas.height && Math.random() > 0.975) {
        this.drops[i] = 0;
      }
      this.drops[i] += 0.45;
    }

    ctx.shadowBlur = 0;
    this.raf = requestAnimationFrame(() => this.draw());
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error   = '';
    this.auth.login(this.form.value.password!).subscribe({
      next:  () => this.router.navigate(['/dashboard']),
      error: (e) => {
        this.error   = e.status === 401 ? 'Invalid password' : 'Connection failed — is Kea running?';
        this.loading = false;
      }
    });
  }
}
