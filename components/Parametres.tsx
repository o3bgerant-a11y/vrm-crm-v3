'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: number;
  full_name: string;
  email: string | null;
  role: string | null;
  status: string | null;
  agency_id: number | null;
  user_id?: string | null;
  auth_user_id?: string | null;
  agent_id?: number | null;
  is_admin?: boolean | null;
  account_type?: string | null;
};

const MASTER_EMAIL = 'o3b.gerant@gmail.com';

const agencyName = (agencyId: any) => {
  const id = Number(agencyId);

  if (id === 1) return 'Blois';
  if (id === 2) return 'Tours';
  if (id === 3) return 'Bourges';

  return '-';
};

export default function Parametres() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [accountType, setAccountType] = useState<'agent' | 'responsable'>('agent');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agencyId, setAgencyId] = useState<any>('');

  const [resettingProfile, setResettingProfile] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [myNewPassword, setMyNewPassword] = useState('');
  const [myConfirmPassword, setMyConfirmPassword] = useState('');
  const [changingMyPassword, setChangingMyPassword] = useState(false);

  const isResponsable =
    currentProfile?.is_admin === true ||
    currentProfile?.role === 'patron' ||
    currentProfile?.role === 'responsable' ||
    currentProfile?.account_type === 'responsable';

  async function loadCurrentProfileAndProfiles() {
    setLoading(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setCurrentProfile(null);
      setCurrentUserEmail(null);
      setProfiles([]);
      setLoading(false);
      return;
    }

    const userEmail = userData.user.email || null;
    setCurrentUserEmail(userEmail);

    let profile: Profile | null = null;

    const { data: myProfileData, error: myProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (myProfileError) {
      console.error('Erreur chargement profil connecté:', myProfileError);
    } else {
      profile = myProfileData as Profile | null;
    }

    if (!profile) {
      const { data: myProfileByAuthData, error: myProfileByAuthError } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', userData.user.id)
        .maybeSingle();

      if (myProfileByAuthError) {
        console.error('Erreur chargement profil connecté via auth_user_id:', myProfileByAuthError);
      } else {
        profile = myProfileByAuthData as Profile | null;
      }
    }

    if (!profile && userEmail) {
      const { data: myProfileByEmailData, error: myProfileByEmailError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (myProfileByEmailError) {
        console.error('Erreur chargement profil connecté via email:', myProfileByEmailError);
      } else {
        profile = myProfileByEmailData as Profile | null;
      }
    }

    setCurrentProfile(profile);

    const responsable =
      profile?.is_admin === true ||
      profile?.role === 'patron' ||
      profile?.role === 'responsable' ||
      profile?.account_type === 'responsable';

    if (!responsable) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      console.error(error);
      setProfiles([]);
    } else {
      setProfiles((data || []) as Profile[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCurrentProfileAndProfiles();
  }, []);

  function resetForm() {
    setAccountType('agent');
    setFullName('');
    setEmail('');
    setPassword('');
    setAgencyId('');
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!?#';
    let generated = '';

    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setPassword(generated);
  }

  function createTemporaryPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!?#';
    let generated = '';

    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return generated;
  }

  function isResponsableProfile(profile: Profile) {
    return (
      profile.is_admin === true ||
      profile.role === 'patron' ||
      profile.role === 'responsable' ||
      profile.account_type === 'responsable'
    );
  }

  function isMasterProfile(profile: Profile) {
    const profileEmail = String(profile.email || '').trim().toLowerCase();
    const connectedEmail = String(currentUserEmail || '').trim().toLowerCase();

    if (profileEmail && profileEmail === MASTER_EMAIL) return true;
    if (connectedEmail && profileEmail && profileEmail === connectedEmail) return true;
    if (currentProfile?.id && Number(profile.id) === Number(currentProfile.id)) return true;

    return false;
  }

  function canManageProfile(profile: Profile) {
    return isResponsable && !isMasterProfile(profile);
  }

  function openResetPassword(profile: Profile) {
    if (!isResponsable) return;

    if (isMasterProfile(profile)) {
      alert('Ton compte principal est protégé. Son mot de passe doit uniquement être modifié depuis "Mon compte".');
      return;
    }

    setResettingProfile(profile);
    setNewPassword(createTemporaryPassword());
  }

  function closeResetPassword() {
    setResettingProfile(null);
    setNewPassword('');
  }

  async function createAccount() {
    if (!isResponsable) return;

    if (!fullName.trim()) {
      alert("Il faut indiquer le nom du compte.");
      return;
    }

    if (!email.trim()) {
      alert("Il faut indiquer l'email de connexion.");
      return;
    }

    if (!password.trim()) {
      alert('Il faut indiquer ou générer un mot de passe provisoire.');
      return;
    }

    if (accountType === 'agent' && !agencyId) {
      alert("Il faut sélectionner l'agence de l'agent.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/create-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          agency_id: accountType === 'agent' ? Number(agencyId) : null,
          account_type: accountType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Erreur pendant la création du compte.');
        setSaving(false);
        return;
      }

      alert(
        `${accountType === 'responsable' ? 'Responsable' : 'Agent'} créé avec succès.\n\n` +
        `Identifiant : ${email.trim().toLowerCase()}\n` +
        `Mot de passe provisoire : ${password.trim()}`
      );

      resetForm();
      setShowForm(false);
      await loadCurrentProfileAndProfiles();
    } catch (error) {
      console.error(error);
      alert('Erreur serveur pendant la création du compte.');
    }

    setSaving(false);
  }

  async function updateAccount(
    profile: Profile,
    action: 'block' | 'activate' | 'archive' | 'delete'
  ) {
    if (!isResponsable) return;

    if (isMasterProfile(profile)) {
      alert('Ton compte principal est protégé. Il ne peut pas être bloqué, archivé ou supprimé.');
      return;
    }

    let confirmMessage = '';

    if (action === 'block') {
      confirmMessage = `Bloquer l'accès de ${profile.full_name} ?`;
    }

    if (action === 'activate') {
      confirmMessage = `Réactiver l'accès de ${profile.full_name} ?`;
    }

    if (action === 'archive') {
      confirmMessage = `Archiver ${profile.full_name} ? Ses données resteront conservées.`;
    }

    if (action === 'delete') {
      confirmMessage =
        `SUPPRIMER DÉFINITIVEMENT ${profile.full_name} ?\n\n` +
        `Le compte CRM, le profil et l'accès de connexion seront supprimés.\n\n` +
        `Cette action est irréversible.\n\n` +
        `À utiliser uniquement si tu es sûr de toi.`;
    }

    const ok = confirm(confirmMessage);

    if (!ok) return;

    setSaving(true);

    try {
      const response = await fetch('/api/update-agent-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_id: profile.id,
          action,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Erreur pendant la mise à jour du compte.');
        setSaving(false);
        return;
      }

      await loadCurrentProfileAndProfiles();
    } catch (error) {
      console.error(error);
      alert('Erreur serveur pendant la mise à jour du compte.');
    }

    setSaving(false);
  }

  async function resetAccountPassword() {
    if (!isResponsable) return;
    if (!resettingProfile) return;

    if (isMasterProfile(resettingProfile)) {
      alert('Ton compte principal est protégé. Son mot de passe doit uniquement être modifié depuis "Mon compte".');
      return;
    }

    if (!newPassword.trim()) {
      alert('Il faut indiquer un nouveau mot de passe.');
      return;
    }

    if (newPassword.trim().length < 6) {
      alert('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }

    const ok = confirm(`Réinitialiser le mot de passe de ${resettingProfile.full_name} ?`);

    if (!ok) return;

    setSaving(true);

    try {
      const response = await fetch('/api/reset-agent-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_id: resettingProfile.id,
          new_password: newPassword.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Erreur pendant la réinitialisation du mot de passe.');
        setSaving(false);
        return;
      }

      alert(
        `Mot de passe réinitialisé avec succès.\n\n` +
        `Compte : ${resettingProfile.full_name}\n` +
        `Email : ${resettingProfile.email || '-'}\n` +
        `Nouveau mot de passe temporaire : ${newPassword.trim()}\n\n` +
        `Transmets ce mot de passe à la personne. Elle pourra ensuite le personnaliser.`
      );

      closeResetPassword();
      await loadCurrentProfileAndProfiles();
    } catch (error) {
      console.error(error);
      alert('Erreur serveur pendant la réinitialisation du mot de passe.');
    }

    setSaving(false);
  }

  async function changeMyPassword() {
    if (!myNewPassword.trim() || !myConfirmPassword.trim()) {
      alert('Il faut indiquer et confirmer le nouveau mot de passe.');
      return;
    }

    if (myNewPassword.trim().length < 6) {
      alert('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }

    if (myNewPassword.trim() !== myConfirmPassword.trim()) {
      alert('Les deux mots de passe ne sont pas identiques.');
      return;
    }

    const ok = confirm('Modifier ton mot de passe de connexion CRM ?');

    if (!ok) return;

    setChangingMyPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: myNewPassword.trim(),
    });

    if (error) {
      console.error('Erreur modification mot de passe personnel:', error);
      alert(error.message || 'Erreur pendant la modification du mot de passe.');
    } else {
      alert('Mot de passe modifié avec succès.\nUtilise ce nouveau mot de passe à ta prochaine connexion.');
      setMyNewPassword('');
      setMyConfirmPassword('');
    }

    setChangingMyPassword(false);
  }

  function statusLabel(status: string | null) {
    if (status === 'active') return 'Actif';
    if (status === 'blocked') return 'Bloqué';
    if (status === 'archived') return 'Archivé';

    return status || '-';
  }

  function roleLabel(profile: Profile) {
    if (isResponsableProfile(profile)) {
      return 'Responsable';
    }

    if (profile.role === 'agent' || profile.account_type === 'agent') return 'Agent commercial';

    return profile.role || '-';
  }

  if (loading) {
    return (
      <div className="card">
        <h3>⚙️ Paramètres CRM</h3>
        <p className="muted">Chargement des paramètres...</p>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="card">
        <h3>⚙️ Paramètres CRM</h3>
        <p className="muted">
          {isResponsable
            ? 'Gestion des accès utilisateurs du CRM.'
            : 'Espace personnel agent : modification de ton mot de passe de connexion.'}
        </p>

        {isResponsable && (
          <button
            className="btn"
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                resetForm();
              } else {
                setShowForm(true);
              }
            }}
          >
            {showForm ? 'Fermer le formulaire' : '➕ Créer un compte CRM'}
          </button>
        )}
      </div>

      <div className="card">
        <h3>🔐 Mon compte</h3>
        <p className="muted">
          {currentUserEmail ? `Connecté avec : ${currentUserEmail}` : 'Compte CRM connecté.'}
        </p>

        {currentProfile && (
          <div className="item">
            <strong>{currentProfile.full_name}</strong>
            <p className="muted">
              Rôle : {isResponsable ? 'Responsable' : 'Agent commercial'} — Agence : {agencyName(currentProfile.agency_id)}
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={myNewPassword}
            onChange={(e) => setMyNewPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="Confirmer le nouveau mot de passe"
            value={myConfirmPassword}
            onChange={(e) => setMyConfirmPassword(e.target.value)}
          />

          <div className="item">
            <strong>Important</strong>
            <p className="muted">
              Ce changement modifie uniquement ton propre mot de passe de connexion au CRM.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={changeMyPassword} disabled={changingMyPassword}>
              {changingMyPassword ? 'Modification...' : '🔑 Modifier mon mot de passe'}
            </button>

            <button
              onClick={() => {
                setMyNewPassword('');
                setMyConfirmPassword('');
              }}
              disabled={changingMyPassword}
            >
              Effacer
            </button>
          </div>
        </div>
      </div>

      {!isResponsable && (
        <div className="card">
          <h3>Accès agent</h3>
          <p className="muted">
            Ton espace Paramètres est volontairement limité à ton compte personnel.
            La création, le blocage, la réinitialisation et la suppression des comptes agents sont réservés au Responsable.
          </p>
        </div>
      )}

      {isResponsable && showForm && (
        <div className="card">
          <h3>{accountType === 'responsable' ? 'Nouveau Responsable' : 'Nouvel agent commercial'}</h3>
          <p className="muted">
            Crée automatiquement le compte de connexion et le profil CRM.
            Pour un agent, une fiche agent est aussi créée automatiquement.
          </p>

          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <div className="item">
              <strong>Type de compte</strong>
              <p className="muted">
                Choisis Agent commercial pour un vendeur, ou Responsable pour donner les mêmes droits d’administration que toi.
              </p>
            </div>

            <select
              value={accountType}
              onChange={(e) => {
                const value = e.target.value === 'responsable' ? 'responsable' : 'agent';
                setAccountType(value);

                if (value === 'responsable') {
                  setAgencyId('');
                }
              }}
            >
              <option value="agent">Agent commercial</option>
              <option value="responsable">Responsable</option>
            </select>

            <input
              placeholder="Nom complet"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <input
              placeholder="Email de connexion"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {accountType === 'agent' && (
              <select
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Sélectionner une agence</option>
                <option value={1}>Blois</option>
                <option value={2}>Tours</option>
                <option value={3}>Bourges</option>
              </select>
            )}

            {accountType === 'responsable' && (
              <div className="item">
                <strong>Compte Responsable</strong>
                <p className="muted">
                  Aucun rattachement agence n’est nécessaire.
                  Ce compte aura accès à toutes les agences, aux paramètres, aux statistiques et aux fonctions Responsable.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                placeholder="Mot de passe provisoire"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button onClick={generatePassword}>Générer</button>
            </div>

            <div className="item">
              <strong>Important</strong>
              <p className="muted">
                Le mot de passe provisoire sera affiché une seule fois après la création.
                Il faudra le transmettre à la personne et éviter de le stocker en clair.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={createAccount} disabled={saving}>
                {saving ? 'Création en cours...' : accountType === 'responsable' ? 'Créer le Responsable' : "Créer l'agent"}
              </button>

              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                disabled={saving}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {isResponsable && resettingProfile && (
        <div className="card">
          <h3>🔑 Réinitialiser le mot de passe</h3>
          <p className="muted">
            Compte : {resettingProfile.full_name} — {resettingProfile.email || '-'}
          </p>

          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <input
              placeholder="Nouveau mot de passe temporaire"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <button onClick={() => setNewPassword(createTemporaryPassword())} disabled={saving}>
              Générer
            </button>

            <div className="item">
              <strong>Important</strong>
              <p className="muted">
                Le nouveau mot de passe sera affiché une seule fois après validation.
                Transmets-le à la personne, puis demande-lui de le personnaliser depuis son espace.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={resetAccountPassword} disabled={saving}>
                {saving ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
              </button>

              <button onClick={closeResetPassword} disabled={saving}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {isResponsable && (
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3>Comptes CRM</h3>

          {profiles.length === 0 && (
            <p className="muted">Aucun compte trouvé.</p>
          )}

          {profiles.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Agence</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {profiles.map((profile) => {
                  const masterProfile = isMasterProfile(profile);
                  const responsableProfile = isResponsableProfile(profile);
                  const manageableProfile = canManageProfile(profile);

                  return (
                    <tr key={profile.id}>
                      <td>
                        <strong>{profile.full_name}</strong>
                        {masterProfile && (
                          <div className="muted" style={{ fontSize: 12 }}>
                            👑 Compte principal protégé
                          </div>
                        )}
                      </td>

                      <td>{profile.email || '-'}</td>
                      <td>{roleLabel(profile)}</td>
                      <td>{agencyName(profile.agency_id)}</td>
                      <td><strong>{statusLabel(profile.status)}</strong></td>

                      <td>
                        {masterProfile ? (
                          <span className="muted">Compte principal</span>
                        ) : manageableProfile ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {profile.status !== 'blocked' && profile.status !== 'archived' && (
                              <button onClick={() => updateAccount(profile, 'block')} disabled={saving}>
                                Bloquer
                              </button>
                            )}

                            {profile.status === 'blocked' && (
                              <button onClick={() => updateAccount(profile, 'activate')} disabled={saving}>
                                Réactiver
                              </button>
                            )}

                            {profile.status !== 'archived' && (
                              <button onClick={() => updateAccount(profile, 'archive')} disabled={saving}>
                                Archiver
                              </button>
                            )}

                            {profile.status !== 'archived' && (
                              <button onClick={() => openResetPassword(profile)} disabled={saving}>
                                🔑 Réinitialiser MDP
                              </button>
                            )}

                            {profile.status === 'archived' && (
                              <span className="muted">Archivé</span>
                            )}

                            <button
                              onClick={() => updateAccount(profile, 'delete')}
                              disabled={saving}
                              style={{
                                background: '#dc2626',
                                color: '#ffffff',
                                borderColor: '#dc2626',
                                width: 'fit-content',
                                fontWeight: 800,
                              }}
                            >
                              🗑️ Supprimer définitivement
                            </button>

                            {responsableProfile && (
                              <span className="badge">Responsable modifiable</span>
                            )}
                          </div>
                        ) : (
                          <span className="muted">Action non autorisée</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
