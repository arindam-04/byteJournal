import { useEffect, useState } from 'react';
import { Camera, Check, KeyRound, Mail, Save, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../api';

const initialProfile = (user = {}) => ({
  name: user.name || '',
  email: user.email || '',
  bio: user.bio || '',
  expertise: user.expertise || '',
  avatar_url: user.avatar_url || ''
});

function initials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'BJ';
}

function dateLabel(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminProfilePanel({ user, onUserUpdated }) {
  const [profile, setProfile] = useState(() => initialProfile(user));
  const [loading, setLoading] = useState(true);
  const [accountMeta, setAccountMeta] = useState({ created_at: user?.created_at, last_login_at: user?.last_login_at });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    let active = true;
    api.profile().then(({ profile: data }) => {
      if (active && data) { setProfile(initialProfile(data)); setAccountMeta({ created_at: data.created_at, last_login_at: data.last_login_at }); }
    }).catch(error => {
      if (active) setProfileError(error.message || 'Unable to load your profile.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const update = (key, value) => setProfile(current => ({ ...current, [key]: value }));
  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setSaving(true);
    try {
      const result = await api.updateProfile(profile);
      setProfile(initialProfile(result.profile));
      setAccountMeta({ created_at: result.profile.created_at, last_login_at: result.profile.last_login_at });
      onUserUpdated?.(result.user);
      setProfileMessage('Your profile has been updated successfully.');
    } catch (error) {
      setProfileError(error.message || 'Unable to save your profile.');
    } finally { setSaving(false); }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfileError('');
    setUploading(true);
    try {
      const result = await api.uploadImage(file);
      update('avatar_url', result.url);
      setProfileMessage('Profile photo uploaded. Save your profile to apply it.');
    } catch (error) {
      setProfileError(error.message || 'Unable to upload profile photo.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('The new password and confirmation do not match.');
      return;
    }
    if (passwords.newPassword.length < 12) {
      setPasswordError('Your new password must contain at least 12 characters.');
      return;
    }
    setChangingPassword(true);
    try {
      const result = await api.changePassword(passwords.currentPassword, passwords.newPassword);
      setPasswordMessage(result.message || 'Password changed successfully.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError(error.message || 'Unable to change your password.');
    } finally { setChangingPassword(false); }
  };

  return (
    <section className="admin-profile-page">
      <div className="admin-profile-heading">
        <div>
          <span className="section-kicker">ACCOUNT SETTINGS</span>
          <h1>My profile</h1>
          <p>Manage your public author details and keep your administrator account secure.</p>
        </div>
        <span className="admin-profile-role"><ShieldCheck size={15}/>{String(user?.role || 'user').replaceAll('_', ' ')}</span>
      </div>

      {loading ? <div className="admin-profile-loading">Loading your account details…</div> : <div className="admin-profile-grid">
        <form className="admin-profile-card admin-profile-details" onSubmit={saveProfile}>
          <div className="admin-profile-card-heading">
            <div className="admin-profile-section-icon"><UserRound size={18}/></div>
            <div><h2>Personal information</h2><p>These details identify you across ByteJournal.</p></div>
          </div>
          {profileError && <div className="notice notice-error">{profileError}</div>}
          {profileMessage && <div className="notice notice-success"><Check size={15}/>{profileMessage}</div>}

          <div className="admin-profile-avatar-row">
            <div className="admin-profile-avatar">
              {profile.avatar_url ? <img src={api.assetUrl(profile.avatar_url)} alt={`${profile.name || 'Admin'} profile`} /> : <span>{initials(profile.name)}</span>}
            </div>
            <div className="admin-profile-avatar-copy">
              <strong>Profile photo</strong>
              <span>JPG, PNG, WEBP or GIF · up to 5 MB</span>
              <label className="button button-outline button-small admin-avatar-upload"><Camera size={14}/>{uploading ? 'Uploading…' : 'Upload photo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadAvatar} disabled={uploading}/></label>
              {profile.avatar_url && <button type="button" className="admin-profile-remove-avatar" onClick={() => update('avatar_url', '')}>Remove photo</button>}
            </div>
          </div>

          <div className="admin-profile-fields">
            <label className="field-label">Full name<input value={profile.name} onChange={e => update('name', e.target.value)} minLength="2" maxLength="120" autoComplete="name" required /></label>
            <label className="field-label">Email address<input type="email" value={profile.email} onChange={e => update('email', e.target.value)} maxLength="254" autoComplete="email" required /><small>Used for signing in and account recovery.</small></label>
            <label className="field-label">Professional expertise<input value={profile.expertise} onChange={e => update('expertise', e.target.value)} maxLength="180" placeholder="e.g. Web development, database design" /></label>
            <label className="field-label">Short biography<textarea value={profile.bio} onChange={e => update('bio', e.target.value)} rows="5" maxLength="1000" placeholder="Write a short introduction about yourself…"/><small>{profile.bio.length}/1000 characters</small></label>
          </div>
          <div className="admin-profile-form-footer"><span>Changes are visible wherever your author profile is displayed.</span><button className="button button-dark" disabled={saving || uploading}><Save size={15}/>{saving ? 'Saving…' : 'Save profile'}</button></div>
        </form>

        <div className="admin-profile-side-column">
          <form className="admin-profile-card admin-password-card" onSubmit={changePassword}>
            <div className="admin-profile-card-heading">
              <div className="admin-profile-section-icon"><KeyRound size={18}/></div>
              <div><h2>Change password</h2><p>Verify your current password before setting a new one.</p></div>
            </div>
            {passwordError && <div className="notice notice-error">{passwordError}</div>}
            {passwordMessage && <div className="notice notice-success"><Check size={15}/>{passwordMessage}</div>}
            <label className="field-label">Current password<input type="password" value={passwords.currentPassword} onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))} autoComplete="current-password" required /></label>
            <label className="field-label">New password<input type="password" value={passwords.newPassword} onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))} minLength="12" maxLength="200" autoComplete="new-password" required /><small>Use at least 12 characters.</small></label>
            <label className="field-label">Confirm new password<input type="password" value={passwords.confirmPassword} onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))} minLength="12" maxLength="200" autoComplete="new-password" required /></label>
            <button className="button button-dark full-button" disabled={changingPassword}>{changingPassword ? 'Updating password…' : 'Update password'}<KeyRound size={15}/></button>
            <div className="admin-password-note"><ShieldCheck size={15}/><span>Changing your password signs out other active sessions on this account.</span></div>
          </form>

          <section className="admin-profile-card admin-account-card">
            <div className="admin-profile-card-heading">
              <div className="admin-profile-section-icon"><Mail size={18}/></div>
              <div><h2>Account details</h2><p>Your CMS account information.</p></div>
            </div>
            <div className="admin-account-detail"><span>Account role</span><strong>{String(user?.role || 'user').replaceAll('_', ' ')}</strong></div>
            <div className="admin-account-detail"><span>Member since</span><strong>{dateLabel(accountMeta.created_at)}</strong></div>
            <div className="admin-account-detail"><span>Last sign in</span><strong>{dateLabel(accountMeta.last_login_at)}</strong></div>
          </section>
        </div>
      </div>}
    </section>
  );
}
