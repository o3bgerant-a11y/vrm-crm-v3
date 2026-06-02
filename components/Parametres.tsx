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

  return (
    <div className="section">
      <div className="card">
        <h3>⚙️ Paramètres CRM</h3>

        <p className="muted">
          Gestion des accès utilisateurs du CRM.
        </p>

        <div style={{ marginTop: 15 }}>
          <button className="btn">
            ➕ Créer un agent
          </button>
        </div>
      </div>

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
                    {profile.status}
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
