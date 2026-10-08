import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { ProfileCardArtworkId } from '../../lib/profile-card-background';

/** Shared vector doodles for the web and mobile employee dashboard card. */
export function ProfileCardDoodles({
  artwork,
  onLight = false,
  vivid = false,
}: {
  artwork: ProfileCardArtworkId;
  /** Dark ink for white and dynamic cards, where white strokes disappear. */
  onLight?: boolean;
  /** Stronger strokes for the large dashboard card. */
  vivid?: boolean;
}) {
  if (artwork === 'none') return null;
  const line = onLight
    ? (vivid ? 'rgba(15,23,42,0.28)' : 'rgba(15,23,42,0.18)')
    : (vivid ? 'rgba(255,255,255,0.46)' : 'rgba(255,255,255,0.23)');
  const dot = onLight
    ? (vivid ? 'rgba(15,23,42,0.42)' : 'rgba(15,23,42,0.28)')
    : (vivid ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.42)');

  return (
    <Svg
      pointerEvents="none"
      viewBox="0 0 420 220"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' }}
    >
      {artwork === 'orbit' ? (
        <>
          <Circle cx="320" cy="110" r="66" stroke={line} strokeWidth="2" fill="none" />
          <Circle cx="320" cy="110" r="43" stroke={line} strokeWidth="2" fill="none" />
          <Circle cx="320" cy="110" r="19" stroke={line} strokeWidth="2" fill="none" />
          <Path d="M235 160c46-72 105-112 178-118M248 56c51 25 95 68 130 130" stroke={line} strokeWidth="2" fill="none" strokeLinecap="round" />
          <Circle cx="250" cy="57" r="5" fill={dot} />
          <Circle cx="402" cy="42" r="5" fill={dot} />
        </>
      ) : null}
      {artwork === 'waves' ? (
        <>
          <Path d="M205 58c32-25 63 25 96 0s64 25 97 0 64 25 97 0M180 91c32-25 63 25 96 0s64 25 97 0 64 25 97 0M205 124c32-25 63 25 96 0s64 25 97 0 64 25 97 0M180 157c32-25 63 25 96 0s64 25 97 0 64 25 97 0" stroke={line} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : null}
      {artwork === 'confetti' ? (
        <>
          <Circle cx="268" cy="56" r="7" stroke={line} strokeWidth="2" fill="none" />
          <Circle cx="337" cy="42" r="4" stroke={line} strokeWidth="2" fill="none" />
          <Circle cx="389" cy="89" r="8" stroke={line} strokeWidth="2" fill="none" />
          <Circle cx="300" cy="120" r="5" stroke={line} strokeWidth="2" fill="none" />
          <Circle cx="365" cy="157" r="6" stroke={line} strokeWidth="2" fill="none" />
          <Circle cx="245" cy="171" r="4" stroke={line} strokeWidth="2" fill="none" />
          <Path d="m322 78 14-15m43 55 14 14m-99 7-12 17m-19-91 9 9m81 73 9-11m-99-39 7-7m88-57 8 10m-33 150 7-7" stroke={line} strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : null}
      {artwork === 'arches' ? (
        <>
          <Path d="M230 190V116a45 45 0 0 1 90 0v74M265 190v-58a28 28 0 0 1 56 0v58M320 190V98a57 57 0 0 1 114 0v92M354 190v-71a23 23 0 0 1 46 0v71" stroke={line} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : null}
      {artwork === 'sprigs' ? (
        <>
          <Path d="M300 205c12-47 36-84 73-119m-49 49c-22-2-37-14-43-35 21-2 38 9 43 35Zm22-24c-2-23 8-41 29-51 4 21-6 40-29 51Zm-10 34c-20-6-32-22-33-44 21 3 34 17 33 44Zm32-37c2-22 15-37 37-42 0 22-13 38-37 42ZM220 206c9-33 25-59 50-80m-35 32c-16-2-26-11-30-26 15-1 26 8 30 26Zm16-17c0-16 7-28 22-35 2 15-5 27-22 35Z" stroke={line} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {artwork === 'orbit' ? <><Circle cx="250" cy="57" r="4" fill="#38BDF8" /><Circle cx="402" cy="42" r="4" fill="#FBBF24" /></> : null}
      {artwork === 'waves' ? <><Circle cx="250" cy="58" r="5" fill="#F9A8D4" /><Circle cx="385" cy="124" r="5" fill="#7DD3FC" /></> : null}
      {artwork === 'confetti' ? <><Circle cx="268" cy="56" r="3" fill="#F9A8D4" /><Circle cx="389" cy="89" r="3" fill="#FCD34D" /><Circle cx="365" cy="157" r="3" fill="#7DD3FC" /></> : null}
      {artwork === 'arches' ? <><Circle cx="320" cy="72" r="5" fill="#FCD34D" /><Circle cx="434" cy="98" r="5" fill="#7DD3FC" /></> : null}
      {artwork === 'sprigs' ? <><Circle cx="324" cy="91" r="4" fill="#7DD3FC" /><Circle cx="372" cy="111" r="4" fill="#F9A8D4" /></> : null}
    </Svg>
  );
}
