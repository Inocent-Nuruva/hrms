import React from 'react';
import { api } from '../lib/api';
import { MeListScreen } from '../screens/MeListScreen';

export default function ActivitiesScreen() {
  return (
    <MeListScreen
      title="My activities"
      empty="No daily activity reports yet."
      load={() => api.listMyActivities()}
    />
  );
}
