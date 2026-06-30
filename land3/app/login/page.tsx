'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyStore, getUploadUrl } from '@/store/companyStore';

interface LoginForm {
  email: string;
  password: string;
  remember: boolean;
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, redirectToDashboard } = useAuthStore();
  const { companyName, logoUrl } = useCompanyStore();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    defaultValues: { email: '', password: '', remember: false },
  });

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast.success('Login successful! Redirecting to dashboard...');
      setTimeout(() => redirectToDashboard(), 1000);
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Login failed. Please try again.');
    }
  };

  const logoSrc = logoUrl ? getUploadUrl(logoUrl) : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--thm-black-bg, #000420)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 40px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div className="text-center mb-5">
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 24 }}>
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={companyName} style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 40, height: 40, background: 'var(--thm-primary-color)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#000', fontWeight: 700, fontSize: 14 }}>{companyName.substring(0, 2).toUpperCase()}</span>
              </div>
            )}
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--thm-primary-color)' }}>{companyName}</span>
          </Link>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 28, marginBottom: 8 }}>Welcome Back</h2>
          <p style={{ color: 'var(--thm-body-font-color-2)', fontSize: 16 }}>Sign in to your trading account</p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--thm-black-bg-2, #0a0e29)', border: '1px solid var(--thm-border-color-1, #1a1e37)', borderRadius: 12, padding: '36px 32px' }}>
          <form onSubmit={handleSubmit(onSubmit)}>

            {/* Email */}
            <div className="mb-4">
              <label style={{ display: 'block', color: '#ccc', fontSize: 14, marginBottom: 8, fontWeight: 500 }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <i className="icon-email" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--thm-body-font-color-2)' }} />
                <input
                  type="email"
                  placeholder="Enter your email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                  })}
                  style={inputStyle}
                />
              </div>
              {errors.email && <p style={errorStyle}>{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="mb-4">
              <label style={{ display: 'block', color: '#ccc', fontSize: 14, marginBottom: 8, fontWeight: 500 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <i className="icon-lock" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--thm-body-font-color-2)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'At least 6 characters' } })}
                  style={{ ...inputStyle, paddingRight: 48 }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--thm-body-font-color-2)', cursor: 'pointer', padding: 0 }}>
                  <i className={showPassword ? 'fa fa-eye-slash' : 'fa fa-eye'} />
                </button>
              </div>
              {errors.password && <p style={errorStyle}>{errors.password.message}</p>}
            </div>

            {/* Remember / Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#aaa', fontSize: 14 }}>
                <input type="checkbox" {...register('remember')} style={{ accentColor: 'var(--thm-primary-color)' }} />
                Remember me
              </label>
              <Link href="/forgot-password" style={{ color: 'var(--thm-primary-color)', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button type="submit" disabled={isLoading} className="btn-one" style={{ width: '100%', border: 'none', cursor: isLoading ? 'wait' : 'pointer' }}>
              <span className="txt">{isLoading ? 'Signing In...' : 'Sign In'}<i className="icon-right-arrow"></i></span>
            </button>

          </form>

          <div style={{ textAlign: 'center', marginTop: 24, color: '#aaa', fontSize: 14 }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color: 'var(--thm-primary-color)', textDecoration: 'none', fontWeight: 600 }}>Sign up here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px 12px 44px',
  background: '#000420',
  border: '1px solid var(--thm-border-color-1, #1a1e37)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
  color: '#ff6b6b',
  fontSize: 12,
  marginTop: 4,
};
