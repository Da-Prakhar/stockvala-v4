'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyStore, getUploadUrl } from '@/store/companyStore';

const COUNTRIES = [
  'Afghanistan','Argentina','Australia','Bangladesh','Brazil','Canada','China','Colombia',
  'Egypt','France','Germany','Hong Kong','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Japan','Kenya','Kuwait','Malaysia','Mexico','Netherlands','New Zealand','Nigeria',
  'Norway','Oman','Pakistan','Philippines','Poland','Qatar','Russia','Saudi Arabia','Singapore',
  'South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Thailand','Turkey',
  'UAE','United Kingdom','United States','Vietnam',
];

interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  referralCode: string;
  terms: boolean;
  marketingOptIn: boolean;
}

function RegisterInner() {
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get('ref') || '';
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const { register: registerUser, isLoading, redirectToDashboard } = useAuthStore();
  const { companyName, logoUrl } = useCompanyStore();

  const { register, handleSubmit, formState: { errors }, watch, getValues, setValue } = useForm<RegisterForm>({
    defaultValues: { email: '', password: '', confirmPassword: '', firstName: '', lastName: '', phone: '', country: '', referralCode: refFromUrl, terms: false, marketingOptIn: false },
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    if (refFromUrl) setValue('referralCode', refFromUrl);
  }, [refFromUrl, setValue]);

  const password = watch('password');
  const logoSrc = logoUrl ? getUploadUrl(logoUrl) : null;

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser({ firstName: data.firstName, lastName: data.lastName, email: data.email, password: data.password, referralCode: data.referralCode });
      toast.success('Registration successful! Redirecting...');
      setTimeout(() => redirectToDashboard(), 1000);
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Registration failed. Please try again.');
    }
  };

  const handleNext = () => {
    if (step === 1) {
      const [email, pw, cpw] = getValues(['email', 'password', 'confirmPassword']);
      if (!email || !pw || !cpw) { toast.error('Please fill all fields'); return; }
      if (pw !== cpw) { toast.error('Passwords do not match'); return; }
    }
    if (step === 2) {
      const [fn, ln, ph, co] = getValues(['firstName', 'lastName', 'phone', 'country']);
      if (!fn || !ln || !ph || !co) { toast.error('Please fill all fields'); return; }
    }
    setStep(s => s + 1);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--thm-black-bg, #000420)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 40px' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

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
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 28, marginBottom: 8 }}>Create Account</h2>
          <p style={{ color: 'var(--thm-body-font-color-2)', fontSize: 16 }}>Join 500K+ traders worldwide</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? 'var(--thm-primary-color)' : '#1a1e37', transition: 'background 0.3s' }} />
          ))}
        </div>
        <p style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginBottom: 24 }}>Step {step} of 3</p>

        {/* Card */}
        <div style={{ background: 'var(--thm-black-bg-2, #0a0e29)', border: '1px solid var(--thm-border-color-1, #1a1e37)', borderRadius: 12, padding: '36px 32px' }}>
          <form onSubmit={handleSubmit(onSubmit)}>

            {/* Step 1 - Email & Password */}
            {step === 1 && (
              <div>
                <div className="mb-4">
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" placeholder="Enter your email" {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Valid email required' } })} style={inputStyle} />
                  {errors.email && <p style={errorStyle}>{errors.email.message}</p>}
                </div>
                <div className="mb-4" style={{ position: 'relative' }}>
                  <label style={labelStyle}>Password</label>
                  <input type={showPassword ? 'text' : 'password'} placeholder="Create a strong password" {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' } })} style={{ ...inputStyle, paddingRight: 48 }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtnStyle}>
                    <i className={showPassword ? 'fa fa-eye-slash' : 'fa fa-eye'} />
                  </button>
                  {errors.password && <p style={errorStyle}>{errors.password.message}</p>}
                </div>
                <div className="mb-4">
                  <label style={labelStyle}>Confirm Password</label>
                  <input type="password" placeholder="Re-enter your password" {...register('confirmPassword', { required: 'Please confirm password', validate: v => v === password || 'Passwords do not match' })} style={inputStyle} />
                  {errors.confirmPassword && <p style={errorStyle}>{errors.confirmPassword.message}</p>}
                </div>
              </div>
            )}

            {/* Step 2 - Personal Info */}
            {step === 2 && (
              <div>
                <div className="mb-4">
                  <label style={labelStyle}>First Name</label>
                  <input type="text" placeholder="John" {...register('firstName', { required: 'First name is required' })} style={inputStyle} />
                  {errors.firstName && <p style={errorStyle}>{errors.firstName.message}</p>}
                </div>
                <div className="mb-4">
                  <label style={labelStyle}>Last Name</label>
                  <input type="text" placeholder="Doe" {...register('lastName', { required: 'Last name is required' })} style={inputStyle} />
                  {errors.lastName && <p style={errorStyle}>{errors.lastName.message}</p>}
                </div>
                <div className="mb-4">
                  <label style={labelStyle}>Phone Number</label>
                  <input type="tel" placeholder="+1 (555) 000-0000" {...register('phone', { required: 'Phone is required' })} style={inputStyle} />
                  {errors.phone && <p style={errorStyle}>{errors.phone.message}</p>}
                </div>
                <div className="mb-4">
                  <label style={labelStyle}>Country</label>
                  <select {...register('country', { required: 'Country is required' })} style={selectStyle}>
                    <option value="">Select your country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.country && <p style={errorStyle}>{errors.country.message}</p>}
                </div>
              </div>
            )}

            {/* Step 3 - Referral & Terms */}
            {step === 3 && (
              <div>
                <div className="mb-4">
                  <label style={labelStyle}>Referral Code (Optional)</label>
                  <input type="text" placeholder="Enter referral code if you have one" {...register('referralCode')} style={inputStyle} />
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '14px 16px', borderRadius: 8, background: 'rgba(80,250,123,0.08)', border: '1px solid rgba(80,250,123,0.2)', marginBottom: 16 }}>
                  <input type="checkbox" {...register('terms', { required: 'You must accept the terms' })} style={{ accentColor: 'var(--thm-primary-color)', marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#ccc' }}>
                    I agree to the{' '}
                    <Link href="#" style={{ color: 'var(--thm-primary-color)', textDecoration: 'none' }}>Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="#" style={{ color: 'var(--thm-primary-color)', textDecoration: 'none' }}>Privacy Policy</Link>
                  </span>
                </label>
                {errors.terms && <p style={errorStyle}>{errors.terms.message}</p>}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
                  <input type="checkbox" {...register('marketingOptIn')} style={{ accentColor: 'var(--thm-primary-color)', marginTop: 2 }} />
                  <span style={{ fontSize: 14, color: '#aaa' }}>I want to receive updates and promotions</span>
                </label>
                <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderRadius: 8, background: 'rgba(80,250,123,0.06)', border: '1px solid rgba(80,250,123,0.15)', marginBottom: 8 }}>
                  <i className="fa fa-check-circle" style={{ color: 'var(--thm-primary-color)', marginTop: 2 }} />
                  <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>All fields completed! Review and click &quot;Create Account&quot; to get started.</p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              {step > 1 && (
                <button type="button" onClick={() => setStep(s => s - 1)} style={secondaryBtnStyle}>Back</button>
              )}
              {step < 3 ? (
                <button type="button" onClick={handleNext} className="btn-one" style={{ flex: 1, border: 'none', cursor: 'pointer' }}>
                  <span className="txt">Next<i className="icon-right-arrow"></i></span>
                </button>
              ) : (
                <button type="submit" disabled={isLoading} className="btn-one" style={{ flex: 1, border: 'none', cursor: isLoading ? 'wait' : 'pointer' }}>
                  <span className="txt">{isLoading ? 'Creating Account...' : 'Create Account'}<i className="icon-right-arrow"></i></span>
                </button>
              )}
            </div>
          </form>

          <div style={{ textAlign: 'center', marginTop: 24, color: '#aaa', fontSize: 14 }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--thm-primary-color)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', background: '#000420', border: '1px solid var(--thm-border-color-1, #1a1e37)', borderRadius: 8, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const labelStyle: React.CSSProperties = { display: 'block', color: '#ccc', fontSize: 14, marginBottom: 8, fontWeight: 500 };
const errorStyle: React.CSSProperties = { color: '#ff6b6b', fontSize: 12, marginTop: 4 };
const secondaryBtnStyle: React.CSSProperties = { flex: 1, padding: '12px 24px', background: 'transparent', border: '1px solid var(--thm-border-color-1, #1a1e37)', borderRadius: 8, color: '#ccc', fontSize: 15, cursor: 'pointer', fontWeight: 500 };
const eyeBtnStyle: React.CSSProperties = { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--thm-body-font-color-2)', cursor: 'pointer', padding: 0 };
