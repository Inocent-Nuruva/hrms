import React from 'react';
import { PunchDetailsScreen } from '../screens/PunchDetailsScreen';
import { useAuth } from '../hooks/useAuth';

export default function PunchDetailsPage() {
  const auth = useAuth();
  return <PunchDetailsScreen auth={auth} />;
}
