'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { useCompanyStore, getUploadUrl } from '@/store/companyStore';
import { getApiUrl } from '@/lib/domainConfig';

interface ForgotForm { email: string }

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const { companyName, logoUrl } = useCompanyStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotForm>({ defaultValues: { email: '' } });
  const logoSrc = logoUrl ? getUploadUrl(logoUrl) : null;

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const onSubmit = async (data: ForgotForm) => {
    try {
      await fetch(`${getApiUrl()}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
    } catch (_) { /* show success anyway to prevent email enumeration */ }
    setSubmitted(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--thm-black-bg, #000420)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 40px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

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
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 28, marginBottom: 8 }}>
            {submitted ? 'Check Your Email' : 'Reset Password'}
          </h2>
          <p style={{ color: 'var(--thm-body-font-color-2)', fontSize: 16 }}>
            {submitted ? 'We sent you a password reset link' : 'Enter your email to receive a reset link'}
          </p>
        </div>

        <div style={{ background: 'var(--thm-black-bg-2, #0a0e29)', border: '1px solid var(--thm-border-color-1, #1a1e37)', borderRadius: 12, padding: '36px 32px' }}>
          {!submitted ? (
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-4">
                <label style={{ display: 'block', color: '#ccc', fontSize: 14, marginBottom: 8, fontWeight: 500 }}>Email Address</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Valid email required' } })}
                  style={{ width: '100%', padding: '12px 14px', background: '#000420', border: '1px solid var(--thm-border-color-1, #1a1e37)', borderRadius: 8, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const }}
                />
                {errors.email && <p style={{ color: '#ff6b6b', fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-one" style={{ width: '100%', border: 'none', cursor: isSubmitting ? 'wait' : 'pointer', marginBottom: 16 }}>
                <span className="txt">{isSubmitting ? 'Sending...' : 'Send Reset Link'}<i className="icon-right-arrow"></i></span>
              </button>
              <div className="text-center">
                <Link href="/login" style={{ color: 'var(--thm-body-font-color-2)', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa fa-arrow-left" /> Back to Login
                </Link>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(80,250,123,0.1)', border: '2px solid rgba(80,250,123,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <i className="fa fa-check" style={{ fontSize: 28, color: 'var(--thm-primary-color)' }} />
              </div>
              <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>Email Sent!</h3>
              <p style={{ color: '#aaa', fontSize: 14, marginBottom: 24 }}>
                Check your inbox for a password reset link. The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
              </p>
              <Link href="/login">
                <button className="btn-one" style={{ border: 'none', cursor: 'pointer' }}>
                  <span className="txt">Back to Login<i className="icon-right-arrow"></i></span>
                </button>
              </Link>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 8, background: 'rgba(80,250,123,0.06)', border: '1px solid rgba(80,250,123,0.15)' }}>
          <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>
            <span style={{ color: 'var(--thm-primary-color)', fontWeight: 500 }}>Having trouble?</span>{' '}
            Contact support at support@{companyName.toLowerCase().replace(/\s+/g, '')}.com
          </p>
        </div>
      </div>
    </div>
  );
}
