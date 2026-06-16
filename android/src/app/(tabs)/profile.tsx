import React from 'react';
import { ProfileScreen } from '../../screens/ProfileScreen';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileTab() {
  const auth = useAuth();
  return <ProfileScreen auth={auth} />;
}
