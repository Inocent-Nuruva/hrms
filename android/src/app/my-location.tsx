import React from 'react';
import { MyLocationScreen } from '../screens/MyLocationScreen';
import { useAuth } from '../hooks/useAuth';

export default function MyLocationPage() {
  const auth = useAuth();
  return <MyLocationScreen auth={auth} />;
}
