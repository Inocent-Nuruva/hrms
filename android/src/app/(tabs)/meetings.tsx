import React from 'react';
import { MeetingsScreen } from '../../screens/MeetingsScreen';
import { useAuth } from '../../hooks/useAuth';

export default function MeetingsTab() {
  const auth = useAuth();
  return <MeetingsScreen auth={auth} />;
}
