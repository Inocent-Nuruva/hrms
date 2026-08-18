import React from 'react';
import { api } from '../lib/api';
import { MeListScreen } from '../screens/MeListScreen';

export default function FieldScreen() {
  return (
    <MeListScreen
      title="My field visits"
      empty="No field visits assigned to you."
      load={() => api.listMyFieldVisits()}
    />
  );
}
