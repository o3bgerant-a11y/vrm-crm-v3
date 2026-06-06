'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: number;
  full_name: string;
  email: string | null;
  role: string;
  status: string;
  agency_id: number | null;
};

const agencyName = (agencyId: any) => {
  const id = Number(agencyId);

  if (id === 1) return 'Blois';
  if (id === 2) return 'Tours';
  if (id === 3) return 'Bourges';

  return '-';
};

export default function Parametres() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agencyId, setAgencyId] = useState<number | ''>('');

  const [resettingProfile, setResettingProfile] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');

  async function loadProfiles() {
    setLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      console.error(error);
      setProfiles([]);
    } else {
      setProfiles(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  function resetForm() {
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

  function openResetPassword(profile: Profile) {
    if (profile.role === 'patron' || profile.role === 'responsable') {
      alert('Le mot de passe du compte Responsable ne peut pas être modifié ici.');
      return;
    }

    setResettingProfile(profile);
    setNewPassword(createTemporaryPassword());
  }

  function closeResetPassword() {
    setResettingProfile(null);
    setNewPassword('');
  }

  async function createAgent() {
    if (!fullName.trim()) {
      alert("Il faut indiquer le nom de l'agent.");
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

    if (!agencyId) {
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
          agency_id: Number(agencyId),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Erreur pendant la création de l'agent.");
        setSaving(false);
        return;
      }

      alert(
        `Agent créé avec succès.\n\nIdentifiant : ${email.trim().toLowerCase()}\nMot de passe provisoire : ${password.trim()}`
      );

      resetForm();
      setShowForm(false);
      await loadProfiles();
    } catch (error) {
      console.error(error);
      alert("Erreur serveur pendant la création de l'agent.");
    }

    setSaving(false);
  }

  async function updateAccount(profile: Profile, action: 'block' | 'activate' | 'archive') {
    if (profile.role === 'patron') {
      alert('Le compte Patron ne peut pas être modifié ici.');
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
      confirmMessage = `Archiver ${profile.full_name} ? Ses ventes resteront conservées.`;
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
        alert(result.error || "Erreur pendant la mise à jour du compte.");
        setSaving(false);
        return;
      }

      await loadProfiles();
    } catch (error) {
      console.error(error);
      alert("Erreur serveur pendant la mise à jour du compte.");
    }

    setSaving(false);
  }

  async function resetAgentPassword() {
    if (!resettingProfile) return;

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
        `Mot de passe réinitialisé avec succès.\n\nAgent : ${resettingProfile.full_name}\nEmail : ${resettingProfile.email || '-'}\nNouveau mot de passe temporaire : ${newPassword.trim()}\n\nTransmets ce mot de passe à l'agent. Il pourra ensuite le personnaliser.`
      );

      closeResetPassword();
      await loadProfiles();
    } catch (error) {
      console.error(error);
      alert('Erreur serveur pendant la réinitialisation du mot de passe.');
    }

    setSaving(false);
  }

  function statusLabel(status: string) {
    if (status === 'active') return 'Actif';
    if (status === 'blocked') return 'Bloqué';
    if (status === 'archived') return 'Archivé';

    return status;
  }

  return (
    <div className="section">
      <div className="card">
        <h3>⚙️ Paramètres CRM</h3>

        <p className="muted">
          Gestion des accès utilisateurs du CRM.
        </p>

        <div style={{ marginTop: 15 }}>
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
            {showForm ? 'Fermer le formulaire' : '➕ Créer un agent'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h3>Nouvel agent commercial</h3>

          <p className="muted">
            Crée automatiquement le compte de connexion, le profil CRM et la fiche agent.
          </p>

          <div style={{ display: 'grid', gap: 10, marginTop: 15 }}>
            <input
              placeholder="Nom complet ex : Maveryk Leveau"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <input
              placeholder="Email de connexion ex : maveryk@agentsco.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <select
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Sélectionner une agence</option>
              <option value={1}>Blois</option>
              <option value={2}>Tours</option>
              <option value={3}>Bourges</option>
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
              <input
                placeholder="Mot de passe provisoire"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button onClick={generatePassword} type="button">
                Générer
              </button>
            </div>

            <div className="item">
              <strong>Important</strong>
              <p className="muted" style={{ marginTop: 5 }}>
                Le mot de passe provisoire sera affiché une seule fois après la création.
                Il faudra le transmettre à l'agent et éviter de le stocker en clair.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={createAgent} disabled={saving}>
                {saving ? 'Création en cours...' : "Créer l'agent"}
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

      {resettingProfile && (
        <div className="card">
          <h3>🔑 Réinitialiser le mot de passe</h3>

          <p className="muted">
            Agent : <strong>{resettingProfile.full_name}</strong> — {resettingProfile.email || '-'}
          </p>

          <div style={{ display: 'grid', gap: 10, marginTop: 15 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
              <input
                placeholder="Nouveau mot de passe temporaire"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <button
                type="button"
                onClick={() => setNewPassword(createTemporaryPassword())}
                disabled={saving}
              >
                Générer
              </button>
            </div>

            <div className="item">
              <strong>Important</strong>
              <p className="muted" style={{ marginTop: 5 }}>
                Le nouveau mot de passe sera affiché une seule fois après validation.
                Transmets-le à l'agent, puis demande-lui de le personnaliser depuis son espace.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={resetAgentPassword} disabled={saving}>
                {saving ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
              </button>

              <button onClick={closeResetPassword} disabled={saving}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Comptes CRM</h3>

        {loading && (
          <p className="muted">
            Chargement...
          </p>
        )}

        {!loading && profiles.length === 0 && (
          <p className="muted">
            Aucun compte trouvé.
          </p>
        )}

        {!loading && profiles.length > 0 && (
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
              {profiles.map(profile => (
                <tr key={profile.id}>
                  <td>
                    <strong>{profile.full_name}</strong>
                  </td>

                  <td>
                    {profile.email || '-'}
                  </td>

                  <td>
                    {profile.role}
                  </td>

                  <td>
                    {agencyName(profile.agency_id)}
                  </td>

                  <td>
                    <strong>{statusLabel(profile.status)}</strong>
                  </td>

                  <td>
                    {profile.role === 'patron' ? (
                      <span className="muted">Compte Patron</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {profile.status !== 'blocked' && profile.status !== 'archived' && (
                          <button
                            onClick={() => updateAccount(profile, 'block')}
                            disabled={saving}
                          >
                            Bloquer
                          </button>
                        )}

                        {profile.status === 'blocked' && (
                          <button
                            onClick={() => updateAccount(profile, 'activate')}
                            disabled={saving}
                          >
                            Réactiver
                          </button>
                        )}

                        {profile.status !== 'archived' && (
                          <button
                            onClick={() => updateAccount(profile, 'archive')}
                            disabled={saving}
                          >
                            Archiver
                          </button>
                        )}

                        {profile.status !== 'archived' && (
                          <button
                            onClick={() => openResetPassword(profile)}
                            disabled={saving}
                          >
                            🔑 Réinitialiser MDP
                          </button>
                        )}

                        {profile.status === 'archived' && (
                          <span className="muted">Archivé</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
