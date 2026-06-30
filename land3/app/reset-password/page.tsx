'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useCompanyStore, getUploadUrl } from '@/store/companyStore';
import { getApiUrl } from '@/lib/domainConfig';

interface ResetForm { password: string; confirmPassword: string }
type Status = 'form' | 'success' | 'error' | 'invalid';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>(token ? 'form' : 'invalid');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const { companyName, logoUrl } = useCompanyStore();
  const logoSrc = logoUrl ? getUploadUrl(logoUrl) : null;

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ResetForm>({ defaultValues: { password: '', confirmPassword: '' } });

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const onSubmit = async (data: ResetForm) => {
    try {
      const res = await fetch(`${getApiUrl()}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = await res.json();
      if (res.ok) { setStatus('success'); }
      else { setErrorMsg(json.message || 'Invalid or expired token'); setStatus('error'); }
    } catch (_) {
      setErrorMsg('Something went wrong. Please try again.'); setStatus('error');
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px 12px 14px', paddingRight: 48, background: '#000420', border: '1px solid var(--thm-border-color-1, #1a1e37)', borderRadius: 8, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' };

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
            {status === 'success' ? 'Password Reset!' : (status === 'error' || status === 'invalid') ? 'Reset Failed' : 'Set New Password'}
          </h2>
          <p style={{ color: 'var(--thm-body-font-color-2)', fontSize: 16 }}>
            {status === 'success' ? 'Your password has been updated successfully'
              : status === 'invalid' ? 'This reset link is invalid or missing'
              : status === 'error' ? errorMsg
              : 'Enter your new password below'}
          </p>
        </div>

        <div style={{ background: 'var(--thm-black-bg-2, #0a0e29)', border: '1px solid var(--thm-border-color-1, #1a1e37)', borderRadius: 12, padding: '36px 32px' }}>

          {status === 'form' && (
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-4" style={{ position: 'relative' }}>
                <label style={{ display: 'block', color: '#ccc', fontSize: 14, marginBottom: 8, fontWeight: 500 }}>New Password</label>
                <input type={showPw ? 'text' : 'password'} placeholder="Enter new password" {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' } })} style={inputStyle} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 14, top: '50%', marginTop: 12, background: 'none', border: 'none', color: 'var(--thm-body-font-color-2)', cursor: 'pointer' }}>
                  <i className={showPw ? 'fa fa-eye-slash' : 'fa fa-eye'} />
                </button>
                {errors.password && <p style={{ color: '#ff6b6b', fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
              </div>
              <div className="mb-4" style={{ position: 'relative' }}>
                <label style={{ display: 'block', color: '#ccc', fontSize: 14, marginBottom: 8, fontWeight: 500 }}>Confirm Password</label>
                <input type={showCpw ? 'text' : 'password'} placeholder="Confirm new password" {...register('confirmPassword', { required: 'Please confirm password', validate: v => v === watch('password') || 'Passwords do not match' })} style={inputStyle} />
                <button type="button" onClick={() => setShowCpw(!showCpw)} style={{ position: 'absolute', right: 14, top: '50%', marginTop: 12, background: 'none', border: 'none', color: 'var(--thm-body-font-color-2)', cursor: 'pointer' }}>
                  <i className={showCpw ? 'fa fa-eye-slash' : 'fa fa-eye'} />
                </button>
                {errors.confirmPassword && <p style={{ color: '#ff6b6b', fontSize: 12, marginTop: 4 }}>{errors.confirmPassword.message}</p>}
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-one" style={{ width: '100%', border: 'none', cursor: isSubmitting ? 'wait' : 'pointer', marginBottom: 16 }}>
                <span className="txt">{isSubmitting ? 'Resetting...' : 'Reset Password'}<i className="icon-right-arrow"></i></span>
              </button>
              <div className="text-center">
                <Link href="/login" style={{ color: 'var(--thm-body-font-color-2)', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <i className="fa fa-arrow-left" /> Back to Login
                </Link>
              </div>
            </form>
          )}

          {status === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(80,250,123,0.1)', border: '2px solid rgba(80,250,123,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <i className="fa fa-check" style={{ fontSize: 28, color: 'var(--thm-primary-color)' }} />
              </div>
              <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>All Set!</h3>
              <p style={{ color: '#aaa', fontSize: 14, marginBottom: 24 }}>Your password has been reset. You can now log in with your new password.</p>
              <Link href="/login">
                <button className="btn-one" style={{ border: 'none', cursor: 'pointer' }}>
                  <span className="txt">Go to Login<i className="icon-right-arrow"></i></span>
                </button>
              </Link>
            </div>
          )}

          {(status === 'error' || status === 'invalid') && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,107,107,0.1)', border: '2px solid rgba(255,107,107,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <i className="fa fa-times" style={{ fontSize: 28, color: '#ff6b6b' }} />
              </div>
              <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>{status === 'invalid' ? 'Invalid Link' : 'Reset Failed'}</h3>
              <p style={{ color: '#aaa', fontSize: 14, marginBottom: 24 }}>
                {status === 'invalid' ? 'This password reset link is invalid or has expired. Please request a new one.' : errorMsg}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <Link href="/forgot-password" style={{ flex: 1 }}>
                  <button className="btn-one" style={{ width: '100%', border: 'none', cursor: 'pointer' }}>
                    <span className="txt">New Link<i className="icon-right-arrow"></i></span>
                  </button>
                </Link>
                <Link href="/login" style={{ flex: 1 }}>
                  <button style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #1a1e37', borderRadius: 8, color: '#ccc', cursor: 'pointer' }}>
                    Back to Login
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
